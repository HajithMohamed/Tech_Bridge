import type { Aggregate, ClientSession, PipelineStage } from 'mongoose';
import { Types } from 'mongoose';
import Application from '../models/Application';
import Opportunity from '../models/Opportunity';
import Resource from '../models/Resource';
import ResourceRequest from '../models/ResourceRequest';
import User from '../models/User';
import { Mentorship } from '../models/Mentorship';
import PromotionRequest from '../models/PromotionRequest';
import { ScholarshipEvent } from '../models/Scholarship';
import { ResourceEvent } from '../models/ResourceActivity';
import { analyticsScope, cohortMatch, type AnalyticsRole, type AnalyticsWindow } from './analyticsPolicy';

type AggregateSource = { aggregate<T>(pipeline: PipelineStage[]): Aggregate<T[]> };
export type Facets = Record<string, { _id?: unknown; count: number; units?: number }[]>;
export const aggregateAnalytics = <T>(model: AggregateSource, stages: PipelineStage[], session: ClientSession) => model.aggregate<T>(stages).session(session).option({ maxTimeMS: 5000, allowDiskUse: false });
export const grouped = (field: string): PipelineStage.FacetPipelineStage[] => [{ $group: { _id: `$${field}`, count: { $sum: 1 } } }];
export const counted = (match: Record<string, unknown> = {}): PipelineStage.FacetPipelineStage[] => [{ $match: match }, { $count: 'count' }];
export const numeric = (facets: Facets, key: string, field: 'count' | 'units' = 'count') => {
  const value = facets[key]?.[0]?.[field] ?? 0;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid analytics count.');
  return value;
};
const acceptedStudents: PipelineStage.FacetPipelineStage[] = [{ $match: { status: 'accepted', studentId: { $type: 'objectId' } } }, { $group: { _id: '$studentId' } }, { $count: 'count' }];
const verifiedOwner = { role: 'provider', accountStatus: { $ne: 'suspended' }, 'providerProfile.verified': true, 'providerProfile.verificationStatus': 'VERIFIED', $or: [{ requiresEmailVerification: { $ne: true } }, { emailVerifiedAt: { $type: 'date' } }] };
export function publicOwnerStages(field: string): PipelineStage[] {
  return [
    { $lookup: { from: User.collection.name, localField: field, foreignField: '_id', pipeline: [{ $match: verifiedOwner }, { $project: { _id: 1 } }], as: 'publishedOwner' } },
    { $match: { 'publishedOwner.0': { $exists: true } } },
  ];
}
export const openOpportunityMatch = (now: Date) => ({ status: 'open', applicationDeadline: { $gt: now }, scholarshipWithdrawnByAdmin: { $ne: true }, opportunityWithdrawnByAdmin: { $ne: true } });
export const availableResourceMatch = (now: Date) => ({ status: 'available', quantityAvailable: { $gt: 0 }, availabilityPaused: { $ne: true }, withdrawnByAdmin: { $ne: true }, $and: [
  { $or: [{ accessType: { $ne: 'donation' } }, { 'accessDetails.donation.claimDeadline': null }, { 'accessDetails.donation.claimDeadline': { $gt: now } }] },
  { $or: [{ accessType: { $ne: 'sponsorship' } }, { 'accessDetails.sponsorship.applicationDeadline': null }, { 'accessDetails.sponsorship.applicationDeadline': { $gt: now } }] },
] });
export const opportunityStatusExpression = (now: Date) => ({ $cond: [
  { $or: [{ $eq: ['$scholarshipWithdrawnByAdmin', true] }, { $eq: ['$opportunityWithdrawnByAdmin', true] }] }, 'closed',
  { $cond: [{ $and: [{ $eq: ['$status', 'open'] }, { $lte: ['$applicationDeadline', now] }] }, 'expired', '$status'] },
] });

export function applicationStages(role: AnalyticsRole, actorId: Types.ObjectId, window: AnalyticsWindow): PipelineStage[] {
  return [
    { $match: analyticsScope(role, actorId, window, role === 'student' ? 'studentId' : 'providerId', 'appliedAt') },
    { $lookup: { from: Opportunity.collection.name, localField: 'opportunityId', foreignField: '_id', pipeline: [{ $project: { providerId: 1, type: 1, title: 1 } }], as: 'source' } },
    { $unwind: { path: '$source', preserveNullAndEmptyArrays: true } },
    { $set: { sourceValid: { $and: [{ $eq: [{ $type: '$source.providerId' }, 'objectId'] }, { $eq: ['$source.providerId', '$providerId'] }] } } },
    ...(role === 'provider' ? [{ $match: { sourceValid: true } } as PipelineStage] : []),
    { $set: { sourceType: { $cond: ['$sourceValid', '$source.type', 'unknown'] } } },
  ];
}
export async function applicationMetrics(role: AnalyticsRole, id: Types.ObjectId, window: AnalyticsWindow, now: Date, session: ClientSession) {
  const [result] = await aggregateAnalytics<Facets>(Application, [
    ...applicationStages(role, id, window),
    { $lookup: { from: ScholarshipEvent.collection.name, let: { app: '$_id', listing: '$opportunityId', revision: '$scholarshipRevision', owner: '$providerId', kind: '$sourceType' }, pipeline: [
      { $match: { action: 'decision', toStatus: 'accepted', createdAt: { $lte: now }, $expr: { $and: [{ $eq: ['$$kind', 'scholarship'] }, { $eq: ['$applicationId', '$$app'] }, { $eq: ['$opportunityId', '$$listing'] }, { $eq: ['$revision', '$$revision'] }, { $eq: ['$actorId', '$$owner'] }] } } },
      { $limit: 1 }, { $project: { _id: 1 } },
    ], as: 'awardDecision' } },
    { $set: { confirmedAward: { $and: [{ $eq: ['$status', 'accepted'] }, { $eq: ['$sourceType', 'scholarship'] }, { $eq: [{ $type: '$awardedAt' }, 'date'] }, { $lte: ['$awardedAt', now] }, { $isNumber: '$scholarshipRevision' }, { $gt: [{ $size: '$awardDecision' }, 0] }] } } },
    { $facet: { statuses: grouped('status'), scholarships: [{ $match: { sourceType: 'scholarship' } }, ...grouped('status')], confirmedAwards: counted({ confirmedAward: true }), legacyAwards: counted({ sourceType: 'scholarship', status: 'accepted', confirmedAward: false }), unavailableSources: counted({ sourceValid: false }), acceptedStudents } },
  ], session);
  return result;
}
export function resourceRequestStages(role: AnalyticsRole, id: Types.ObjectId, window: AnalyticsWindow): PipelineStage[] {
  return [
    { $match: analyticsScope(role, id, window, role === 'student' ? 'studentId' : 'providerId') },
    { $lookup: { from: Resource.collection.name, localField: 'resourceId', foreignField: '_id', pipeline: [{ $project: { listedBy: 1, itemName: 1 } }], as: 'source' } },
    { $unwind: { path: '$source', preserveNullAndEmptyArrays: true } },
    { $set: { sourceValid: { $and: [{ $eq: [{ $type: '$source.listedBy' }, 'objectId'] }, { $eq: ['$source.listedBy', '$providerId'] }] } } },
    ...(role === 'provider' ? [{ $match: { sourceValid: true } } as PipelineStage] : []),
  ];
}
export async function resourceRequestMetrics(role: AnalyticsRole, id: Types.ObjectId, window: AnalyticsWindow, now: Date, session: ClientSession) {
  const [result] = await aggregateAnalytics<Facets>(ResourceRequest, [
    ...resourceRequestStages(role, id, window),
    { $lookup: { from: ResourceEvent.collection.name, let: { request: '$_id', resource: '$resourceId', owner: '$providerId' }, pipeline: [
      { $match: { $or: [{ action: 'accepted', toStatus: 'accepted' }, { action: 'return_confirmed', legacyReservationConfirmed: true }], $expr: { $and: [{ $eq: ['$requestId', '$$request'] }, { $eq: ['$resourceId', '$$resource'] }, { $eq: ['$actorId', '$$owner'] }] } } }, { $limit: 1 }, { $project: { _id: 1 } },
    ], as: 'allocationEvent' } },
    { $set: { confirmedAllocation: { $and: ['$sourceValid', { $in: ['$status', ['accepted', 'completed']] }, { $eq: ['$allocation.inventoryReserved', true] }, { $eq: ['$allocation.accessType', '$requestedAccessType'] }, { $gt: [{ $size: '$allocationEvent' }, 0] }] } } },
    { $facet: { statuses: grouped('status'), allocations: counted({ confirmedAllocation: true }), currentAllocations: counted({ confirmedAllocation: true, status: 'accepted', inventoryRestoredAt: null }), returnsConfirmed: counted({ confirmedAllocation: true, status: 'completed', returnedAt: { $type: 'date' }, inventoryRestoredAt: { $type: 'date' } }), overdue: counted({ confirmedAllocation: true, status: 'accepted', 'allocation.returnRequired': true, 'allocation.dueAt': { $lt: now }, inventoryRestoredAt: null }), legacyAllocations: counted({ status: { $in: ['accepted', 'completed'] }, confirmedAllocation: false }), unavailableSources: counted({ sourceValid: false }), acceptedStudents: [{ $match: { status: { $in: ['accepted', 'completed'] } } }, { $group: { _id: '$studentId' } }, { $count: 'count' }], allocatedStudents: [{ $match: { confirmedAllocation: true } }, { $group: { _id: '$studentId' } }, { $count: 'count' }] } },
  ], session); return result;
}
export async function opportunityMetrics(role: AnalyticsRole, id: Types.ObjectId, window: AnalyticsWindow, now: Date, session: ClientSession) {
  const [result] = await aggregateAnalytics<Facets>(Opportunity, [
    { $match: { ...cohortMatch(window), ...(role === 'provider' ? { providerId: id } : {}) } },
    { $set: { effectiveStatus: opportunityStatusExpression(now) } },
    { $facet: { statuses: grouped('effectiveStatus'), kinds: grouped('type'), discoverable: [{ $match: openOpportunityMatch(now) }, ...(role === 'admin' ? publicOwnerStages('providerId') as PipelineStage.FacetPipelineStage[] : []), { $count: 'count' }], expiringSoon: counted({ ...openOpportunityMatch(now), applicationDeadline: { $gt: now, $lte: new Date(now.getTime() + 7 * 86400000) } }), views: [{ $group: { _id: null, count: { $sum: { $cond: [{ $isNumber: '$views' }, { $max: [0, { $floor: '$views' }] }, 0] } } } }] } },
  ], session); return result;
}
export async function resourceListingMetrics(role: AnalyticsRole, id: Types.ObjectId, window: AnalyticsWindow, now: Date, session: ClientSession) {
  const [result] = await aggregateAnalytics<Facets>(Resource, [
    { $match: { ...cohortMatch(window), ...(role === 'provider' ? { listedBy: id } : {}) } },
    { $facet: { accessTypes: grouped('accessType'), available: [{ $match: availableResourceMatch(now) }, ...(role === 'admin' ? publicOwnerStages('listedBy') as PipelineStage.FacetPipelineStage[] : []), { $group: { _id: null, count: { $sum: 1 }, units: { $sum: '$quantityAvailable' } } }] } },
  ], session); return result;
}
export async function mentorshipMetrics(role: AnalyticsRole, id: Types.ObjectId, window: AnalyticsWindow, now: Date, session: ClientSession) {
  const [result] = await aggregateAnalytics<Facets>(Mentorship, [
    { $match: { ...cohortMatch(window), ...(role === 'student' ? { $or: [{ studentId: id }, { mentorId: id }] } : role === 'provider' ? { mentorId: id } : {}) } },
    { $facet: { statuses: grouped('status'), upcoming: counted({ status: 'scheduled', 'appointment.startAt': { $gt: now } }) } },
  ], session); return result;
}
export async function campaignMetrics(role: AnalyticsRole, id: Types.ObjectId, window: AnalyticsWindow, session: ClientSession) {
  const [result] = await aggregateAnalytics<Facets>(PromotionRequest, [
    { $match: { ...analyticsScope(role, id, window, role === 'student' ? 'studentId' : 'providerId'), ...(role === 'student' ? { stage: { $ne: 'draft' } } : {}) } },
    { $set: { effectiveStage: { $ifNull: ['$stage', { $cond: [{ $eq: ['$status', 'accepted'] }, { $switch: { branches: [{ case: { $eq: ['$deliveryStatus', 'submitted'] }, then: 'submitted' }, { case: { $eq: ['$deliveryStatus', 'changes_requested'] }, then: 'changes_requested' }, { case: { $eq: ['$deliveryStatus', 'approved'] }, then: 'reviewed' }], default: 'accepted' } }, '$status'] }] } } },
    { $facet: { stages: grouped('effectiveStage') } },
  ], session); return result;
}
export async function discoveryMetrics(window: AnalyticsWindow, now: Date, session: ClientSession) {
  const [opportunities] = await aggregateAnalytics<{ count: number }>(Opportunity, [{ $match: { ...cohortMatch(window), ...openOpportunityMatch(now) } }, ...publicOwnerStages('providerId'), { $count: 'count' }], session);
  const resources = await aggregateAnalytics<{ _id: string; count: number }>(Resource, [{ $match: { ...cohortMatch(window), ...availableResourceMatch(now) } }, ...publicOwnerStages('listedBy'), ...grouped('accessType')], session);
  return { openOpportunities: opportunities?.count ?? 0, resources };
}
