"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteResource = exports.updateResourceInventory = exports.updateResourceStatus = exports.getResource = exports.listMyResources = exports.listResources = exports.createResource = void 0;
const Resource_1 = __importDefault(require("../models/Resource"));
const providerCapabilities_1 = require("../utils/providerCapabilities");
const categories = ['laptop', 'arduino', 'raspberry_pi', 'sensor', 'electronic_component', 'dev_board', 'other'];
const accessTypes = ['borrow', 'share', 'rent', 'installment', 'interest_free', 'sponsorship', 'donation'];
const statuses = ['available', 'claimed'];
const studentAccessTypes = ['borrow', 'share', 'donation'];
const peerToPeerAccessTypes = ['borrow', 'share'];
const providerManagedAccessTypes = ['rent', 'installment', 'interest_free', 'sponsorship', 'donation'];
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
const optionalText = (value, label, maxLength = 200) => {
    if (value === undefined || value === '')
        return undefined;
    return requiredText(value, label, maxLength);
};
const optionalNumber = (value, label, minimum = 0) => {
    if (value === undefined || value === '')
        return undefined;
    if (!validNumber(value, minimum))
        throw new Error(`${label} must be a valid number.`);
    return value;
};
const itemDetailsPayload = (body, category) => {
    if (!isRecord(body.itemDetails))
        throw new Error('Item specifications are required.');
    const details = body.itemDetails;
    switch (category) {
        case 'laptop': {
            const laptop = details.laptop;
            if (!isRecord(laptop))
                throw new Error('Laptop specifications are required.');
            const operatingSystem = optionalText(laptop.operatingSystem, 'Operating system', 100);
            const screenSizeInches = optionalNumber(laptop.screenSizeInches, 'Screen size', 1);
            if (!['ssd', 'hdd', 'emmc', 'other'].includes(laptop.storageType))
                throw new Error('Select a valid storage type.');
            return { laptop: {
                    brand: requiredText(laptop.brand, 'Laptop brand', 80), model: requiredText(laptop.model, 'Laptop model', 100),
                    processor: requiredText(laptop.processor, 'Processor', 120), processorGeneration: requiredText(laptop.processorGeneration, 'Processor generation', 80),
                    ramGb: requiredPositiveInteger(laptop.ramGb, 'RAM capacity'), storageGb: requiredPositiveInteger(laptop.storageGb, 'Storage capacity'),
                    storageType: laptop.storageType, ...(operatingSystem ? { operatingSystem } : {}), ...(screenSizeInches ? { screenSizeInches } : {}),
                } };
        }
        case 'arduino': {
            const arduino = details.arduino;
            if (!isRecord(arduino))
                throw new Error('Arduino specifications are required.');
            const usbType = optionalText(arduino.usbType, 'USB type', 50);
            return { arduino: {
                    model: requiredText(arduino.model, 'Arduino model', 100), microcontroller: requiredText(arduino.microcontroller, 'Microcontroller', 100),
                    operatingVoltage: requiredText(arduino.operatingVoltage, 'Operating voltage', 50), digitalPins: validInteger(arduino.digitalPins, 0) ? arduino.digitalPins : (() => { throw new Error('Digital pins must be a whole number.'); })(),
                    analogPins: validInteger(arduino.analogPins, 0) ? arduino.analogPins : (() => { throw new Error('Analog pins must be a whole number.'); })(), ...(usbType ? { usbType } : {}),
                } };
        }
        case 'raspberry_pi': {
            const raspberryPi = details.raspberryPi;
            if (!isRecord(raspberryPi))
                throw new Error('Raspberry Pi specifications are required.');
            const wireless = optionalText(raspberryPi.wireless, 'Wireless connectivity', 120);
            return { raspberryPi: {
                    model: requiredText(raspberryPi.model, 'Raspberry Pi model', 100), processor: requiredText(raspberryPi.processor, 'Processor', 120), ramGb: requiredPositiveInteger(raspberryPi.ramGb, 'RAM capacity'), storageSupport: requiredText(raspberryPi.storageSupport, 'Storage support', 120), ...(wireless ? { wireless } : {}),
                } };
        }
        case 'sensor': {
            const sensor = details.sensor;
            if (!isRecord(sensor))
                throw new Error('Sensor specifications are required.');
            return { sensor: { sensorType: requiredText(sensor.sensorType, 'Sensor type', 120), measuredParameter: requiredText(sensor.measuredParameter, 'Measured parameter', 120), operatingVoltage: requiredText(sensor.operatingVoltage, 'Operating voltage', 50), interface: requiredText(sensor.interface, 'Interface', 100) } };
        }
        case 'electronic_component': {
            const electronicComponent = details.electronicComponent;
            if (!isRecord(electronicComponent))
                throw new Error('Electronic component specifications are required.');
            const voltageRating = optionalText(electronicComponent.voltageRating, 'Voltage rating', 50);
            return { electronicComponent: { componentType: requiredText(electronicComponent.componentType, 'Component type', 120), valueOrRating: requiredText(electronicComponent.valueOrRating, 'Value or rating', 120), packageType: requiredText(electronicComponent.packageType, 'Package type', 120), ...(voltageRating ? { voltageRating } : {}) } };
        }
        case 'dev_board': {
            const devBoard = details.devBoard;
            if (!isRecord(devBoard))
                throw new Error('Development board specifications are required.');
            return { devBoard: { boardModel: requiredText(devBoard.boardModel, 'Board model', 120), microcontrollerOrProcessor: requiredText(devBoard.microcontrollerOrProcessor, 'Microcontroller or processor', 120), memory: requiredText(devBoard.memory, 'Memory', 100), connectivity: requiredText(devBoard.connectivity, 'Connectivity', 160) } };
        }
        case 'other': {
            const other = details.other;
            if (!isRecord(other))
                throw new Error('Resource description is required.');
            const brand = optionalText(other.brand, 'Brand', 80);
            const model = optionalText(other.model, 'Model', 100);
            return { other: { description: requiredText(other.description, 'Resource description'), ...(brand ? { brand } : {}), ...(model ? { model } : {}) } };
        }
    }
};
const imageDataUrlPayload = (value) => {
    if (value === undefined || value === '')
        return undefined;
    if (typeof value !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(value))
        throw new Error('Upload a JPG, PNG, or WebP image.');
    if (value.length > 3500000)
        throw new Error('Image must be 2.5 MB or smaller.');
    return value;
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
        itemDetails: itemDetailsPayload(body, body.category),
        ...(imageDataUrlPayload(body.imageDataUrl) ? { imageDataUrl: imageDataUrlPayload(body.imageDataUrl) } : {}),
        accessDetails: detailPayload(body, accessType),
    };
};
const canOfferProviderManagedAccess = (req) => {
    if (req.user?.role === 'admin')
        return true;
    if (req.user?.role !== 'provider')
        return false;
    const profile = req.user.providerProfile;
    return profile?.verified === true
        && profile.opportunityCategories?.includes('technical_resources') === true
        && (0, providerCapabilities_1.isProviderOfferingAllowed)(profile.organizationType, 'technical_resources');
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
            res.status(403).json({ success: false, message: 'Provider-managed resource listings require a verified provider account with technical resources enabled.' });
            return;
        }
        if (providerManagedAccessTypes.includes(payload.accessType) && req.user?.role === 'provider' && !req.user.providerProfile?.resourceAccessMethods?.includes(payload.accessType)) {
            res.status(403).json({ success: false, message: `Your provider profile is not enabled to offer ${payload.accessType.replace('_', ' ')} arrangements.` });
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
        const existing = await Resource_1.default.findOne({ _id: req.params.id, listedBy: req.user._id });
        if (!existing) {
            res.status(404).json({ success: false, message: 'Resource listing not found or you do not own it.' });
            return;
        }
        if (req.body.status === 'available' && existing.quantityAvailable < 1) {
            res.status(400).json({ success: false, message: 'Add at least one available unit before reopening this listing.' });
            return;
        }
        existing.status = req.body.status;
        await existing.save();
        const resource = existing;
        res.status(200).json({ success: true, message: 'Listing status updated.', data: { resource } });
    }
    catch {
        res.status(400).json({ success: false, message: 'Unable to update listing status.' });
    }
};
exports.updateResourceStatus = updateResourceStatus;
/** PATCH /api/resources/:id/inventory */
const updateResourceInventory = async (req, res) => {
    try {
        if (!validInteger(req.body.quantityAvailable, 0)) {
            res.status(400).json({ success: false, message: 'Available units must be a whole number of zero or more.' });
            return;
        }
        const quantityAvailable = req.body.quantityAvailable;
        const resource = await Resource_1.default.findOneAndUpdate({ _id: req.params.id, listedBy: req.user._id }, { quantityAvailable, status: quantityAvailable > 0 ? 'available' : 'claimed' }, { new: true });
        if (!resource) {
            res.status(404).json({ success: false, message: 'Resource listing not found or you do not own it.' });
            return;
        }
        res.status(200).json({ success: true, message: 'Available units updated.', data: { resource } });
    }
    catch {
        res.status(400).json({ success: false, message: 'Unable to update available units.' });
    }
};
exports.updateResourceInventory = updateResourceInventory;
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