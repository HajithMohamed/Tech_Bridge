import type { Request, Response } from 'express';
import Resource from '../models/Resource';
import ResourceRequest from '../models/ResourceRequest';
import { ResourceDispute, ResourceEvent } from '../models/ResourceActivity';
import { creatorPage } from '../services/creatorPolicy';
import { AdminActionError } from '../services/adminUsers';
import { cancelResourceRequest, confirmResourceReturn, openResourceDispute, requestResourceReturn, resolveResourceDispute, resourceContext } from '../services/resourceLifecycle';
import { isResourceOverdue, resourceId, returnPolicy, ResourceReservationError } from '../services/resourcePolicy';
import { transitionResourceRequest } from '../services/resourceReservation';

export function resourceFailure(res: Response, error: unknown): void {
  if (error instanceof ResourceReservationError || error instanceof AdminActionError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) { res.status(409).json({ success: false, message: 'This resource action is already recorded.' }); return; }
  res.status(503).json({ success: false, message: 'Resource services are temporarily unavailable.' });
}
export function resourceBody(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ResourceReservationError(400, 'Provide a resource request object.');
  return req.body;
}
const pageFor = (req: Request) => ({ page: creatorPage(req.query.page), limit: creatorPage(req.query.limit, 20, 50) });
export const getResourceRequest = async (req: Request, res: Response) => {
  try {
    const { row, resource } = await resourceContext(req.params.id, req.user!._id);
    const openDispute = Boolean(await ResourceDispute.exists({ requestId: row._id, status: 'open' }));
    res.json({ success: true, data: { request: { ...row.toObject(), isOverdue: isResourceOverdue(row), openDispute, returnConfirmationRequired: row.allocation?.returnRequired ?? returnPolicy(resource).returnRequired }, availability: { quantityAvailable: resource.quantityAvailable, status: resource.status, inventoryRevision: resource.inventoryRevision ?? 0, withdrawnByAdmin: resource.withdrawnByAdmin === true, paused: resource.availabilityPaused === true } } });
  } catch (error) { resourceFailure(res, error); }
};
export const getResourceHistory = async (req: Request, res: Response) => {
  try {
    const { row } = await resourceContext(req.params.id, req.user!._id); const { page, limit } = pageFor(req);
    const [events, total] = await Promise.all([ResourceEvent.find({ requestId: row._id }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), ResourceEvent.countDocuments({ requestId: row._id })]);
    res.json({ success: true, data: { events, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { resourceFailure(res, error); }
};
const mutation = (action: 'return' | 'confirm' | 'cancel' | 'dispute' | 'resolve') => async (req: Request, res: Response) => {
  try {
    const body = resourceBody(req); const id = req.params.id; const actor = req.user!._id;
    const value = action === 'return' ? await requestResourceReturn(id, actor, body) : action === 'confirm' ? await confirmResourceReturn(id, actor, body) : action === 'cancel' ? await cancelResourceRequest(id, actor, body) : action === 'dispute' ? await openResourceDispute(id, actor, body) : await resolveResourceDispute(id, req.params.disputeId, actor, body);
    res.status(action === 'dispute' ? 201 : 200).json({ success: true, data: { [action === 'dispute' || action === 'resolve' ? 'dispute' : 'request']: value } });
  } catch (error) { resourceFailure(res, error); }
};
export const submitResourceReturn = mutation('return');
export const confirmReturnedResource = mutation('confirm');
export const cancelPendingResource = mutation('cancel');
export const createResourceDispute = mutation('dispute');
export const decideResourceDispute = mutation('resolve');
export const listResourceDisputes = async (req: Request, res: Response) => {
  try { const { row } = await resourceContext(req.params.id, req.user!._id); const disputes = await ResourceDispute.find({ requestId: row._id }).sort({ createdAt: -1, _id: -1 }); res.json({ success: true, data: { disputes } }); } catch (error) { resourceFailure(res, error); }
};
async function ownedResource(req: Request) {
  const resource = await Resource.findOne({ _id: resourceId(req.params.id), listedBy: req.user!._id });
  if (!resource) throw new ResourceReservationError(404, 'Resource listing not found.'); return resource;
}
export const resourceWaitlist = async (req: Request, res: Response) => {
  try {
    const resource = await ownedResource(req); const { page, limit } = pageFor(req); const filter = { resourceId: resource._id, providerId: req.user!._id, status: 'waitlisted' };
    const [requests, total] = await Promise.all([ResourceRequest.find(filter).sort({ 'prioritySnapshot.priorityScore': -1, createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).populate('studentId', 'fullName studentProfile.institution studentProfile.degree'), ResourceRequest.countDocuments(filter)]);
    res.json({ success: true, data: { requests, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), quantityAvailable: resource.quantityAvailable, allocationBlocked: resource.status !== 'available' || resource.withdrawnByAdmin === true || resource.availabilityPaused === true } });
  } catch (error) { resourceFailure(res, error); }
};
export const advanceResourceWaitlist = async (req: Request, res: Response) => {
  try {
    const body = resourceBody(req);
    const row = await transitionResourceRequest(body.requestId, req.user!._id, 'accepted', { reason: body.reason, revision: body.revision, startAt: body.startAt, dueAt: body.dueAt, priorityOverrideReason: body.priorityOverrideReason, requireWaitlisted: true, resourceId: req.params.id });
    res.json({ success: true, data: { request: row } });
  } catch (error) { resourceFailure(res, error); }
};
export const resourceListingHistory = async (req: Request, res: Response) => {
  try {
    const resource = await ownedResource(req); const { page, limit } = pageFor(req);
    // Listing-level inventory events only. Private applicant events have participant-scoped routes.
    const filter = { resourceId: resource._id, requestId: { $exists: false } };
    const [events, total] = await Promise.all([ResourceEvent.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), ResourceEvent.countDocuments(filter)]);
    res.json({ success: true, data: { events, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { resourceFailure(res, error); }
};
