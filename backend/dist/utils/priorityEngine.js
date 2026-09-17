"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resourceRequestPriority = exports.applicationPriority = void 0;
const matchEngine_1 = require("./matchEngine");
const needScore = { low: 100 / 3, medium: 200 / 3, high: 100 };
const needLabel = { low: 'Low declared need', medium: 'Medium declared need', high: 'High declared need' };
const timelinessScore = (submittedAt, firstAt, lastAt) => {
    if (firstAt.getTime() === lastAt.getTime())
        return 100;
    return Math.round(100 - ((submittedAt.getTime() - firstAt.getTime()) / (lastAt.getTime() - firstAt.getTime())) * 100);
};
const result = (need, fit, existingBenefits, submittedAt, firstAt, lastAt, isWaitlisted, extraReasons = []) => {
    const equity = Math.max(0, 100 - existingBenefits * 40);
    const timeliness = timelinessScore(submittedAt, firstAt, lastAt);
    const priorityScore = Math.round(needScore[need] * 0.4 + fit * 0.3 + equity * 0.2 + timeliness * 0.1);
    const reasons = [needLabel[need], fit >= 70 ? 'Strong fit for this opportunity' : 'Relevant student profile', existingBenefits ? `Already holds ${existingBenefits} active benefit in this category` : 'No existing active benefit in this category', timeliness >= 70 ? 'Early application' : 'Application order considered', ...extraReasons];
    if (isWaitlisted)
        reasons.push('Capacity is currently filled; shown as waitlisted');
    return { priorityScore, priorityReasons: reasons, isWaitlisted };
};
const applicationPriority = (application, opportunity, student, existingBenefits, firstAt, lastAt, acceptedCount) => {
    const fit = student ? (0, matchEngine_1.matchScore)(student.studentProfile, opportunity).matchPercentage : 50;
    const capacity = opportunity.numberOfAwards ?? Number.MAX_SAFE_INTEGER;
    return result(application.selfDeclaredNeed, fit, existingBenefits, application.appliedAt, firstAt, lastAt, ['applied', 'reviewed'].includes(application.status) && acceptedCount >= capacity);
};
exports.applicationPriority = applicationPriority;
const resourceRequestPriority = (request, resource, student, existingBenefits, firstAt, lastAt, acceptedCount) => {
    const degree = student?.studentProfile?.degree;
    const fit = resource && degree ? 90 : 70;
    const capacity = resource?.quantityAvailable === undefined ? Number.MAX_SAFE_INTEGER : acceptedCount + resource.quantityAvailable;
    const reasons = resource ? [`Matches requested ${resource.category.replace(/_/g, ' ')} access`] : [];
    return result(request.selfDeclaredNeed, fit, existingBenefits, request.createdAt, firstAt, lastAt, request.status === 'pending' && acceptedCount >= capacity, reasons);
};
exports.resourceRequestPriority = resourceRequestPriority;
//# sourceMappingURL=priorityEngine.js.map