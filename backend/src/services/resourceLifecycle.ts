import mongoose, { ClientSession, Types } from 'mongoose';
import Resource from '../models/Resource';
import ResourceRequest, { IResourceRequest } from '../models/ResourceRequest';
import User from '../models/User';
import AuditLog from '../models/AuditLog';
import { ResourceDispute, ResourceEvent } from '../models/ResourceActivity';
import { allocationDates, resourceDate, resourceId, resourcePriority, resourceRevision, resourceText, returnPolicy, ResourceReservationError } from './resourcePolicy';

export const resourceTransaction = <T>(work: (session: ClientSession) => Promise<T>) => mongoose.connection.transaction(work, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 });
export async function lockResourceActor(id: Types.ObjectId, session: ClientSession, admin = false) {
  const actor = await User.findById(id).session(session);
  if (!actor || actor.accountStatus === 'suspended' || (admin ? actor.role !== 'admin' : !['student', 'provider', 'admin'].includes(actor.role)) || (actor.role === 'provider' && (actor.providerProfile?.verified !== true || actor.providerProfile.verificationStatus !== 'VERIFIED'))) throw new ResourceReservationError(403, 'An active authorized resource account is required.');
  await User.updateOne({ _id: actor._id }, { $inc: { __v: 1 } }, { session, timestamps: false });
  return actor;
}
export async function resourceContext(idValue: unknown, actorId: Types.ObjectId, session?: ClientSession) {
  const row = await ResourceRequest.findOne({ _id: resourceId(idValue), $or: [{ studentId: actorId }, { providerId: actorId }] }).session(session ?? null);
  if (!row) throw new ResourceReservationError(404, 'Resource request not found.');
  const resource = await Resource.findById(row.resourceId).session(session ?? null);
  if (!resource || (!row.studentId.equals(actorId) && !resource.listedBy.equals(actorId))) throw new ResourceReservationError(row.providerId.equals(actorId) ? 409 : 404, 'The source resource ownership needs review.');
  return { row, resource, owner: row.providerId.equals(actorId) && resource.listedBy.equals(actorId) };
}
export async function lockResourceContext(idValue: unknown, actorId: Types.ObjectId, session: ClientSession, ownerOnly = false) {
  const context = await resourceContext(idValue, actorId, session);
  if (ownerOnly && !context.owner) throw new ResourceReservationError(404, 'Resource request not found.');
  await lockResourceActor(actorId, session);
  // All category-changing decisions share the original student coordination lock.
  // A suspended/deleted borrower may still return property; only allocations require eligibility.
  if (!context.row.studentId.equals(actorId)) await User.updateOne({ _id: context.row.studentId }, { $inc: { __v: 1 } }, { session, timestamps: false });
  await Resource.updateOne({ _id: context.resource._id }, { $inc: { __v: 1 } }, { session, timestamps: false });
  return context;
}
export async function resourceEvent(session: ClientSession, actorId: Types.ObjectId, resource: { _id: Types.ObjectId }, row: IResourceRequest | null, action: string, details: Record<string, unknown> = {}) {
  await ResourceEvent.create([{ resourceId: resource._id, ...(row ? { requestId: row._id, revision: row.revision ?? 0 } : {}), actorId, action, ...details }], { session });
}
export async function noResourceDispute(row: IResourceRequest, session: ClientSession) {
  if (await ResourceDispute.exists({ requestId: row._id, status: 'open' }).session(session)) throw new ResourceReservationError(409, 'Resolve or withdraw the open dispute before changing the allocation.');
}
export function assertResourceOpen(resource: InstanceType<typeof Resource>) {
  if (resource.withdrawnByAdmin || resource.availabilityPaused) throw new ResourceReservationError(409, 'This listing is paused or withdrawn.');
  const deadline = resource.accessType === 'donation' ? resource.accessDetails.donation?.claimDeadline : resource.accessType === 'sponsorship' ? resource.accessDetails.sponsorship?.applicationDeadline : undefined;
  if (deadline && deadline <= new Date()) throw new ResourceReservationError(409, 'This resource application deadline has passed.');
}

export async function submitResourceRequest(actorId: Types.ObjectId, values: Record<string, unknown>) {
  const id = resourceId(values.resourceId);
  const justification = resourceText(values.justification, 'Justification', 30, 800);
  if (!['low', 'medium', 'high'].includes(values.selfDeclaredNeed as string)) throw new ResourceReservationError(400, 'Select your declared need level.');
  if (values.joinWaitlist !== undefined && typeof values.joinWaitlist !== 'boolean') throw new ResourceReservationError(400, 'Waitlist selection must be boolean.');
  const message = values.message === undefined || values.message === '' ? undefined : resourceText(values.message, 'Message', 1, 1000);
  const durationOrTerms = values.durationOrTerms === undefined || values.durationOrTerms === '' ? undefined : resourceText(values.durationOrTerms, 'Requested terms', 1, 200);
  return resourceTransaction(async session => {
    const student = await lockResourceActor(actorId, session);
    if (student.role !== 'student') throw new ResourceReservationError(403, 'A student account is required.');
    const resource = await Resource.findById(id).session(session);
    if (!resource || (resource.status !== 'available' && values.joinWaitlist !== true)) throw new ResourceReservationError(404, 'Resource not found or no longer available.');
    if (resource.listedBy.equals(actorId)) throw new ResourceReservationError(400, 'You cannot request your own resource listing.');
    assertResourceOpen(resource);
    if (resource.quantityAvailable < 1 && values.joinWaitlist !== true) throw new ResourceReservationError(409, 'No units are available; explicitly join the waitlist instead.');
    await lockResourceActor(resource.listedBy, session);
    await Resource.updateOne({ _id: resource._id }, { $inc: { __v: 1 } }, { session, timestamps: false });
    if (resource.accessType !== values.requestedAccessType) throw new ResourceReservationError(400, 'Invalid access type requested for this resource.');
    if (await ResourceRequest.exists({ studentId: actorId, resourceCategory: resource.category, status: { $in: ['pending', 'waitlisted', 'accepted'] } }).session(session)) throw new ResourceReservationError(409, 'You already have an active request or allocation in this category.');
    const hasDates = values.requestedStartAt !== undefined || values.requestedReturnAt !== undefined;
    const dates = hasDates ? allocationDates(resource, values.requestedStartAt, values.requestedReturnAt) : undefined;
    const at = new Date(); const prioritySnapshot = resourcePriority(values.selfDeclaredNeed as 'low' | 'medium' | 'high', Boolean(student.studentProfile?.degree), 0, at, resource);
    const [row] = await ResourceRequest.create([{ studentId: actorId, providerId: resource.listedBy, resourceId: resource._id, requestedAccessType: resource.accessType, resourceCategory: resource.category, justification, selfDeclaredNeed: values.selfDeclaredNeed, message, durationOrTerms, lifecycleVersion: 1, revision: 0, status: values.joinWaitlist ? 'waitlisted' : 'pending', ...(values.joinWaitlist ? { waitlistedAt: at } : {}), ...(dates ? { requestedStartAt: dates.startAt, requestedReturnAt: dates.dueAt } : {}), prioritySnapshot }], { session });
    await resourceEvent(session, actorId, resource, row, 'submitted', { toStatus: row.status, reason: values.joinWaitlist ? 'Student explicitly joined the waitlist.' : 'Student submitted a request.' });
    return row;
  });
}

export async function requestResourceReturn(id: unknown, actorId: Types.ObjectId, values: Record<string, unknown>) {
  const reason = resourceText(values.reason, 'Return note');
  return resourceTransaction(async session => {
    const { row, resource, owner } = await lockResourceContext(id, actorId, session);
    if (owner) throw new ResourceReservationError(403, 'The borrower must request the return.');
    resourceRevision(values.revision, row.revision ?? 0, true);
    await noResourceDispute(row, session);
    if (row.status !== 'accepted' || row.returnRequestedAt || !(row.allocation?.returnRequired ?? returnPolicy(resource).returnRequired)) throw new ResourceReservationError(409, 'This allocation is not eligible for a return request.');
    if (row.allocation?.startAt && row.allocation.startAt > new Date()) throw new ResourceReservationError(409, 'The borrowing period has not started.');
    row.returnRequestedAt = new Date(); row.revision = (row.revision ?? 0) + 1; await row.save({ session });
    await resourceEvent(session, actorId, resource, row, 'return_requested', { reason }); return row;
  });
}
export async function confirmResourceReturn(id: unknown, actorId: Types.ObjectId, values: Record<string, unknown>) {
  const reason = resourceText(values.reason, 'Return confirmation');
  return resourceTransaction(async session => {
    const { row, resource } = await lockResourceContext(id, actorId, session, true);
    resourceRevision(values.revision, row.revision ?? 0, true);
    await noResourceDispute(row, session);
    if (row.status !== 'accepted' || !row.returnRequestedAt || row.returnedAt || row.inventoryRestoredAt) throw new ResourceReservationError(409, 'A pending borrower return is required.');
    const legacyReservationConfirmed = !row.allocation;
    if (!row.allocation) {
      if (values.confirmLegacyReservation !== true || !returnPolicy(resource).returnRequired) throw new ResourceReservationError(409, 'Legacy return requires owner confirmation that this unit was reserved and is returnable.');
      row.allocation = { returnRequired: true, accessType: row.requestedAccessType, inventoryReserved: true };
    }
    if (!row.allocation.returnRequired || !row.allocation.inventoryReserved || row.allocation.accessType !== resource.accessType || !resource.listedBy.equals(row.providerId) || resource.category !== row.resourceCategory) throw new ResourceReservationError(409, 'The original reserved resource ownership needs review before restoring inventory.');
    if (!Number.isSafeInteger(resource.quantityAvailable) || resource.quantityAvailable < 0 || resource.quantityAvailable >= 1_000_000) throw new ResourceReservationError(409, 'Inventory needs review before restoration.');
    const quantityBefore = resource.quantityAvailable;
    const nextStatus = resource.withdrawnByAdmin || resource.availabilityPaused ? 'claimed' : 'available';
    await Resource.updateOne({ _id: resource._id }, { $inc: { quantityAvailable: 1, inventoryRevision: 1 }, $set: { status: nextStatus } }, { session });
    row.status = 'completed'; row.returnedAt = new Date(); row.inventoryRestoredAt = row.returnedAt; row.revision = (row.revision ?? 0) + 1; await row.save({ session });
    await resourceEvent(session, actorId, resource, row, 'return_confirmed', { reason, legacyReservationConfirmed, fromStatus: 'accepted', toStatus: 'completed', quantityBefore, quantityAfter: quantityBefore + 1 }); return row;
  });
}
export async function cancelResourceRequest(id: unknown, actorId: Types.ObjectId, values: Record<string, unknown>) {
  const reason = resourceText(values.reason, 'Cancellation reason');
  return resourceTransaction(async session => {
    const { row, resource, owner } = await lockResourceContext(id, actorId, session);
    if (owner) throw new ResourceReservationError(403, 'Only the applicant may cancel this request.');
    resourceRevision(values.revision, row.revision ?? 0, true);
    if (!['pending', 'waitlisted'].includes(row.status)) throw new ResourceReservationError(409, 'Only unallocated requests can be cancelled.');
    const before = row.status; row.status = 'cancelled'; row.revision = (row.revision ?? 0) + 1; await row.save({ session });
    await resourceEvent(session, actorId, resource, row, 'cancelled', { reason, fromStatus: before, toStatus: row.status }); return row;
  });
}
export async function openResourceDispute(id: unknown, actorId: Types.ObjectId, values: Record<string, unknown>) {
  const statement = resourceText(values.statement, 'Dispute statement', 30, 2000);
  return resourceTransaction(async session => {
    const { row, resource } = await lockResourceContext(id, actorId, session);
    resourceRevision(values.revision, row.revision ?? 0, true);
    if (!['accepted', 'completed'].includes(row.status)) throw new ResourceReservationError(409, 'Disputes require an allocated resource.');
    await noResourceDispute(row, session);
    if (await ResourceDispute.countDocuments({ requestId: row._id }).session(session) >= 3) throw new ResourceReservationError(409, 'This request has reached the dispute limit.');
    const [dispute] = await ResourceDispute.create([{ requestId: row._id, resourceId: resource._id, createdBy: actorId, statement }], { session });
    row.revision = (row.revision ?? 0) + 1; await row.save({ session });
    await resourceEvent(session, actorId, resource, row, 'dispute_opened', { disputeId: dispute._id }); return dispute;
  });
}
export async function resolveResourceDispute(id: unknown, disputeValue: unknown, actorId: Types.ObjectId, values: Record<string, unknown>) {
  const disputeId = resourceId(disputeValue); const reason = resourceText(values.reason, 'Dispute resolution');
  if (!['resolved', 'withdrawn'].includes(values.status as string)) throw new ResourceReservationError(400, 'Select resolved or withdrawn.');
  return resourceTransaction(async session => {
    const { row, resource, owner } = await lockResourceContext(id, actorId, session);
    resourceRevision(values.revision, row.revision ?? 0, true);
    const dispute = await ResourceDispute.findOne({ _id: disputeId, requestId: row._id, status: 'open' }).session(session);
    if (!dispute) throw new ResourceReservationError(409, 'Open dispute not found.');
    if (values.status === 'withdrawn' ? !dispute.createdBy.equals(actorId) : !owner) throw new ResourceReservationError(403, 'Only the creator can withdraw, or the listing owner can record a resolution.');
    dispute.status = values.status as 'resolved' | 'withdrawn'; dispute.resolution = reason; dispute.resolvedBy = actorId; dispute.resolvedAt = new Date(); await dispute.save({ session });
    row.revision = (row.revision ?? 0) + 1; await row.save({ session });
    await resourceEvent(session, actorId, resource, row, `dispute_${dispute.status}`, { reason, disputeId: dispute._id }); return dispute;
  });
}

export async function changeResourceAvailability(idValue: unknown, actorId: Types.ObjectId, kind: 'status' | 'inventory', values: Record<string, unknown>) {
  const id = resourceId(idValue);
  if (kind === 'status' && !['available', 'claimed'].includes(values.status as string)) throw new ResourceReservationError(400, 'Status must be available or claimed.');
  if (kind === 'inventory' && (!Number.isSafeInteger(values.quantityAvailable) || (values.quantityAvailable as number) < 0 || (values.quantityAvailable as number) > 1_000_000)) throw new ResourceReservationError(400, 'Available units must be a whole number from zero to 1000000.');
  return resourceTransaction(async session => {
    const resource = await Resource.findOne({ _id: id, listedBy: actorId }).session(session);
    if (!resource) throw new ResourceReservationError(404, 'Resource listing not found or you do not own it.');
    await lockResourceActor(actorId, session);
    if (resource.withdrawnByAdmin) throw new ResourceReservationError(409, 'An administratively withdrawn listing cannot be reopened or restocked.');
    const active = Boolean(await ResourceRequest.exists({ resourceId: resource._id, status: 'accepted' }).session(session));
    resourceRevision(values.inventoryRevision, resource.inventoryRevision ?? 0, kind === 'inventory' && active);
    const reason = values.reason === undefined && !(kind === 'inventory' && active) ? 'Legacy owner listing update; no reason supplied.' : resourceText(values.reason, 'Inventory or status reason');
    const quantityBefore = resource.quantityAvailable;
    if (kind === 'status') {
      if (values.status === 'available' && quantityBefore < 1) throw new ResourceReservationError(400, 'Add at least one available unit before reopening this listing.');
      resource.status = values.status as 'available' | 'claimed'; resource.availabilityPaused = values.status === 'claimed';
    } else {
      resource.quantityAvailable = values.quantityAvailable as number;
      resource.status = resource.availabilityPaused ? 'claimed' : resource.quantityAvailable > 0 ? 'available' : 'claimed';
    }
    resource.inventoryRevision = (resource.inventoryRevision ?? 0) + 1; resource.increment(); await resource.save({ session });
    await resourceEvent(session, actorId, resource, null, kind === 'status' ? 'availability_changed' : 'inventory_adjusted', { reason, revision: resource.inventoryRevision, quantityBefore, quantityAfter: resource.quantityAvailable, toStatus: resource.status }); return resource;
  });
}
export async function removeResourceWithHistory(idValue: unknown, actorId: Types.ObjectId, admin = false, reasonValue?: unknown) {
  const id = resourceId(idValue); const reason = reasonValue === undefined ? 'Listing removed through the existing moderation workflow.' : resourceText(reasonValue, 'Removal reason', 3);
  return resourceTransaction(async session => {
    await lockResourceActor(actorId, session, admin);
    const resource = await Resource.findOne({ _id: id, ...(admin ? {} : { listedBy: actorId }) }).session(session);
    if (!resource) throw new ResourceReservationError(404, 'Resource listing not found.');
    await Resource.updateOne({ _id: resource._id }, { $inc: { __v: 1 } }, { session, timestamps: false });
    const retained = Boolean(await ResourceRequest.exists({ resourceId: resource._id }).session(session));
    if (retained && !admin) throw new ResourceReservationError(409, 'Requests exist; pause this listing to preserve allocation and return history.');
    if (retained) { resource.status = 'claimed'; resource.availabilityPaused = true; resource.withdrawnByAdmin = true; resource.inventoryRevision = (resource.inventoryRevision ?? 0) + 1; await resource.save({ session }); }
    else await Resource.deleteOne({ _id: resource._id }, { session });
    await resourceEvent(session, actorId, resource, null, retained ? 'withdrawn_with_history' : 'listing_deleted', { reason });
    if (admin) await AuditLog.create([{ adminId: actorId, targetType: 'resource', targetId: resource._id, action: retained ? 'resource_withdrawn_with_history' : 'resource_removed', reason }], { session });
    return { resource, retained };
  });
}
