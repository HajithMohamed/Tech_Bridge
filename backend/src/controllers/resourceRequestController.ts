import { Request, Response } from 'express';
import ResourceRequest from '../models/ResourceRequest';
import Resource from '../models/Resource';
import User from '../models/User';
import { resourceRequestPriority } from '../utils/priorityEngine';

const studentSelect = 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal';
const resourceSelect = 'itemName category condition accessType quantityAvailable status';
const providerSelect = 'fullName email providerProfile.organizationName providerProfile.organizationType providerProfile.verified providerProfile.contactEmail providerProfile.phone';
const idString = (value: unknown) => {
  if (value && typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id);
  return String(value);
};

const enrichRequests = async (requests: InstanceType<typeof ResourceRequest>[]) => {
  if (!requests.length) return [];
  const studentIds = requests.map((request) => idString(request.studentId));
  const resourceIds = requests.map((request) => idString(request.resourceId));
  const [students, resources, existingBenefits] = await Promise.all([
    User.find({ _id: { $in: studentIds } }),
    Resource.find({ _id: { $in: resourceIds } }),
    ResourceRequest.aggregate<{ _id: { studentId: typeof studentIds[number]; resourceCategory: string }; count: number }>([
      { $match: { status: 'accepted', studentId: { $in: studentIds } } },
      { $group: { _id: { studentId: '$studentId', resourceCategory: '$resourceCategory' }, count: { $sum: 1 } } },
    ]),
  ]);
  const studentMap = new Map(students.map((student) => [student._id.toString(), student]));
  const resourceMap = new Map(resources.map((resource) => [resource._id.toString(), resource]));
  const benefitMap = new Map(existingBenefits.map((item) => [`${item._id.studentId.toString()}:${item._id.resourceCategory}`, item.count]));
  const byResource = new Map<string, InstanceType<typeof ResourceRequest>[]>();
  requests.forEach((request) => {
    const key = idString(request.resourceId);
    byResource.set(key, [...(byResource.get(key) || []), request]);
  });
  const enriched = [...byResource.values()].flatMap((group) => {
    const dates = group.map((request) => request.createdAt.getTime());
    const firstAt = new Date(Math.min(...dates));
    const lastAt = new Date(Math.max(...dates));
    const acceptedCount = group.filter((request) => request.status === 'accepted').length;
    return group.map((request) => ({
      ...request.toObject(),
      ...resourceRequestPriority(request, resourceMap.get(idString(request.resourceId)), studentMap.get(idString(request.studentId)), benefitMap.get(`${idString(request.studentId)}:${request.resourceCategory}`) || 0, firstAt, lastAt, acceptedCount),
    }));
  });
  return enriched.sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

/** POST /api/resource-requests */
export const createResourceRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { resourceId, requestedAccessType, durationOrTerms, message, justification, selfDeclaredNeed } = req.body;
    const resource = await Resource.findOne({ _id: resourceId, status: 'available' });

    if (!resource) {
      res.status(404).json({ success: false, message: 'Resource not found or no longer available.' });
      return;
    }

    if (resource.listedBy.equals(req.user!._id)) {
      res.status(400).json({ success: false, message: 'You cannot request your own resource listing.' });
      return;
    }

    if (resource.accessType !== requestedAccessType) {
      res.status(400).json({ success: false, message: 'Invalid access type requested for this resource.' });
      return;
    }

    const existing = await ResourceRequest.findOne({
      studentId: req.user!._id,
      resourceCategory: resource.category,
      status: { $in: ['pending', 'accepted'] },
    });
    if (existing) {
      res.status(409).json({ success: false, message: `You already have an active request or accepted ${resource.category.replace('_', ' ')} resource.` });
      return;
    }

    if (typeof justification !== 'string' || justification.trim().length < 30 || justification.trim().length > 800) {
      res.status(400).json({ success: false, message: 'Please provide a justification between 30 and 800 characters.' });
      return;
    }
    if (!['low', 'medium', 'high'].includes(selfDeclaredNeed)) {
      res.status(400).json({ success: false, message: 'Select your declared need level.' });
      return;
    }

    if (typeof message === 'string' && message.trim().length > 1000) {
      res.status(400).json({ success: false, message: 'Your message must be 1000 characters or fewer.' });
      return;
    }
    if (typeof durationOrTerms === 'string' && durationOrTerms.trim().length > 200) {
      res.status(400).json({ success: false, message: 'Requested terms must be 200 characters or fewer.' });
      return;
    }

    const request = await ResourceRequest.create({
      studentId: req.user!._id,
      providerId: resource.listedBy,
      resourceId: resource._id,
      requestedAccessType,
      resourceCategory: resource.category,
      durationOrTerms: typeof durationOrTerms === 'string' ? durationOrTerms.trim() : undefined,
      message: typeof message === 'string' ? message.trim() : undefined,
      justification: justification.trim(),
      selfDeclaredNeed,
    });
    
    await request.populate('resourceId', resourceSelect);

    res.status(201).json({
      success: true,
      message: 'Resource request submitted',
      data: { request },
    });
  } catch (error) {
    console.error('Create resource request error:', error);
    res.status(400).json({ success: false, message: 'Unable to submit your request.' });
  }
};

/** GET /api/resource-requests/mine */
export const listMyResourceRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await ResourceRequest.find({ studentId: req.user!._id })
      .populate('resourceId', resourceSelect)
      .populate('providerId', providerSelect)
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { requests } });
  } catch (error) {
    console.error('List student resource requests error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch your requests.' });
  }
};

/** GET /api/resource-requests/provider */
export const listProviderResourceRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await ResourceRequest.find({ providerId: req.user!._id })
      .populate('studentId', studentSelect)
      .populate('resourceId', resourceSelect)
      .sort({ createdAt: 1 });
    const enriched = await enrichRequests(requests as InstanceType<typeof ResourceRequest>[]);
    res.status(200).json({ success: true, data: { requests: enriched } });
  } catch (error) {
    console.error('List provider resource requests error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch requests.' });
  }
};

/** GET /api/resource-requests/received — requests for a student's own shared listings */
export const listReceivedResourceRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await ResourceRequest.find({ providerId: req.user!._id })
      .populate('studentId', studentSelect)
      .populate('resourceId', resourceSelect)
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { requests } });
  } catch (error) {
    console.error('List received resource requests error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch received requests.' });
  }
};

/** PATCH /api/resource-requests/:id/status */
export const updateResourceRequestStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected', 'completed'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status update.' });
      return;
    }

    const request = await ResourceRequest.findOne({ _id: req.params.id, providerId: req.user!._id });

    if (!request) {
      res.status(404).json({ success: false, message: 'Request not found.' });
      return;
    }

    if (request.status === 'pending') {
      if (status === 'completed') {
        res.status(400).json({ success: false, message: 'Accept a request before marking it completed.' });
        return;
      }
      if (status === 'accepted') {
        const activeSameCategory = await ResourceRequest.findOne({
          studentId: request.studentId,
          resourceCategory: request.resourceCategory,
          status: 'accepted',
          _id: { $ne: request._id },
        });
        if (activeSameCategory) {
          res.status(409).json({ success: false, message: 'This student already holds an accepted resource in this category.' });
          return;
        }
        const resource = await Resource.findOneAndUpdate(
          { _id: request.resourceId, status: 'available', quantityAvailable: { $gt: 0 } },
          { $inc: { quantityAvailable: -1 } },
          { new: true }
        );
        if (!resource) {
          res.status(409).json({ success: false, message: 'This resource is no longer available to reserve.' });
          return;
        }
        if (resource.quantityAvailable === 0) {
          resource.status = 'claimed';
          await resource.save();
        }
      }
      request.status = status;
    } else if (request.status === 'accepted' && status === 'completed') {
      request.status = 'completed';
    } else {
      res.status(400).json({ success: false, message: 'This request has already been processed and cannot be changed to that status.' });
      return;
    }
    await request.save();

    res.status(200).json({ success: true, message: `Request ${status}.`, data: { request } });
  } catch (error) {
    console.error('Update resource request status error:', error);
    res.status(400).json({ success: false, message: 'Unable to update this request.' });
  }
};
