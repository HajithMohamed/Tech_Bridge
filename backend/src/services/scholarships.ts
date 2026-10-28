import mongoose, { Types, type ClientSession } from 'mongoose';
import { createHash } from 'node:crypto';
import Application, { type ApplicationStatus } from '../models/Application';
import Opportunity from '../models/Opportunity';
import User from '../models/User';
import { ScholarshipAppeal, ScholarshipEvent, ScholarshipEvidence, ScholarshipPolicy, ScholarshipReview, type ScholarshipEventRecord } from '../models/Scholarship';
import { academicYearStart, defaultScholarshipPolicy, duplicateBenefitConflict, scholarshipEligibility, scholarshipId, scholarshipPolicyInput, scholarshipPriority, scholarshipReason, scholarshipRevision, scholarshipTransition, ScholarshipError } from './scholarshipPolicy';
import { validateVerificationDocument } from './verificationPolicy';

type App = InstanceType<typeof Application>;
type Opp = InstanceType<typeof Opportunity>;
export const scholarshipTransactions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
export async function lockScholarshipActor(id: Types.ObjectId, role: 'student' | 'provider', session: ClientSession) {
  const user = await User.findOneAndUpdate({ _id: id, role, accountStatus: 'active', ...(role === 'provider' ? { 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED' } : {}) }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
  if (!user) throw new ScholarshipError(403, 'An active authorized scholarship account is required.');
  return user;
}
export async function policyFor(opportunityId: Types.ObjectId, session?: ClientSession) {
  const row = await ScholarshipPolicy.findOne({ opportunityId }).session(session ?? null);
  try { return { settings: row ? scholarshipPolicyInput(row.settings) : defaultScholarshipPolicy(), revision: row?.revision ?? 0, timingStart: row?.timingStart, timingEnd: row?.timingEnd }; }
  catch { throw new ScholarshipError(409, 'Stored scholarship policy requires review before use.'); }
}
export async function scholarshipContext(id: unknown, actorId: Types.ObjectId, role: 'student' | 'provider', session?: ClientSession, lock = false) {
  const application = await Application.findOne({ _id: scholarshipId(id), [role === 'student' ? 'studentId' : 'providerId']: actorId }).session(session ?? null);
  if (!application) throw new ScholarshipError(404, 'Scholarship application not found.');
  const filter = { _id: application.opportunityId, providerId: application.providerId, type: 'scholarship' };
  const opportunity = lock ? await Opportunity.findOneAndUpdate(filter, { $inc: { __v: 1 } }, { new: true, session, timestamps: false }) : await Opportunity.findOne(filter).session(session ?? null);
  if (!opportunity) throw new ScholarshipError(404, 'Scholarship application not found.');
  return { application, opportunity };
}
export async function scholarshipEvent(application: App, actorId: Types.ObjectId, action: ScholarshipEventRecord['action'], reason: string, session: ClientSession, extra: Partial<ScholarshipEventRecord> = {}) {
  await ScholarshipEvent.create([{ applicationId: application._id, opportunityId: application.opportunityId, actorId, action, reason, ...extra }], { session });
}
async function previousBenefits(studentId: Types.ObjectId, excluding: Types.ObjectId, session: ClientSession) {
  const rows = await Application.find({ studentId, status: 'accepted', _id: { $ne: excluding } }).populate({ path: 'opportunityId', select: 'type', options: { session } }).session(session);
  const reviews = await ScholarshipReview.find({ applicationId: { $in: rows.map((row) => row._id) } }).session(session);
  const map = new Map(reviews.map((row) => [String(row.applicationId), row])); let unclassified = 0;
  const benefits: { appliedAt: Date; restriction: 'application_year' | 'lifetime' | 'allow_multiple' }[] = [];
  for (const row of rows) {
    const listing = row.opportunityId as unknown as { type?: string } | null; const review = map.get(String(row._id));
    if (listing?.type === 'scholarship' || review || row.scholarshipVersion === 1) benefits.push({ appliedAt: row.appliedAt, restriction: review?.awardRestriction ?? 'application_year' });
    else if (!listing) unclassified++;
  }
  return { benefits, unclassified };
}
export async function ensureScholarshipReview(application: App, opportunity: Opp, session: ClientSession) {
  const existing = await ScholarshipReview.findOne({ applicationId: application._id }).session(session);
  if (existing) { try { existing.policy = scholarshipPolicyInput(existing.policy); } catch { throw new ScholarshipError(409, 'The saved scholarship policy requires review before use.'); } return existing; }
  const policy = await policyFor(opportunity._id, session); const student = await User.findById(application.studentId).session(session);
  const prior = await previousBenefits(application.studentId, application._id, session);
  const benefitCount = prior.benefits.filter((benefit) => policy.settings.duplicateBenefitPolicy === 'lifetime' || benefit.appliedAt >= academicYearStart()).length;
  const timingStart = policy.timingStart ?? opportunity.createdAt ?? application.appliedAt; const timingEnd = policy.timingEnd ?? opportunity.applicationDeadline;
  const priority = scholarshipPriority(application.selfDeclaredNeed, student ?? undefined, opportunity, policy.settings, benefitCount, application.appliedAt, timingStart, timingEnd);
  if (prior.unclassified) priority.priorityReasons.push('Some prior accepted allocations have missing listings; record review is required before an award.');
  const [review] = await ScholarshipReview.create([{ applicationId: application._id, opportunityId: opportunity._id, studentId: application.studentId, providerId: application.providerId, policy: policy.settings, policyRevision: policy.revision, priority, timingStart, timingEnd, calculatedAt: new Date() }], { session });
  return review;
}
export async function configureScholarship(id: unknown, providerId: Types.ObjectId, body: Record<string, unknown>) {
  const oid = scholarshipId(id); const settings = scholarshipPolicyInput(body); const reason = scholarshipReason(body.reason); const expected = scholarshipRevision(body.revision, true);
  return mongoose.connection.transaction(async (session) => {
    await lockScholarshipActor(providerId, 'provider', session);
    const opportunity = await Opportunity.findOneAndUpdate({ _id: oid, providerId, type: 'scholarship' }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!opportunity) throw new ScholarshipError(404, 'Scholarship not found.');
    const current = await policyFor(opportunity._id, session); if (current.revision !== expected) throw new ScholarshipError(409, 'Scholarship policy changed. Reload before editing.');
    if (current.revision >= 10000) throw new ScholarshipError(409, 'This policy has reached its revision limit.');
    if (await Application.exists({ opportunityId: opportunity._id }).session(session)) throw new ScholarshipError(409, 'Policy is frozen after the first application. Publish a new scholarship for different rules.');
    const row = await ScholarshipPolicy.findOneAndUpdate({ opportunityId: opportunity._id }, { $set: { providerId, settings, revision: current.revision + 1 } }, { upsert: true, new: true, runValidators: true, session });
    await ScholarshipEvent.create([{ opportunityId: opportunity._id, actorId: providerId, action: 'policy_updated', reason, revision: current.revision + 1, policySnapshot: settings }], { session }); return row;
  }, scholarshipTransactions);
}
export async function submitScholarship(studentId: Types.ObjectId, body: Record<string, unknown>) {
  const oid = scholarshipId(body.opportunityId); const justification = scholarshipReason(body.justification, 30, 800);
  if (!['low', 'medium', 'high'].includes(body.selfDeclaredNeed as string)) throw new ScholarshipError(400, 'Select your declared need level.');
  if (body.message !== undefined && (typeof body.message !== 'string' || body.message.trim().length > 1000)) throw new ScholarshipError(400, 'Application message must be at most 1000 characters.');
  return mongoose.connection.transaction(async (session) => {
    const student = await lockScholarshipActor(studentId, 'student', session);
    const source = await Opportunity.findOne({ _id: oid, type: 'scholarship' }).session(session); if (!source) throw new ScholarshipError(404, 'Scholarship is no longer accepting applications.');
    await lockScholarshipActor(source.providerId, 'provider', session);
    const opportunity = await Opportunity.findOneAndUpdate({ _id: oid, providerId: source.providerId, type: 'scholarship', status: 'open', applicationDeadline: { $gt: new Date() } }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!opportunity) throw new ScholarshipError(404, 'Scholarship is no longer accepting applications.');
    if (opportunity.scholarshipWithdrawnByAdmin) throw new ScholarshipError(409, 'This scholarship has been withdrawn by moderation.');
    if (await Application.exists({ studentId, opportunityId: opportunity._id }).session(session)) throw new ScholarshipError(409, 'You have already applied to this opportunity.');
    const policy = await policyFor(opportunity._id, session); const eligibility = scholarshipEligibility(student, policy.settings);
    if (!eligibility.eligible) throw new ScholarshipError(409, eligibility.reasons.join(' '));
    if (!policy.timingStart || !policy.timingEnd) await ScholarshipPolicy.findOneAndUpdate({ opportunityId: opportunity._id }, { $setOnInsert: { providerId: opportunity.providerId, settings: policy.settings, revision: policy.revision }, $set: { timingStart: opportunity.createdAt, timingEnd: opportunity.applicationDeadline } }, { upsert: true, runValidators: true, session });
    const versioned = policy.revision > 0;
    const [application] = await Application.create([{ studentId, providerId: opportunity.providerId, opportunityId: opportunity._id, justification, selfDeclaredNeed: body.selfDeclaredNeed, ...(typeof body.message === 'string' ? { message: body.message.trim() } : {}), ...(versioned ? { scholarshipVersion: 1 } : {}), scholarshipRevision: 0 }], { session });
    const review = await ensureScholarshipReview(application, opportunity, session);
    await scholarshipEvent(application, studentId, 'submitted', 'Application submitted for human review; no award decision made.', session, { priorityScore: review.priority.priorityScore, revision: 0 });
    return application;
  }, scholarshipTransactions);
}
export interface ScholarshipDecisionOptions { reason?: unknown; revision?: unknown; priorityOverrideReason?: unknown; requireWaitlisted?: boolean; opportunityId?: string }
export async function prepareScholarshipDecision(application: App, opportunity: Opp, ownerId: Types.ObjectId, next: ApplicationStatus, options: ScholarshipDecisionOptions, session: ClientSession) {
  const expected = scholarshipRevision(options.revision);
  if ((application.scholarshipRevision ?? 0) >= 10000) throw new ScholarshipError(409, 'This application has reached its decision revision limit.');
  if (expected !== undefined && expected !== (application.scholarshipRevision ?? 0)) throw new ScholarshipError(409, 'The application decision changed. Reload before deciding.');
  if (options.opportunityId && String(opportunity._id) !== options.opportunityId) throw new ScholarshipError(404, 'Waitlisted application not found.');
  if (options.requireWaitlisted && application.status !== 'waitlisted') throw new ScholarshipError(409, 'Choose a currently waitlisted application.');
  const review = await ensureScholarshipReview(application, opportunity, session);
  const strict = application.scholarshipVersion === 1 || review.policyRevision > 0;
  if (strict && !scholarshipTransition(application.status, next)) throw new ScholarshipError(409, 'This scholarship decision transition is not allowed.');
  if (await ScholarshipAppeal.exists({ applicationId: application._id, status: 'pending' }).session(session)) throw new ScholarshipError(409, 'Review the pending appeal before changing its decision.');
  const reason = strict ? scholarshipReason(options.reason) : options.reason === undefined ? 'Legacy provider status decision; no reason supplied by the older client.' : scholarshipReason(options.reason);
  const override = options.priorityOverrideReason === undefined ? undefined : scholarshipReason(options.priorityOverrideReason);
  if (options.requireWaitlisted) {
    const ranked = await Application.aggregate([{ $match: { opportunityId: opportunity._id, status: 'waitlisted' } }, { $lookup: { from: ScholarshipReview.collection.name, localField: '_id', foreignField: 'applicationId', as: 'assessment' } }, { $set: { score: { $ifNull: [{ $arrayElemAt: ['$assessment.priority.priorityScore', 0] }, 0] } } }, { $sort: { score: -1, appliedAt: 1, _id: 1 } }, { $limit: 1 }]).session(session);
    if (ranked[0] && String(ranked[0]._id) !== String(application._id) && !override) throw new ScholarshipError(409, 'Choose the first waitlisted applicant or document a priority override.');
  }
  if (next === 'accepted') {
    if (opportunity.scholarshipWithdrawnByAdmin) throw new ScholarshipError(409, 'No further awards may be made from this withdrawn scholarship.');
    const student = await User.findById(application.studentId).session(session); const eligibility = scholarshipEligibility(student ?? undefined, review.policy);
    if (!eligibility.eligible) throw new ScholarshipError(409, eligibility.reasons.join(' '));
    if (review.policy.eligibility.requireEvidence && !await ScholarshipEvidence.exists({ applicationId: application._id }).session(session)) throw new ScholarshipError(409, 'Required confidential supporting evidence has not been submitted.');
    const prior = await previousBenefits(application.studentId, application._id, session);
    if (prior.unclassified) throw new ScholarshipError(409, 'A prior accepted allocation has a missing listing; review those records before awarding.');
    if (duplicateBenefitConflict(review.policy.duplicateBenefitPolicy, prior.benefits)) throw new ScholarshipError(409, 'This student already holds an accepted scholarship restricted by the duplicate-benefit policy.');
    review.awardRestriction = review.policy.duplicateBenefitPolicy; application.awardedAt = new Date();
  } else application.awardedAt = undefined;
  application.waitlistedAt = next === 'waitlisted' ? (application.waitlistedAt ?? new Date()) : undefined;
  application.scholarshipRevision = (application.scholarshipRevision ?? 0) + 1;
  if (strict) application.scholarshipVersion = 1;
  review.decisionReason = reason; review.priorityOverrideReason = override; await review.save({ session });
  await scholarshipEvent(application, ownerId, 'decision', reason, session, { fromStatus: application.status, toStatus: next, revision: application.scholarshipRevision, priorityScore: review.priority.priorityScore, ...(override ? { priorityOverrideReason: override } : {}) });
}
export async function uploadScholarshipEvidence(id: unknown, studentId: Types.ObjectId, body: unknown) {
  const document = validateVerificationDocument(body);
  const sha256 = createHash('sha256').update(document.data).digest('hex');
  return mongoose.connection.transaction(async (session) => {
    await lockScholarshipActor(studentId, 'student', session); const { application } = await scholarshipContext(id, studentId, 'student', session, true);
    if (await ScholarshipEvidence.countDocuments({ applicationId: application._id }).session(session) >= 3) throw new ScholarshipError(409, 'An application supports up to three evidence documents.');
    if (await ScholarshipEvidence.exists({ applicationId: application._id, sha256 }).session(session)) throw new ScholarshipError(409, 'This evidence document is already attached.');
    const [stored] = await ScholarshipEvidence.create([{ applicationId: application._id, studentId, providerId: application.providerId, fileName: document.fileName, contentType: document.contentType, size: document.size, data: document.data, sha256 }], { session });
    await scholarshipEvent(application, studentId, 'evidence_submitted', 'Confidential supporting evidence added.', session, { documentId: stored._id }); return { _id: stored._id, fileName: stored.fileName, contentType: stored.contentType, size: stored.size, createdAt: stored.createdAt };
  }, scholarshipTransactions);
}
export async function readScholarshipEvidence(id: unknown, documentId: unknown, actorId: Types.ObjectId, role: 'student' | 'provider', reason?: unknown) {
  const did = scholarshipId(documentId);
  if (role === 'student') { const { application } = await scholarshipContext(id, actorId, role); const row = await ScholarshipEvidence.findOne({ _id: did, applicationId: application._id, studentId: actorId }).select('+data'); if (!row) throw new ScholarshipError(404, 'Evidence not found.'); return row; }
  const explanation = scholarshipReason(reason);
  return mongoose.connection.transaction(async (session) => {
    await lockScholarshipActor(actorId, role, session); const { application } = await scholarshipContext(id, actorId, role, session, true);
    const row = await ScholarshipEvidence.findOne({ _id: did, applicationId: application._id, providerId: actorId }).select('+data').session(session); if (!row) throw new ScholarshipError(404, 'Evidence not found.');
    await scholarshipEvent(application, actorId, 'evidence_accessed', explanation, session, { documentId: row._id }); return row;
  }, scholarshipTransactions);
}
export async function submitScholarshipAppeal(id: unknown, studentId: Types.ObjectId, body: Record<string, unknown>) {
  const statement = scholarshipReason(body.statement, 30, 2000); const expected = scholarshipRevision(body.revision, true);
  return mongoose.connection.transaction(async (session) => {
    await lockScholarshipActor(studentId, 'student', session); const { application } = await scholarshipContext(id, studentId, 'student', session, true);
    if (!['rejected', 'waitlisted'].includes(application.status)) throw new ScholarshipError(409, 'Only rejected or waitlisted scholarship decisions may be appealed.');
    if ((application.scholarshipRevision ?? 0) !== expected) throw new ScholarshipError(409, 'The decision changed. Reload before appealing.');
    if (await ScholarshipAppeal.exists({ applicationId: application._id, decisionRevision: expected }).session(session)) throw new ScholarshipError(409, 'This decision has already been appealed.');
    if (await ScholarshipAppeal.countDocuments({ applicationId: application._id }).session(session) >= 3) throw new ScholarshipError(409, 'An application supports up to three decision appeals.');
    const [appeal] = await ScholarshipAppeal.create([{ applicationId: application._id, studentId, providerId: application.providerId, decisionRevision: expected, statement, status: 'pending' }], { session });
    await scholarshipEvent(application, studentId, 'appeal_submitted', 'Applicant submitted a confidential appeal for human review.', session, { revision: expected, appealId: appeal._id }); return appeal;
  }, scholarshipTransactions);
}
export async function reviewScholarshipAppeal(id: unknown, appealId: unknown, providerId: Types.ObjectId, body: Record<string, unknown>) {
  const aid = scholarshipId(appealId); const reason = scholarshipReason(body.reason); if (!['upheld', 'reopened'].includes(body.decision as string)) throw new ScholarshipError(400, 'Uphold the decision or reopen human review.');
  return mongoose.connection.transaction(async (session) => {
    await lockScholarshipActor(providerId, 'provider', session); const { application } = await scholarshipContext(id, providerId, 'provider', session, true);
    const appeal = await ScholarshipAppeal.findOne({ _id: aid, applicationId: application._id, providerId }).session(session);
    if (!appeal || appeal.status !== 'pending' || appeal.decisionRevision !== (application.scholarshipRevision ?? 0)) throw new ScholarshipError(409, 'This appeal is no longer awaiting review for the current decision.');
    appeal.status = body.decision as 'upheld' | 'reopened'; appeal.reason = reason; appeal.reviewedAt = new Date(); appeal.reviewerId = providerId;
    if (appeal.status === 'reopened') { application.status = 'reviewed'; application.waitlistedAt = undefined; application.scholarshipRevision = (application.scholarshipRevision ?? 0) + 1; await application.save({ session }); }
    await appeal.save({ session }); await scholarshipEvent(application, providerId, appeal.status === 'upheld' ? 'appeal_upheld' : 'appeal_reopened', reason, session, { revision: application.scholarshipRevision, appealId: appeal._id }); return appeal;
  }, scholarshipTransactions);
}
export async function recalculateScholarshipPriority(id: unknown, providerId: Types.ObjectId, reason: unknown) {
  const explanation = scholarshipReason(reason);
  return mongoose.connection.transaction(async (session) => {
    await lockScholarshipActor(providerId, 'provider', session); const { application, opportunity } = await scholarshipContext(id, providerId, 'provider', session, true);
    const review = await ensureScholarshipReview(application, opportunity, session); const student = await User.findById(application.studentId).session(session); const prior = await previousBenefits(application.studentId, application._id, session);
    const count = prior.benefits.filter((benefit) => review.policy.duplicateBenefitPolicy === 'lifetime' || benefit.appliedAt >= academicYearStart()).length;
    review.priority = scholarshipPriority(application.selfDeclaredNeed, student ?? undefined, opportunity, review.policy, count, application.appliedAt, review.timingStart, review.timingEnd); review.calculatedAt = new Date(); await review.save({ session });
    await scholarshipEvent(application, providerId, 'priority_recalculated', explanation, session, { priorityScore: review.priority.priorityScore }); return review;
  }, scholarshipTransactions);
}
/** Keep financial source records reachable when a listing is removed from discovery. */
export async function removeScholarshipAwareListing(id: unknown, actorId: Types.ObjectId, actorRole: 'provider' | 'admin') {
  const oid = scholarshipId(id);
  return mongoose.connection.transaction(async (session) => {
    if (actorRole === 'provider') await lockScholarshipActor(actorId, 'provider', session);
    else if (!await User.findOneAndUpdate({ _id: actorId, role: 'admin', accountStatus: 'active' }, { $inc: { __v: 1 } }, { session, timestamps: false })) throw new ScholarshipError(403, 'An active administrator account is required.');
    const listing = await Opportunity.findOneAndUpdate({ _id: oid, ...(actorRole === 'provider' ? { providerId: actorId } : {}) }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!listing) throw new ScholarshipError(404, 'Opportunity not found.');
    if (listing.type === 'scholarship' && await Application.exists({ opportunityId: listing._id }).session(session)) {
      if (actorRole === 'provider') throw new ScholarshipError(409, 'Close this scholarship instead of deleting its application and allocation history.');
      listing.status = 'closed'; listing.scholarshipWithdrawnByAdmin = true;
      await Opportunity.updateOne({ _id: listing._id }, { $set: { status: 'closed', scholarshipWithdrawnByAdmin: true } }, { session, runValidators: true }); return { listing, retained: true };
    }
    await Opportunity.deleteOne({ _id: listing._id }, { session }); return { listing, retained: false };
  }, scholarshipTransactions);
}
