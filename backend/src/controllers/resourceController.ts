import { Request, Response } from 'express';
import Resource, { AccessMethod, ResourceCategory } from '../models/Resource';

const categories: ResourceCategory[] = ['laptop', 'arduino', 'raspberry_pi', 'sensor', 'development_board', 'electronic_component', 'project_equipment', 'other'];
const accessMethods: AccessMethod[] = ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'];
const providerSelect = 'fullName email providerProfile.organizationName providerProfile.organizationType providerProfile.verified providerProfile.contactEmail providerProfile.phone';
const editableFields = ['name', 'description', 'category', 'accessMethods', 'location', 'availability', 'quantity', 'rentalRate', 'currency'] as const;

const payloadFrom = (body: Record<string, unknown>): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  editableFields.forEach((field) => { if (body[field] !== undefined) payload[field] = body[field]; });
  return payload;
};

const validate = (payload: Record<string, unknown>): string | null => {
  if (typeof payload.name !== 'string' || payload.name.trim().length < 2) return 'Resource name must be at least 2 characters.';
  if (typeof payload.description !== 'string' || payload.description.trim().length < 10) return 'Resource description must be at least 10 characters.';
  if (!categories.includes(payload.category as ResourceCategory)) return 'Select a valid resource category.';
  if (!Array.isArray(payload.accessMethods) || payload.accessMethods.length === 0 || payload.accessMethods.some((method) => !accessMethods.includes(method as AccessMethod))) return 'Select at least one valid access method.';
  if (typeof payload.location !== 'string' || !payload.location.trim()) return 'Location is required.';
  if (!['available', 'unavailable'].includes(payload.availability as string)) return 'Select availability.';
  if (!Number.isInteger(payload.quantity) || (payload.quantity as number) < 0) return 'Quantity must be zero or more.';
  if (payload.rentalRate !== undefined && (typeof payload.rentalRate !== 'number' || payload.rentalRate < 0)) return 'Rental rate must be a valid amount.';
  return null;
};

/** POST /api/resources */
export const createResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = payloadFrom(req.body);
    const error = validate(payload);
    if (error) { res.status(400).json({ success: false, message: error }); return; }
    const resource = await Resource.create({ ...payload, providerId: req.user!._id });
    await resource.populate('providerId', providerSelect);
    res.status(201).json({ success: true, message: 'Resource added', data: { resource } });
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ success: false, message: 'Unable to add resource.' });
  }
};

/** GET /api/resources */
export const listResources = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = { availability: 'available' };
    if (typeof req.query.category === 'string' && categories.includes(req.query.category as ResourceCategory)) filter.category = req.query.category;
    if (typeof req.query.accessMethod === 'string' && accessMethods.includes(req.query.accessMethod as AccessMethod)) filter.accessMethods = req.query.accessMethod;
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { description: { $regex: escaped, $options: 'i' } }];
    }
    const resources = await Resource.find(filter).populate('providerId', providerSelect).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { resources } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to fetch resources.' });
  }
};

/** GET /api/resources/mine */
export const listMyResources = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = { providerId: req.user!._id };
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }
    const resources = await Resource.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { resources } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to fetch your resources.' });
  }
};

/** GET /api/resources/:id */
export const getResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const resource = await Resource.findOneAndUpdate({ _id: req.params.id, availability: 'available' }, { $inc: { views: 1 } }, { new: true })
      .populate('providerId', providerSelect);
    if (!resource) { res.status(404).json({ success: false, message: 'Available resource not found.' }); return; }
    res.status(200).json({ success: true, data: { resource } });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid resource ID.' });
  }
};

/** PUT /api/resources/:id */
export const updateResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const resource = await Resource.findOne({ _id: req.params.id, providerId: req.user!._id });
    if (!resource) { res.status(404).json({ success: false, message: 'Resource not found or you do not own it.' }); return; }
    const payload = payloadFrom(req.body);
    const error = validate({ ...resource.toObject(), ...payload });
    if (error) { res.status(400).json({ success: false, message: error }); return; }
    resource.set(payload);
    await resource.save();
    res.status(200).json({ success: true, message: 'Resource updated', data: { resource } });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Unable to update this resource.' });
  }
};

/** DELETE /api/resources/:id */
export const deleteResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const resource = await Resource.findOneAndDelete({ _id: req.params.id, providerId: req.user!._id });
    if (!resource) { res.status(404).json({ success: false, message: 'Resource not found or you do not own it.' }); return; }
    res.status(200).json({ success: true, message: 'Resource deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid resource ID.' });
  }
};
