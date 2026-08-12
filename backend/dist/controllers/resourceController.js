"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteResource = exports.updateResource = exports.getResource = exports.listMyResources = exports.listResources = exports.createResource = void 0;
const Resource_1 = __importDefault(require("../models/Resource"));
const categories = ['laptop', 'arduino', 'raspberry_pi', 'sensor', 'development_board', 'electronic_component', 'project_equipment', 'other'];
const accessMethods = ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'];
const providerSelect = 'fullName email providerProfile.organizationName providerProfile.organizationType providerProfile.verified providerProfile.contactEmail providerProfile.phone';
const editableFields = ['name', 'description', 'category', 'accessMethods', 'location', 'availability', 'quantity', 'rentalRate', 'currency'];
const payloadFrom = (body) => {
    const payload = {};
    editableFields.forEach((field) => { if (body[field] !== undefined)
        payload[field] = body[field]; });
    return payload;
};
const validate = (payload) => {
    if (typeof payload.name !== 'string' || payload.name.trim().length < 2)
        return 'Resource name must be at least 2 characters.';
    if (typeof payload.description !== 'string' || payload.description.trim().length < 10)
        return 'Resource description must be at least 10 characters.';
    if (!categories.includes(payload.category))
        return 'Select a valid resource category.';
    if (!Array.isArray(payload.accessMethods) || payload.accessMethods.length === 0 || payload.accessMethods.some((method) => !accessMethods.includes(method)))
        return 'Select at least one valid access method.';
    if (typeof payload.location !== 'string' || !payload.location.trim())
        return 'Location is required.';
    if (!['available', 'unavailable'].includes(payload.availability))
        return 'Select availability.';
    if (!Number.isInteger(payload.quantity) || payload.quantity < 0)
        return 'Quantity must be zero or more.';
    if (payload.rentalRate !== undefined && (typeof payload.rentalRate !== 'number' || payload.rentalRate < 0))
        return 'Rental rate must be a valid amount.';
    return null;
};
/** POST /api/resources */
const createResource = async (req, res) => {
    try {
        const payload = payloadFrom(req.body);
        const error = validate(payload);
        if (error) {
            res.status(400).json({ success: false, message: error });
            return;
        }
        const resource = await Resource_1.default.create({ ...payload, providerId: req.user._id });
        await resource.populate('providerId', providerSelect);
        res.status(201).json({ success: true, message: 'Resource added', data: { resource } });
    }
    catch (error) {
        console.error('Create resource error:', error);
        res.status(500).json({ success: false, message: 'Unable to add resource.' });
    }
};
exports.createResource = createResource;
/** GET /api/resources */
const listResources = async (req, res) => {
    try {
        const filter = { availability: 'available' };
        if (typeof req.query.category === 'string' && categories.includes(req.query.category))
            filter.category = req.query.category;
        if (typeof req.query.accessMethod === 'string' && accessMethods.includes(req.query.accessMethod))
            filter.accessMethods = req.query.accessMethod;
        if (typeof req.query.search === 'string' && req.query.search.trim()) {
            const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { description: { $regex: escaped, $options: 'i' } }];
        }
        const resources = await Resource_1.default.find(filter).populate('providerId', providerSelect).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: { resources } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Unable to fetch resources.' });
    }
};
exports.listResources = listResources;
/** GET /api/resources/mine */
const listMyResources = async (req, res) => {
    try {
        const filter = { providerId: req.user._id };
        if (typeof req.query.search === 'string' && req.query.search.trim()) {
            const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.name = { $regex: escaped, $options: 'i' };
        }
        const resources = await Resource_1.default.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: { resources } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Unable to fetch your resources.' });
    }
};
exports.listMyResources = listMyResources;
/** GET /api/resources/:id */
const getResource = async (req, res) => {
    try {
        const resource = await Resource_1.default.findOneAndUpdate({ _id: req.params.id, availability: 'available' }, { $inc: { views: 1 } }, { new: true })
            .populate('providerId', providerSelect);
        if (!resource) {
            res.status(404).json({ success: false, message: 'Available resource not found.' });
            return;
        }
        res.status(200).json({ success: true, data: { resource } });
    }
    catch (error) {
        res.status(400).json({ success: false, message: 'Invalid resource ID.' });
    }
};
exports.getResource = getResource;
/** PUT /api/resources/:id */
const updateResource = async (req, res) => {
    try {
        const resource = await Resource_1.default.findOne({ _id: req.params.id, providerId: req.user._id });
        if (!resource) {
            res.status(404).json({ success: false, message: 'Resource not found or you do not own it.' });
            return;
        }
        const payload = payloadFrom(req.body);
        const error = validate({ ...resource.toObject(), ...payload });
        if (error) {
            res.status(400).json({ success: false, message: error });
            return;
        }
        resource.set(payload);
        await resource.save();
        res.status(200).json({ success: true, message: 'Resource updated', data: { resource } });
    }
    catch (error) {
        res.status(400).json({ success: false, message: 'Unable to update this resource.' });
    }
};
exports.updateResource = updateResource;
/** DELETE /api/resources/:id */
const deleteResource = async (req, res) => {
    try {
        const resource = await Resource_1.default.findOneAndDelete({ _id: req.params.id, providerId: req.user._id });
        if (!resource) {
            res.status(404).json({ success: false, message: 'Resource not found or you do not own it.' });
            return;
        }
        res.status(200).json({ success: true, message: 'Resource deleted' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: 'Invalid resource ID.' });
    }
};
exports.deleteResource = deleteResource;
//# sourceMappingURL=resourceController.js.map