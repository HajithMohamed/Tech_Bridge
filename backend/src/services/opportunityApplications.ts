import mongoose, { Types, type ClientSession } from 'mongoose';
import Application, { type ApplicationStatus } from '../models/Application';
import Opportunity from '../models/Opportunity';
import { ApplicationEvent } from '../models/OpportunityActivity';
import { lockOpportunityUsers, opportunityTransactions } from './opportunityDiscovery';
import { defaultOpportunityEligibility, eligibilityInput, explainOrdinaryEligibility, opportunityId, opportunityObject, opportunityText, providerCurrentlyVerified } from './opportunityPolicy';
import { ScholarshipError } from './scholarshipPolicy';
import { enqueueDomainNotification } from './notifications';

export async function recordOrdinaryApplication(application: InstanceType<typeof Application>, actorId: Types.ObjectId, action: 'submitted' | 'decision', session: ClientSession, fromStatus?: ApplicationStatus, reason = 'Application submitted for human review.') {
  await ApplicationEvent.create([{ applicationId: application._id, opportunityId: application.opportunityId, studentId: application.studentId, providerId: application.providerId, actorId, action, fromStatus, toStatus: application.status, revision: application.notificationRevision ?? 0, reason }], { session });
}
export async function submitOrdinaryApplication(studentId: Types.ObjectId, value: unknown) {
  const body = opportunityObject(value, ['opportunityId', 'message', 'justification', 'selfDeclaredNeed']); const id = opportunityId(body.opportunityId);
  const justification = opportunityText(body.justification, 30, 800); const message = body.message === undefined ? undefined : opportunityText(body.message, 0, 1000);
  if (!['low', 'medium', 'high'].includes(body.selfDeclaredNeed as string)) throw new ScholarshipError(400, 'Select your declared need level.');
  return mongoose.connection.transaction(async session => {
    const source = await Opportunity.findById(id).session(session); if (!source) throw new ScholarshipError(404, 'This opportunity is no longer accepting applications.');
    const users = await lockOpportunityUsers([studentId, source.providerId], session);
    const current = await Opportunity.findOneAndUpdate({ _id: id, providerId: source.providerId, type: { $ne: 'scholarship' }, status: 'open', applicationDeadline: { $gt: new Date() }, scholarshipWithdrawnByAdmin: { $ne: true }, opportunityWithdrawnByAdmin: { $ne: true } }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!current || !providerCurrentlyVerified(users.get(String(source.providerId))!)) throw new ScholarshipError(404, 'This opportunity is no longer accepting applications.');
    const student = users.get(String(studentId))!; const rules = current.eligibility ? eligibilityInput(current.toObject().eligibility) : defaultOpportunityEligibility();
    const assessment = explainOrdinaryEligibility(student, rules); if (!assessment.eligible) throw new ScholarshipError(409, assessment.reasons.join(' '));
    const [application] = await Application.create([{ studentId, providerId: current.providerId, opportunityId: id, justification, message, selfDeclaredNeed: body.selfDeclaredNeed, notificationRevision: 0, statusHistoryVersion: 1 }], { session });
    await recordOrdinaryApplication(application, studentId, 'submitted', session);
    await enqueueDomainNotification('application', current.providerId, `application-submitted:${application._id}`, application._id, session, 'submitted');
    return application;
  }, opportunityTransactions);
}
