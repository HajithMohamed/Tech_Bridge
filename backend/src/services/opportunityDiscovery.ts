import mongoose, { Types, type ClientSession, type PipelineStage } from 'mongoose';
import Opportunity, { type IOpportunity } from '../models/Opportunity';
import User from '../models/User';
import Application from '../models/Application';
import { SavedOpportunity } from '../models/OpportunityActivity';
import { ScholarshipEvent } from '../models/Scholarship';
import { matchScore, getResourceForSkill } from '../utils/matchEngine';
import { defaultOpportunityEligibility, effectiveOpportunityStatus, eligibilityInput, explainOrdinaryEligibility, opportunityId, opportunityObject, opportunityPage, opportunitySearch, providerCurrentlyVerified } from './opportunityPolicy';
import { ScholarshipError, scholarshipEligibility } from './scholarshipPolicy';
import { policyFor } from './scholarships';
import { ApplicationEvent } from '../models/OpportunityActivity';

export const opportunityTransactions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
export async function lockOpportunityUsers(ids: Types.ObjectId[], session: ClientSession) {
  const users = new Map<string, InstanceType<typeof User>>();
  for (const id of [...new Set(ids.map(String))].sort()) {
    const user = await User.findOneAndUpdate({ _id: id }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!user) throw new ScholarshipError(404, 'An opportunity participant is no longer available.'); users.set(id, user);
  }
  return users;
}
export function publicOpportunityProviderStages(): PipelineStage[] {
  return [
    { $lookup: { from: User.collection.name, localField: 'providerId', foreignField: '_id', as: 'owner' } }, { $unwind: '$owner' },
    { $match: { 'owner.role': 'provider', 'owner.accountStatus': { $ne: 'suspended' }, 'owner.providerProfile.verified': true, 'owner.providerProfile.verificationStatus': 'VERIFIED', $or: [{ 'owner.requiresEmailVerification': { $ne: true } }, { 'owner.emailVerifiedAt': { $type: 'date' } }] } },
    { $set: { providerId: { _id: '$owner._id', fullName: '$owner.fullName', providerProfile: { organizationName: '$owner.providerProfile.organizationName', organizationType: '$owner.providerProfile.organizationType', verified: '$owner.providerProfile.verified' } }, providerCredibility: { verification: 'provider_verified' } } },
    { $unset: ['owner', '__v'] },
  ];
}
export async function discoverOpportunities(query: unknown, now = new Date()) {
  const { filter, page, limit, sort } = opportunitySearch(query, now);
  const [result] = await Opportunity.aggregate([{ $match: filter }, ...publicOpportunityProviderStages(), { $facet: { rows: [{ $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'total' }] } }]).option({ maxTimeMS: 10000 });
  const total = result.count[0]?.total ?? 0;
  return { opportunities: result.rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}
export async function visibleOpportunity(idValue: unknown, now = new Date()) {
  const { filter } = opportunitySearch({}, now);
  const [row] = await Opportunity.aggregate([{ $match: { _id: opportunityId(idValue), ...filter } }, ...publicOpportunityProviderStages()]);
  if (!row) throw new ScholarshipError(404, 'Open opportunity not found.'); return row;
}
export async function matchedOpportunities(studentId: Types.ObjectId, query: unknown, now = new Date()) {
  const student = await User.findById(studentId);
  if (!student?.studentProfile || student.role !== 'student') throw new ScholarshipError(400, 'Complete your student profile to receive matches.');
  if (student.requiresEmailVerification && !student.emailVerifiedAt) throw new ScholarshipError(403, 'Verify your email before accessing personalized matches.');
  const { filter, page, limit } = opportunitySearch(query, now, true); const keep = page * limit;
  const ranked: Record<string, any>[] = []; let total = 0;
  const compare = (a: Record<string, any>, b: Record<string, any>) => b.matchPercentage - a.matchPercentage || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || String(b._id).localeCompare(String(a._id));
  const cursor = Opportunity.aggregate([{ $match: filter }, ...publicOpportunityProviderStages()]).option({ maxTimeMS: 10000 }).cursor({ batchSize: 100 });
  try {
    for await (const row of cursor) {
      total++; const match = matchScore(student.studentProfile, row as IOpportunity);
      const scored = { ...row, ...match, matchingVersion: 2, matchingMethod: 'rules', skillResources: match.missingSkills.map(skill => ({ skill, ...getResourceForSkill(skill) })) };
      if (ranked.length === keep && compare(scored, ranked[ranked.length - 1]) >= 0) continue;
      let low = 0; let high = ranked.length;
      while (low < high) { const mid = (low + high) >>> 1; if (compare(scored, ranked[mid]) < 0) high = mid; else low = mid + 1; }
      ranked.splice(low, 0, scored); if (ranked.length > keep) ranked.pop();
    }
  } finally { await cursor.close(); }
  return { opportunities: ranked.slice((page - 1) * limit), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), studentSkills: student.studentProfile.skills, careerGoal: student.studentProfile.careerGoal || '', matchingMethod: 'rules', matchingVersion: 2 };
}
export async function saveOpportunity(studentId: Types.ObjectId, idValue: unknown) {
  const id = opportunityId(idValue);
  return mongoose.connection.transaction(async session => {
    const source = await Opportunity.findById(id).session(session); if (!source) throw new ScholarshipError(404, 'Open opportunity not found.');
    const users = await lockOpportunityUsers([studentId, source.providerId], session); const student = users.get(String(studentId))!;
    if (student.role !== 'student' || student.accountStatus === 'suspended' || (student.requiresEmailVerification && !student.emailVerifiedAt)) throw new ScholarshipError(403, 'An active student account is required.');
    if (!providerCurrentlyVerified(users.get(String(source.providerId))!) || effectiveOpportunityStatus(source) !== 'open' || source.scholarshipWithdrawnByAdmin || source.opportunityWithdrawnByAdmin) throw new ScholarshipError(404, 'Open opportunity not found.');
    await Opportunity.updateOne({ _id: id }, { $inc: { __v: 1 } }, { session, timestamps: false });
    const existing = await SavedOpportunity.findOne({ studentId, opportunityId: id }).session(session); if (existing) return existing;
    if (await SavedOpportunity.countDocuments({ studentId }).session(session) >= 500) throw new ScholarshipError(409, 'Remove a saved opportunity before saving more than 500.');
    const [row] = await SavedOpportunity.create([{ studentId, opportunityId: id }], { session }); return row;
  }, opportunityTransactions);
}
export async function listSavedOpportunities(studentId: Types.ObjectId, query: unknown) {
  const values = opportunityObject(query, ['page', 'limit']); const page = opportunityPage(values.page); const limit = opportunityPage(values.limit, 20, 100);
  const [saved, total] = await Promise.all([SavedOpportunity.find({ studentId }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), SavedOpportunity.countDocuments({ studentId })]);
  const { filter } = opportunitySearch({});
  const listings = await Opportunity.aggregate([{ $match: { _id: { $in: saved.map(row => row.opportunityId) }, ...filter } }, ...publicOpportunityProviderStages()]);
  const byId = new Map(listings.map(row => [String(row._id), row]));
  return { savedOpportunities: saved.map(row => ({ _id: row._id, opportunityId: row.opportunityId, savedAt: row.createdAt, availability: byId.has(String(row.opportunityId)) ? 'available' : 'unavailable', opportunity: byId.get(String(row.opportunityId)) ?? null })), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}
export async function unsaveOpportunity(studentId: Types.ObjectId, idValue: unknown) {
  const id = opportunityId(idValue);
  return mongoose.connection.transaction(async session => {
    await lockOpportunityUsers([studentId], session);
    await SavedOpportunity.deleteOne({ studentId, opportunityId: id }, { session });
  }, opportunityTransactions);
}
export async function opportunityEligibility(studentId: Types.ObjectId, idValue: unknown) {
  const listing = await visibleOpportunity(idValue);
  const student = await User.findById(studentId);
  const match = matchScore(student?.studentProfile, listing as IOpportunity);
  const applied = Boolean(await Application.exists({ studentId, opportunityId: listing._id }));
  if (listing.type === 'scholarship') {
    const policy = await policyFor(listing._id); const assessment = scholarshipEligibility(student ?? undefined, policy.settings);
    return { ...assessment, canApply: assessment.eligible && !applied, alreadyApplied: applied, policySource: 'scholarship_policy', policyRevision: policy.revision, requirements: policy.settings.eligibility, supportingEvidenceRequiredForAward: policy.settings.eligibility.requireEvidence, matching: { ...match, method: 'rules', version: 2 }, advisory: 'Eligibility and matching do not award a scholarship; confidential evidence and a human decision may be required.' };
  }
  const rules = listing.eligibility ? eligibilityInput(listing.eligibility) : defaultOpportunityEligibility();
  return { ...explainOrdinaryEligibility(student, rules), canApply: explainOrdinaryEligibility(student, rules).eligible && !applied, alreadyApplied: applied, policySource: 'listing', requirements: rules, matching: { ...match, method: 'rules', version: 2 }, advisory: 'The match score and preferred skills are advisory. Only explicitly published eligibility rules restrict submission; a human reviewer decides the outcome.' };
}
export async function applicationStatusHistory(actorId: Types.ObjectId, actorRole: string, idValue: unknown, query: unknown) {
  const id = opportunityId(idValue); const values = opportunityObject(query, ['page', 'limit']); const page = opportunityPage(values.page); const limit = opportunityPage(values.limit, 20, 50);
  const application = await Application.findOne({ _id: id, [actorRole === 'student' ? 'studentId' : 'providerId']: actorId });
  if (!application || (actorRole === 'provider' && !await Opportunity.exists({ _id: application.opportunityId, providerId: actorId }))) throw new ScholarshipError(404, 'Application not found.');
  const listing = await Opportunity.findById(application.opportunityId).select('type');
  const scholarship = listing?.type === 'scholarship' || application.scholarshipVersion === 1;
  const filter = scholarship ? { applicationId: id, action: { $in: ['submitted', 'decision', 'appeal_reopened'] } } : { applicationId: id };
  const [events, total] = scholarship
    ? await Promise.all([ScholarshipEvent.find(filter).select('actorId action fromStatus toStatus reason revision createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), ScholarshipEvent.countDocuments(filter)])
    : await Promise.all([ApplicationEvent.find(filter).select('actorId action fromStatus toStatus reason revision createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), ApplicationEvent.countDocuments(filter)]);
  const historyComplete = scholarship ? Boolean(await ScholarshipEvent.exists({ applicationId: id, action: 'submitted' })) : application.statusHistoryVersion === 1;
  return { applicationId: id, status: application.status, revision: scholarship ? application.scholarshipRevision ?? 0 : application.notificationRevision ?? 0, events, historyComplete, legacyNotice: historyComplete ? null : 'Earlier events were not recorded. Current status is a snapshot, not reconstructed history.', total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}
