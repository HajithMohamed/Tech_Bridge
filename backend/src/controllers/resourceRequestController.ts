import { Request, Response } from 'express';
import { Types } from 'mongoose';
import ResourceRequest from '../models/ResourceRequest';
import Resource from '../models/Resource';
import User from '../models/User';
import { resourceRequestPriority } from '../utils/priorityEngine';
import { transitionResourceRequest } from '../services/resourceReservation';
import { submitResourceRequest } from '../services/resourceLifecycle';
import { isResourceOverdue } from '../services/resourcePolicy';
import { resourceBody, resourceFailure } from './resourceLifecycleController';

const studentSelect = 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal';
const resourceSelect = 'itemName category condition accessType quantityAvailable status inventoryRevision withdrawnByAdmin';
const providerSelect = 'fullName email providerProfile.organizationName providerProfile.organizationType providerProfile.verified providerProfile.contactEmail providerProfile.phone';
const idString = (value: unknown) => value && typeof value === 'object' && '_id' in value ? String(value._id) : String(value);
const objectIds = (values: unknown[]) => [...new Set(values.map(idString))].filter(value => /^[a-f\d]{24}$/i.test(value)).map(value => new Types.ObjectId(value));

const enrichRequests = async (requests: InstanceType<typeof ResourceRequest>[]) => {
  if (!requests.length) return [];
  const studentIds = objectIds(requests.map(row => row.studentId)); const resourceIds = objectIds(requests.map(row => row.resourceId));
  const [students, resources, benefits] = await Promise.all([
    User.find({ _id: { $in: studentIds } }), Resource.find({ _id: { $in: resourceIds } }),
    ResourceRequest.aggregate<{ _id: { studentId: Types.ObjectId; resourceCategory: string }; count: number }>([
      { $match: { status: 'accepted', studentId: { $in: studentIds } } },
      { $group: { _id: { studentId: '$studentId', resourceCategory: '$resourceCategory' }, count: { $sum: 1 } } },
    ]),
  ]);
  const studentMap = new Map(students.map(row => [String(row._id), row])); const resourceMap = new Map(resources.map(row => [String(row._id), row]));
  const benefitMap = new Map(benefits.map(row => [`${row._id.studentId}:${row._id.resourceCategory}`, row.count]));
  const groups = new Map<string, InstanceType<typeof ResourceRequest>[]>();
  for (const row of requests) { const key = idString(row.resourceId); groups.set(key, [...(groups.get(key) ?? []), row]); }
  return [...groups.values()].flatMap(group => {
    const times = group.map(row => row.createdAt.getTime()); const first = new Date(Math.min(...times)); const last = new Date(Math.max(...times)); const accepted = group.filter(row => row.status === 'accepted').length;
    return group.map(row => ({ ...row.toObject(), ...resourceRequestPriority(row, resourceMap.get(idString(row.resourceId)), studentMap.get(idString(row.studentId)), benefitMap.get(`${idString(row.studentId)}:${row.resourceCategory}`) ?? 0, first, last, accepted), ...(row.prioritySnapshot ? { priorityScore: row.prioritySnapshot.priorityScore, priorityReasons: row.prioritySnapshot.priorityReasons, isWaitlisted: row.status === 'waitlisted' } : {}), isOverdue: isResourceOverdue(row) }));
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.createdAt.getTime() - b.createdAt.getTime() || String(a._id).localeCompare(String(b._id)));
};

export const createResourceRequest = async (req: Request, res: Response): Promise<void> => {
  try { const row = await submitResourceRequest(req.user!._id, resourceBody(req)); await row.populate('resourceId', resourceSelect); res.status(201).json({ success: true, message: 'Resource request submitted', data: { request: row } }); } catch (error) { resourceFailure(res, error); }
};
export const listMyResourceRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await ResourceRequest.find({ studentId: req.user!._id }).populate('resourceId', resourceSelect).populate('providerId', providerSelect).sort({ createdAt: -1 });
    res.json({ success: true, data: { requests: rows.map(row => ({ ...row.toObject(), isOverdue: isResourceOverdue(row) })) } });
  } catch (error) { resourceFailure(res, error); }
};
const ownerRequests = async (req: Request) => {
  const resourceIds = await Resource.find({ listedBy: req.user!._id }).distinct('_id');
  return ResourceRequest.find({ providerId: req.user!._id, resourceId: { $in: resourceIds } }).populate('studentId', studentSelect).populate('resourceId', resourceSelect).sort({ createdAt: 1 });
};
export const listProviderResourceRequests = async (req: Request, res: Response): Promise<void> => {
  try { const requests = await enrichRequests(await ownerRequests(req)); res.json({ success: true, data: { requests } }); } catch (error) { resourceFailure(res, error); }
};
export const listReceivedResourceRequests = async (req: Request, res: Response): Promise<void> => {
  try { const requests = await enrichRequests(await ownerRequests(req)); res.json({ success: true, data: { requests } }); } catch (error) { resourceFailure(res, error); }
};
export const updateResourceRequestStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = resourceBody(req);
    const row = await transitionResourceRequest(req.params.id, req.user!._id, body.status, { reason: body.reason, revision: body.revision, startAt: body.startAt, dueAt: body.dueAt, priorityOverrideReason: body.priorityOverrideReason });
    res.json({ success: true, message: `Request ${row.status}.`, data: { request: row } });
  } catch (error) { resourceFailure(res, error); }
};
