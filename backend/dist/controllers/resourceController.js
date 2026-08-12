"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteResource = exports.updateResourceStatus = exports.getResource = exports.listMyResources = exports.listResources = exports.createResource = void 0;
const Resource_1 = __importDefault(require("../models/Resource"));
const categories = ['laptop', 'arduino', 'raspberry_pi', 'sensor', 'electronic_component', 'dev_board', 'other'];
const accessTypes = ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'];
const statuses = ['available', 'claimed'];
const studentAccessTypes = ['borrow', 'share', 'donation'];
const peerToPeerAccessTypes = ['borrow', 'share'];
const providerManagedAccessTypes = ['rent', 'installment', 'interest_free', 'sponsorship'];
const providerOrganizationTypes = ['company', 'ngo', 'training_org'];
const listedBySelect = 'fullName email role providerProfile.organizationName providerProfile.organizationType providerProfile.verified providerProfile.verificationStatus providerProfile.contactEmail providerProfile.phone';
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const validNumber = (value, minimum = 0) => typeof value === 'number' && Number.isFinite(value) && value >= minimum;
const validInteger = (value, minimum = 0) => Number.isInteger(value) && value >= minimum;
const requiredText = (value, label, maxLength = 1000) => {
    if (typeof value !== 'string' || !value.trim())
        throw new Error(`${label} is required.`);
    const text = value.trim();
    if (text.length > maxLength)
        throw new Error(`${label} is too long.`);
    return text;
};
const requiredAmount = (value, label) => {
    if (!validNumber(value))
        throw new Error(`${label} must be a valid amount.`);
    return value;
};
const requiredPositiveInteger = (value, label) => {
    if (!validInteger(value, 1))
        throw new Error(`${label} must be a whole number of at least 1.`);
    return value;
};
const requiredDate = (value, label) => {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime()))
        throw new Error(`${label} must be a valid date.`);
    return date;
};
const requiredCriteria = (value) => {
    if (!Array.isArray(value))
        throw new Error('Eligibility criteria is required.');
    const criteria = value.filter((item) => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim());
    if (!criteria.length)
        throw new Error('Add at least one eligibility criterion.');
    if (criteria.some((item) => item.length > 300))
        throw new Error('Each eligibility criterion must be 300 characters or fewer.');
    return criteria;
};
const detailPayload = (body, accessType) => {
    if (!isRecord(body.accessDetails))
        throw new Error('Access details are required for this listing.');
    switch (accessType) {
        case 'borrow':
        case 'share': {
            const details = body.accessDetails.borrowShare;
            if (!isRecord(details))
                throw new Error('Borrow or share details are required.');
            return { borrowShare: {
                    borrowDurationDays: requiredPositiveInteger(details.borrowDurationDays, 'Borrow duration'),
                    pickupLocation: requiredText(details.pickupLocation, 'Pickup location', 200),
                    returnCondition: requiredText(details.returnCondition, 'Return condition notes'),
                } };
        }
        case 'rent': {
            const details = body.accessDetails.rent;
            if (!isRecord(details))
                throw new Error('Rental details are required.');
            const securityDeposit = details.securityDeposit;
            if (securityDeposit !== undefined && !validNumber(securityDeposit))
                throw new Error('Security deposit must be a valid amount.');
            return { rent: {
                    pricePerMonth: requiredAmount(details.pricePerMonth, 'Price per month'),
                    currency: requiredText(details.currency, 'Currency', 6).toUpperCase(),
                    minRentalMonths: requiredPositiveInteger(details.minRentalMonths, 'Minimum rental period'),
                    ...(securityDeposit === undefined ? {} : { securityDeposit }),
                } };
        }
        case 'installment': {
            const details = body.accessDetails.installment;
            if (!isRecord(details))
                throw new Error('Installment details are required.');
            const totalPrice = requiredAmount(details.totalPrice, 'Total price');
            const downPayment = requiredAmount(details.downPayment, 'Down payment');
            if (downPayment > totalPrice)
                throw new Error('Down payment cannot be greater than the total price.');
            return { installment: {
                    totalPrice,
                    downPayment,
                    monthlyInstallmentAmount: requiredAmount(details.monthlyInstallmentAmount, 'Monthly installment amount'),
                    numberOfMonths: requiredPositiveInteger(details.numberOfMonths, 'Number of months'),
                    lateFeePolicy: requiredText(details.lateFeePolicy, 'Late fee policy', 500),
                } };
        }
        case 'interest_free': {
            const details = body.accessDetails.interestFree;
            if (!isRecord(details))
                throw new Error('Interest-free plan details are required.');
            return { interestFree: {
                    totalPrice: requiredAmount(details.totalPrice, 'Total price'),
                    monthlyInstallmentAmount: requiredAmount(details.monthlyInstallmentAmount, 'Monthly installment amount'),
                    numberOfMonths: requiredPositiveInteger(details.numberOfMonths, 'Number of months'),
                    eligibilityCriteria: requiredCriteria(details.eligibilityCriteria),
                    repaymentStartDate: requiredDate(details.repaymentStartDate, 'Repayment start date'),
                    interestRate: 0,
                } };
        }
        case 'sponsorship': {
            const details = body.accessDetails.sponsorship;
            if (!isRecord(details))
                throw new Error('Sponsorship details are required.');
            const applicationDeadline = requiredDate(details.applicationDeadline, 'Application deadline');
            if (applicationDeadline.getTime() <= Date.now())
                throw new Error('Application deadline must be in the future.');
            return { sponsorship: {
                    eligibilityCriteria: requiredCriteria(details.eligibilityCriteria),
                    applicationDeadline,
                    numberOfUnitsAvailable: requiredPositiveInteger(details.numberOfUnitsAvailable, 'Number of units available'),
                    sponsorOrganization: requiredText(details.sponsorOrganization, 'Sponsor organization', 160),
                } };
        }
        case 'donation': {
            const details = body.accessDetails.donation;
            if (!isRecord(details))
                throw new Error('Donation details are required.');
            if (!validNumber(details.itemAgeYears) || details.itemAgeYears > 100)
                throw new Error('Item age must be between 0 and 100 years.');
            const claimDeadline = requiredDate(details.claimDeadline, 'Claim deadline');
            if (claimDeadline.getTime() <= Date.now())
                throw new Error('Claim deadline must be in the future.');
            return { donation: {
                    itemAgeYears: details.itemAgeYears,
                    conditionNotes: requiredText(details.conditionNotes, 'Condition notes'),
                    pickupOrDeliveryMethod: requiredText(details.pickupOrDeliveryMethod, 'Pickup or delivery method', 100),
                    claimDeadline,
                } };
        }
    }
};
const listingPayload = (body) => {
    const itemName = requiredText(body.itemName, 'Item name', 160);
    if (!categories.includes(body.category))
        throw new Error('Select a valid resource category.');
    if (body.condition !== undefined && !['new', 'used_good', 'used_fair'].includes(body.condition))
        throw new Error('Select a valid item condition.');
    if (!accessTypes.includes(body.accessType))
        throw new Error('Select a valid access type.');
    if (!validInteger(body.quantityAvailable, 1))
        throw new Error('Quantity available must be a whole number of at least 1.');
    if (body.status !== undefined && !statuses.includes(body.status))
        throw new Error('Select a valid listing status.');
    const accessType = body.accessType;
    return {
        itemName,
        category: body.category,
        ...(body.condition === undefined || body.condition === '' ? {} : { condition: body.condition }),
        accessType,
        quantityAvailable: body.quantityAvailable,
        status: (body.status || 'available'),
        accessDetails: detailPayload(body, accessType),
    };
};
const canOfferProviderManagedAccess = (req) => {
    if (req.user?.role === 'admin')
        return true;
    if (req.user?.role !== 'provider')
        return false;
    const profile = req.user.providerProfile;
    return Boolean(profile?.verified) || providerOrganizationTypes.includes(profile?.organizationType || '');
};
/** POST /api/resources */
const createResource = async (req, res) => {
    try {
        const payload = listingPayload(req.body);
        if (req.user?.role === 'student' && !studentAccessTypes.includes(payload.accessType)) {
            res.status(403).json({ success: false, message: 'Students can list resources only for borrow, share, or donation.' });
            return;
        }
        if (peerToPeerAccessTypes.includes(payload.accessType) && req.user?.role !== 'student') {
            res.status(403).json({ success: false, message: 'Borrow and share listings are reserved for student-to-student access.' });
            return;
        }
        if (providerManagedAccessTypes.includes(payload.accessType) && !canOfferProviderManagedAccess(req)) {
            res.status(403).json({ success: false, message: 'Rent, installment, interest-free, and sponsorship listings require an eligible organization or verified provider account.' });
            return;
        }
        const resource = await Resource_1.default.create({
            ...payload,
            listedBy: req.user._id,
            providerOrgVerified: req.user.role === 'provider' && req.user.providerProfile?.verified === true,
        });
        await resource.populate('listedBy', listedBySelect);
        res.status(201).json({ success: true, message: 'Resource listing created.', data: { resource } });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to create resource listing.';
        res.status(400).json({ success: false, message });
    }
};
exports.createResource = createResource;
/** GET /api/resources?item=Laptop&accessType=installment */
const listResources = async (req, res) => {
    try {
        const filter = { status: 'available' };
        if (typeof req.query.accessType === 'string' && accessTypes.includes(req.query.accessType))
            filter.accessType = req.query.accessType;
        if (typeof req.query.category === 'string' && categories.includes(req.query.category))
            filter.category = req.query.category;
        if (typeof req.query.item === 'string' && req.query.item.trim()) {
            const escaped = req.query.item.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.itemName = { $regex: escaped, $options: 'i' };
        }
        const resources = await Resource_1.default.find(filter).populate('listedBy', listedBySelect).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: { resources } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to fetch resource listings.' });
    }
};
exports.listResources = listResources;
/** GET /api/resources/mine */
const listMyResources = async (req, res) => {
    try {
        const resources = await Resource_1.default.find({ listedBy: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: { resources } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Unable to fetch your resource listings.' });
    }
};
exports.listMyResources = listMyResources;
/** GET /api/resources/:id */
const getResource = async (req, res) => {
    try {
        const resource = await Resource_1.default.findById(req.params.id).populate('listedBy', listedBySelect);
        if (!resource) {
            res.status(404).json({ success: false, message: 'Resource listing not found.' });
            return;
        }
        res.status(200).json({ success: true, data: { resource } });
    }
    catch {
        res.status(400).json({ success: false, message: 'Invalid resource listing ID.' });
    }
};
exports.getResource = getResource;
/** PATCH /api/resources/:id/status */
const updateResourceStatus = async (req, res) => {
    try {
        if (!statuses.includes(req.body.status)) {
            res.status(400).json({ success: false, message: 'Status must be available or claimed.' });
            return;
        }
        const resource = await Resource_1.default.findOneAndUpdate({ _id: req.params.id, listedBy: req.user._id }, { status: req.body.status }, { new: true });
        if (!resource) {
            res.status(404).json({ success: false, message: 'Resource listing not found or you do not own it.' });
            return;
        }
        res.status(200).json({ success: true, message: 'Listing status updated.', data: { resource } });
    }
    catch {
        res.status(400).json({ success: false, message: 'Unable to update listing status.' });
    }
};
exports.updateResourceStatus = updateResourceStatus;
/** DELETE /api/resources/:id */
const deleteResource = async (req, res) => {
    try {
        const resource = await Resource_1.default.findOneAndDelete({ _id: req.params.id, listedBy: req.user._id });
        if (!resource) {
            res.status(404).json({ success: false, message: 'Resource listing not found or you do not own it.' });
            return;
        }
        res.status(200).json({ success: true, message: 'Resource listing deleted.' });
    }
    catch {
        res.status(400).json({ success: false, message: 'Unable to delete resource listing.' });
    }
};
exports.deleteResource = deleteResource;
//# sourceMappingURL=resourceController.js.map