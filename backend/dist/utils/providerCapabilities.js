"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProviderOfferingAllowed = exports.organizationTypes = exports.providerServiceMatrix = exports.providerOfferings = void 0;
exports.providerOfferings = ['jobs', 'internships', 'scholarships', 'training', 'mentorship', 'technical_resources'];
exports.providerServiceMatrix = {
    company: ['jobs', 'internships', 'mentorship'],
    scholarship_org: ['scholarships'],
    training_org: ['training'],
    individual: ['mentorship'],
    resource_provider: ['technical_resources'],
    local_business: ['jobs'],
    alumni: ['jobs', 'internships', 'mentorship'],
    faculty: ['training', 'mentorship'],
    ngo: ['scholarships', 'mentorship', 'technical_resources'],
};
exports.organizationTypes = Object.keys(exports.providerServiceMatrix);
const isProviderOfferingAllowed = (organizationType, offering) => exports.providerServiceMatrix[organizationType].includes(offering);
exports.isProviderOfferingAllowed = isProviderOfferingAllowed;
//# sourceMappingURL=providerCapabilities.js.map