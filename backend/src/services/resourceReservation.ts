import mongoose, { Types } from 'mongoose';
import Resource from '../models/Resource';
import ResourceRequest, { ResourceRequestStatus } from '../models/ResourceRequest';
import User from '../models/User';

export type ResourceRequestDecision = Exclude<ResourceRequestStatus, 'pending'>;

export class ResourceReservationError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}

export function isResourceRequestDecision(value: unknown): value is ResourceRequestDecision {
  return typeof value === 'string' && ['accepted', 'rejected', 'completed'].includes(value);
}

export function canTransitionResourceRequest(current: ResourceRequestStatus, next: ResourceRequestStatus): boolean {
  return (current === 'pending' && (next === 'accepted' || next === 'rejected')) ||
    (current === 'accepted' && next === 'completed');
}

/** Inventory and request state commit together; unsupported databases fail closed. */
export async function transitionResourceRequest(requestId: unknown, ownerId: Types.ObjectId, next: unknown) {
  if (typeof requestId !== 'string' || !Types.ObjectId.isValid(requestId)) {
    throw new ResourceReservationError(400, 'Invalid request ID.');
  }
  if (!isResourceRequestDecision(next)) throw new ResourceReservationError(400, 'Invalid status update.');

  return mongoose.connection.transaction(async (session) => {
    const request = await ResourceRequest.findOne({ _id: requestId, providerId: ownerId }).session(session);
    if (!request) throw new ResourceReservationError(404, 'Request not found.');
    if (!canTransitionResourceRequest(request.status, next)) {
      throw new ResourceReservationError(409, 'This request has already been processed or cannot change to that status.');
    }

    if (next === 'accepted') {
      // Updating the existing version counter serializes approvals for this student,
      // including approvals against different resources in the same category.
      // Concurrent transactions retry against a fresh snapshot after a write conflict.
      const student = await User.updateOne(
        { _id: request.studentId, role: 'student', accountStatus: { $ne: 'suspended' } },
        { $inc: { __v: 1 } }, { session, timestamps: false }
      );
      if (student.matchedCount !== 1) {
        throw new ResourceReservationError(409, 'The student account is no longer eligible for approval.');
      }
      const existing = await ResourceRequest.exists({
        studentId: request.studentId, resourceCategory: request.resourceCategory,
        status: 'accepted', _id: { $ne: request._id },
      }).session(session);
      if (existing) throw new ResourceReservationError(409, 'This student already holds an accepted resource in this category.');

      const resource = await Resource.findOneAndUpdate({
        _id: request.resourceId, listedBy: ownerId, category: request.resourceCategory,
        accessType: request.requestedAccessType, status: 'available', quantityAvailable: { $gte: 1 },
      }, { $inc: { quantityAvailable: -1 } }, { new: true, session });
      if (!resource) throw new ResourceReservationError(409, 'This resource is no longer available to reserve.');
      if (resource.quantityAvailable === 0) {
        resource.status = 'claimed';
        await resource.save({ session });
      }
    }

    const updated = await ResourceRequest.findOneAndUpdate(
      { _id: request._id, providerId: ownerId, status: request.status },
      { $set: { status: next } }, { new: true, runValidators: true, session }
    );
    if (!updated) throw new ResourceReservationError(409, 'The request changed while it was being processed.');
    return updated;
  }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 });
}
