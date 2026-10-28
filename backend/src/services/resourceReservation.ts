import { Types } from 'mongoose';
import Resource from '../models/Resource';
import ResourceRequest, { ResourceRequestStatus } from '../models/ResourceRequest';
import User from '../models/User';
import { allocationDates, resourceId, resourceRevision, resourceText, returnPolicy, ResourceReservationError } from './resourcePolicy';
import { assertResourceOpen, lockResourceContext, noResourceDispute, resourceEvent, resourceTransaction } from './resourceLifecycle';
export { ResourceReservationError } from './resourcePolicy';

export type ResourceRequestDecision = Exclude<ResourceRequestStatus, 'pending' | 'cancelled'>;
export function isResourceRequestDecision(value: unknown): value is ResourceRequestDecision {
  return typeof value === 'string' && ['accepted', 'rejected', 'completed', 'waitlisted'].includes(value);
}
export function canTransitionResourceRequest(current: ResourceRequestStatus, next: ResourceRequestStatus): boolean {
  return (current === 'pending' && ['accepted', 'rejected', 'waitlisted'].includes(next)) ||
    (current === 'waitlisted' && ['accepted', 'rejected'].includes(next)) || (current === 'accepted' && next === 'completed');
}
type DecisionOptions = { reason?: unknown; revision?: unknown; startAt?: unknown; dueAt?: unknown; requireWaitlisted?: boolean; resourceId?: unknown; priorityOverrideReason?: unknown };

/** One reserved unit and its allocation/history commit together. */
export async function transitionResourceRequest(requestId: unknown, ownerId: Types.ObjectId, next: unknown, options: DecisionOptions = {}) {
  const id = resourceId(requestId);
  if (!isResourceRequestDecision(next)) throw new ResourceReservationError(400, 'Invalid status update.');
  return resourceTransaction(async session => {
    const { row: request, resource: source } = await lockResourceContext(id, ownerId, session, true);
    if (!canTransitionResourceRequest(request.status, next)) throw new ResourceReservationError(409, 'This request has already been processed or cannot change to that status.');
    resourceRevision(options.revision, request.revision ?? 0, options.requireWaitlisted === true);
    const reason = options.reason === undefined && next !== 'waitlisted' && !options.requireWaitlisted ? 'Legacy owner status decision; no reason supplied by the older client.' : resourceText(options.reason, 'Decision reason');
    const override = options.priorityOverrideReason === undefined ? undefined : resourceText(options.priorityOverrideReason, 'Priority override reason');
    await noResourceDispute(request, session);
    if (options.requireWaitlisted) {
      if (request.status !== 'waitlisted' || String(request.resourceId) !== resourceId(options.resourceId)) throw new ResourceReservationError(409, 'This request is not on the selected resource waitlist.');
      const first = await ResourceRequest.findOne({ resourceId: request.resourceId, status: 'waitlisted' }).sort({ 'prioritySnapshot.priorityScore': -1, createdAt: 1, _id: 1 }).session(session);
      if (!first?._id.equals(request._id) && !override) throw new ResourceReservationError(409, 'Advancing outside ranked order requires a priority override reason.');
    }
    let allocation = request.allocation;
    let quantityAfter = source.quantityAvailable;
    if (next === 'accepted') {
      const student = await User.findOne({ _id: request.studentId, role: 'student', accountStatus: { $ne: 'suspended' } }).session(session);
      if (!student) throw new ResourceReservationError(409, 'The student account is no longer eligible for approval.');
      const existing = await ResourceRequest.exists({ studentId: request.studentId, resourceCategory: request.resourceCategory, status: 'accepted', _id: { $ne: request._id } }).session(session);
      if (existing) throw new ResourceReservationError(409, 'This student already holds an accepted resource in this category.');
      assertResourceOpen(source);
      if (!Number.isSafeInteger(source.quantityAvailable) || source.quantityAvailable < 1 || source.quantityAvailable > 1_000_000) throw new ResourceReservationError(409, 'This resource needs valid whole-unit stock before allocation.');
      const startAt = options.startAt ?? (request.requestedStartAt && request.requestedStartAt > new Date() ? request.requestedStartAt.toISOString() : undefined);
      const dueAt = options.dueAt ?? request.requestedReturnAt?.toISOString();
      allocation = allocationDates(source, startAt, dueAt);
      const resource = await Resource.findOneAndUpdate({
        _id: request.resourceId, listedBy: ownerId, category: request.resourceCategory,
        accessType: request.requestedAccessType, status: 'available', quantityAvailable: { $gte: 1 },
      }, { $inc: { quantityAvailable: -1, inventoryRevision: 1 } }, { new: true, session });
      if (!resource) throw new ResourceReservationError(409, 'This resource is no longer available to reserve.');
      quantityAfter = resource.quantityAvailable;
      if (resource.quantityAvailable === 0) { resource.status = 'claimed'; await resource.save({ session }); }
    }
    if (next === 'completed' && (allocation?.returnRequired ?? returnPolicy(source).returnRequired)) throw new ResourceReservationError(409, 'Returnable property requires a borrower return request and owner confirmation.');
    const updated = await ResourceRequest.findOneAndUpdate({ _id: request._id, providerId: ownerId, status: request.status }, {
      $set: { status: next, revision: (request.revision ?? 0) + 1, ...(allocation ? { allocation } : {}), ...(next === 'waitlisted' ? { waitlistedAt: new Date() } : {}) },
    }, { new: true, runValidators: true, session });
    if (!updated) throw new ResourceReservationError(409, 'The request changed while it was being processed.');
    await resourceEvent(session, ownerId, source, updated, next, { reason, fromStatus: request.status, toStatus: next, ...(override ? { priorityOverrideReason: override } : {}), quantityBefore: source.quantityAvailable, quantityAfter });
    return updated;
  });
}
