import mongoose, { Types, type ClientSession } from 'mongoose';
import User, { type IUser } from '../models/User';
import Opportunity from '../models/Opportunity';
import { SavedOpportunity } from '../models/OpportunityActivity';
import { opportunityDate, opportunityObject, opportunitySearch } from './opportunityPolicy';
import { opportunityTransactions, publicOpportunityProviderStages } from './opportunityDiscovery';
import { ScholarshipError } from './scholarshipPolicy';
import { canonicalInterest, opportunityClassification, personalizedScore, recommendationProfilePatch, recommendationProfileSelection, recommendationTags, recommendationWeights, type RecommendationListing } from './recommendationPolicy';

async function currentStudent(id: Types.ObjectId, tokenVersion: number, session?: ClientSession) {
  const student = await User.findById(id).select(`+tokenVersion ${recommendationProfileSelection}`).session(session ?? null);
  if (!student || (student.tokenVersion ?? 0) !== tokenVersion) throw new ScholarshipError(401, 'Your session changed. Please sign in again.');
  if (student.role !== 'student' || student.accountStatus === 'suspended' || (student.requiresEmailVerification && !student.emailVerifiedAt)) throw new ScholarshipError(403, 'An active student account and any required email verification are needed.');
  return student;
}
export function recommendationProfileView(student: Pick<IUser, 'studentProfile'>) {
  const profile = student.studentProfile;
  const preferences = profile?.recommendationPreferences;
  return {
    revision: preferences?.revision ?? 0, personalizationEnabled: preferences?.personalizationEnabled !== false,
    degree: profile?.degree ?? null, studyYear: profile?.studyYear ?? null, skills: profile?.skills ?? [],
    location: profile?.location ?? '', careerGoal: profile?.careerGoal ?? '', specialization: profile?.specialization ?? '',
    careerInterests: profile?.careerInterests ?? [], extracurricularActivities: profile?.extracurricularActivities ?? [],
    preferredOpportunityTypes: preferences?.preferredOpportunityTypes ?? [], preferredWorkArrangements: preferences?.preferredWorkArrangements ?? [],
    preferredEmploymentArrangements: preferences?.preferredEmploymentArrangements ?? [], preferredLocations: preferences?.preferredLocations ?? [],
    careerStagePreference: preferences?.careerStagePreference ?? 'either',
  };
}
export async function getRecommendationProfile(id: Types.ObjectId, tokenVersion: number) {
  return recommendationProfileView(await currentStudent(id, tokenVersion));
}
export async function updateRecommendationProfile(id: Types.ObjectId, tokenVersion: number, body: unknown) {
  const { revision, fields } = recommendationProfilePatch(body);
  return mongoose.connection.transaction(async session => {
    await currentStudent(id, tokenVersion, session);
    const revisionPath = 'studentProfile.recommendationPreferences.revision';
    const updated = await User.findOneAndUpdate({ _id: id, role: 'student', accountStatus: { $ne: 'suspended' },
      $or: [{ [revisionPath]: revision }, ...(revision === 0 ? [{ [revisionPath]: { $exists: false } }] : [])],
    }, { $set: fields, $inc: { [revisionPath]: 1, __v: 1 } }, { new: true, runValidators: true, session }).select(recommendationProfileSelection);
    if (!updated) throw new ScholarshipError(409, 'Recommendation preferences changed. Refresh before saving again.');
    return recommendationProfileView(updated);
  }, opportunityTransactions);
}

type ListingRow = RecommendationListing & { _id: Types.ObjectId; createdAt: Date; applicationDeadline: Date };
type FeedRow = ListingRow & {
  recommendation: ReturnType<typeof personalizedScore> | null;
  classification: ReturnType<typeof opportunityClassification>; saved: boolean;
  source: { kind: string; name: string; detailPath: string };
  eligibility: { status: string; checkPath: string; advisory: string };
};
export async function personalizedOpportunities(id: Types.ObjectId, tokenVersion: number, value: unknown, now = new Date()) {
  const query = opportunityObject(value, ['view', 'department', 'interest', 'activity', 'source', 'asOf', 'revision', 'type', 'skill', 'workMode', 'q', 'location', 'providerId', 'deadlineFrom', 'deadlineTo', 'isPaid', 'isFree', 'page', 'limit', 'sort']);
  const view = query.view ?? 'recommended';
  if (!['recommended', 'all', 'ICT', 'ET', 'BST', 'interdisciplinary', 'saved'].includes(view as string)) throw new ScholarshipError(400, 'Select a supported opportunity view.');
  if (query.source !== undefined && query.source !== 'techbridge') throw new ScholarshipError(400, 'Only TechBridge listings are enabled.');
  if (query.department !== undefined && !['ICT', 'ET', 'BST'].includes(query.department as string)) throw new ScholarshipError(400, 'Select a supported department.');
  const requestedSort = query.sort ?? 'recommended';
  if (!['recommended', 'newest', 'deadline'].includes(requestedSort as string)) throw new ScholarshipError(400, 'Select recommended, newest or deadline sorting.');
  const anchor = query.asOf === undefined ? now : opportunityDate(query.asOf);
  if (anchor.getTime() > now.getTime() || now.getTime() - anchor.getTime() > 86400_000) throw new ScholarshipError(400, 'Feed anchors must be within the last 24 hours.');
  if (query.revision !== undefined && (typeof query.revision !== 'string' || !/^\d{1,15}$/.test(query.revision))) throw new ScholarshipError(400, 'Invalid recommendation revision.');
  const base = Object.fromEntries(Object.entries(query).filter(([key]) => ['type', 'skill', 'workMode', 'q', 'location', 'providerId', 'deadlineFrom', 'deadlineTo', 'isPaid', 'isFree', 'page', 'limit'].includes(key)));
  const { filter, page, limit } = opportunitySearch(base, now, true);
  filter.createdAt = { $lte: anchor };
  const weights = recommendationWeights();
  const interest = query.interest === undefined ? undefined : canonicalInterest(recommendationTags([query.interest], 1)[0]);
  const activity = query.activity === undefined ? undefined : canonicalInterest(recommendationTags([query.activity], 1)[0]);
  return mongoose.connection.transaction(async session => {
    const student = await currentStudent(id, tokenVersion, session);
    const revision = student.studentProfile?.recommendationPreferences?.revision ?? 0;
    if (query.revision !== undefined && Number(query.revision) !== revision) throw new ScholarshipError(409, 'Recommendation preferences changed. Restart the feed.');
    const personalized = view !== 'all' && student.studentProfile?.recommendationPreferences?.personalizationEnabled !== false;
    const sort = requestedSort === 'recommended' && !personalized ? 'newest' : requestedSort;
    const saved = await SavedOpportunity.find({ studentId: id }).select('opportunityId').limit(501).session(session).lean();
    if (saved.length > 500) throw new ScholarshipError(503, 'Saved opportunity data needs review.');
    const savedIds = new Set(saved.map(row => String(row.opportunityId)));
    if (view === 'saved') filter._id = { $in: saved.map(row => row.opportunityId) };
    const ranked: FeedRow[] = []; const keep = page * limit; let total = 0; let scanned = 0;
    const started = performance.now();
    const compare = (a: FeedRow, b: FeedRow) => {
      if (sort === 'recommended') {
        // Recommended sorting is selected only when both rows are personalized.
        const aMatch = a.recommendation!; const bMatch = b.recommendation!;
        const tier = aMatch.tier - bMatch.tier; if (tier) return tier;
        if (aMatch.coldStart && bMatch.coldStart && aMatch.entryLevel !== bMatch.entryLevel) return aMatch.entryLevel ? -1 : 1;
        const score = bMatch.orderingScore - aMatch.orderingScore; if (score) return score;
      }
      if (sort === 'deadline') { const deadline = new Date(a.applicationDeadline).getTime() - new Date(b.applicationDeadline).getTime(); if (deadline) return deadline; }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || String(b._id).localeCompare(String(a._id));
    };
    const cursor = Opportunity.aggregate<ListingRow>([{ $match: filter }, ...publicOpportunityProviderStages(), { $project: {
      _id: 1, title: 1, description: 1, type: 1, requiredSkills: 1, location: 1, workMode: 1, createdAt: 1, applicationDeadline: 1,
      providerId: 1, providerCredibility: 1, status: 1, preferredAcademicBackground: 1,
      'recommendationMetadata.departments': 1, 'recommendationMetadata.interests': 1, 'recommendationMetadata.activities': 1,
      'recommendationMetadata.studyYears': 1, 'recommendationMetadata.careerStage': 1, 'recommendationMetadata.employmentArrangement': 1,
    } }]).session(session).option({ maxTimeMS: 5000, allowDiskUse: false }).cursor({ batchSize: 100 });
    try {
      for await (const row of cursor) {
        if (++scanned > 10000 || performance.now() - started > 10000) throw new ScholarshipError(503, 'The feed is too large. Narrow your search and try again.');
        const classification = opportunityClassification(row);
        const department = query.department ?? (['ICT', 'ET', 'BST'].includes(view as string) ? view : undefined);
        if (department && !classification.departments.includes(department as string)) continue;
        if (view === 'interdisciplinary' && !classification.interdisciplinary) continue;
        if (interest && !classification.interests.includes(interest)) continue;
        if (activity && !classification.interests.includes(activity)) continue;
        total++;
        const recommendation = personalized ? personalizedScore(student.studentProfile, row, anchor, weights) : null;
        const scored = { ...row, recommendation, classification, saved: savedIds.has(String(row._id)),
          source: { kind: 'techbridge', name: 'TechBridge', detailPath: `/opportunities/${row._id}` },
          eligibility: { status: 'not_evaluated', checkPath: `/api/opportunities/${row._id}/eligibility`, advisory: 'Relevance is not eligibility or guaranteed acceptance.' },
        };
        if (ranked.length === keep && compare(scored, ranked[ranked.length - 1]) >= 0) continue;
        let low = 0; let high = ranked.length;
        while (low < high) { const mid = (low + high) >>> 1; if (compare(scored, ranked[mid]) < 0) high = mid; else low = mid + 1; }
        ranked.splice(low, 0, scored); if (ranked.length > keep) ranked.pop();
      }
    } finally { await cursor.close(); }
    const opportunities = ranked.slice((page - 1) * limit).map(row => {
      if (row.recommendation) { const { orderingScore, coldStart, entryLevel, classification, ...recommendation } = row.recommendation; return { ...row, recommendation }; }
      return row;
    });
    const profile = student.studentProfile;
    const incomplete = !profile?.degree || !profile.studyYear || !profile.skills?.length || (!profile.careerInterests?.length && !profile.extracurricularActivities?.length);
    return { opportunities, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), asOf: anchor.toISOString(), revision,
      personalized, sort, method: 'rules', version: 3,
      profileCompletion: { suggested: incomplete, message: incomplete ? 'Add your interests, extracurricular activities and skills to improve recommendations. Browsing remains available.' : null },
    };
  }, opportunityTransactions);
}
