import mongoose, { Types } from 'mongoose';
import Application, { ApplicationStatus } from '../models/Application';
import Opportunity from '../models/Opportunity';
import User from '../models/User';
import { academicYearStart, awardCapacity, scholarshipRevision, ScholarshipError as ScholarshipAwardError } from './scholarshipPolicy';
import { lockScholarshipActor, prepareScholarshipDecision, type ScholarshipDecisionOptions } from './scholarships';
import { enqueueDomainNotification } from './notifications';
export { ScholarshipError as ScholarshipAwardError } from './scholarshipPolicy';

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && ['applied', 'reviewed', 'accepted', 'rejected', 'waitlisted'].includes(value);
}

export const scholarshipCapacity = awardCapacity;

// Preserve the existing application-date policy and server-local calendar year.
// This is not an institutional academic-year or actual award-date policy.
export const currentAcademicYearStart = academicYearStart;
const transactionOptions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };

export async function changeApplicationStatus(id: unknown, ownerId: Types.ObjectId, next: unknown, options: ScholarshipDecisionOptions = {}) {
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) throw new ScholarshipAwardError(400, 'Invalid application ID.');
  if (!isApplicationStatus(next)) throw new ScholarshipAwardError(400, 'Choose a valid application status.');
  scholarshipRevision(options.revision, options.requireWaitlisted === true);
  return mongoose.connection.transaction(async (session) => {
    const application = await Application.findOne({ _id: id, providerId: ownerId }).session(session);
    if (!application) throw new ScholarshipAwardError(404, 'Application not found.');
    const opportunity = await Opportunity.findOne({ _id: application.opportunityId, providerId: ownerId }).session(session);
    if (!opportunity) throw new ScholarshipAwardError(404, 'Opportunity not found or you do not own it.');
    if (options.opportunityId && String(opportunity._id) !== options.opportunityId) throw new ScholarshipAwardError(404, 'Waitlisted application not found.');
    if (options.requireWaitlisted && application.status !== 'waitlisted') throw new ScholarshipAwardError(409, 'Choose a currently waitlisted application.');
    if (next === 'waitlisted' && opportunity.type !== 'scholarship') throw new ScholarshipAwardError(400, 'Persistent waitlists are available for scholarships.');

    if (application.status !== next) {
      if (opportunity.type === 'scholarship' && next === 'accepted') {
        // Serialize a student's scholarship decisions even across providers.
        const student = await User.updateOne(
          { _id: application.studentId, role: 'student', accountStatus: { $ne: 'suspended' } },
          { $inc: { __v: 1 } }, { session, timestamps: false }
        );
        if (student.matchedCount !== 1) throw new ScholarshipAwardError(409, 'The student account is no longer eligible for approval.');
      }
      if (opportunity.type === 'scholarship') await lockScholarshipActor(ownerId, 'provider', session);
      // Every status writer and opportunity editor shares this serialization point.
      // A conflicting transaction retries against the committed application count.
      await Opportunity.updateOne({ _id: opportunity._id, providerId: ownerId }, { $inc: { __v: 1 } }, { session, timestamps: false });
      if (opportunity.type === 'scholarship' && next === 'accepted') {
        const accepted = await Application.countDocuments({ opportunityId: opportunity._id, status: 'accepted', _id: { $ne: application._id } }).session(session);
        if (accepted >= scholarshipCapacity(opportunity.numberOfAwards)) throw new ScholarshipAwardError(409, 'This scholarship has reached its number of awards.');
      }
      if (opportunity.type === 'scholarship') await prepareScholarshipDecision(application, opportunity, ownerId, next, options, session);
      application.status = next;
      if (opportunity.type !== 'scholarship') application.notificationRevision = (application.notificationRevision ?? 0) + 1;
      await application.save({ session }).catch((error: unknown) => {
        if (error instanceof mongoose.Error.ValidationError) throw new ScholarshipAwardError(400, 'Application validation failed.');
        throw error;
      });
      if (opportunity.type !== 'scholarship') await enqueueDomainNotification('application', application.studentId, `application:${application._id}:${application.notificationRevision}`, application._id, session, 'decision');
    }
    await application.populate({ path: 'studentId', select: 'fullName email studentProfile.institution studentProfile.degree studentProfile.studyYear studentProfile.skills studentProfile.careerGoal', options: { session } });
    await application.populate({ path: 'opportunityId', select: 'title type location workMode applicationDeadline providerId status', options: { session } });
    return application;
  }, transactionOptions);
}

type OpportunityDocument = InstanceType<typeof Opportunity>;
export async function editOpportunityWithAwardGuard(id: Types.ObjectId, ownerId: Types.ObjectId, applyChanges: (opportunity: OpportunityDocument) => void) {
  return mongoose.connection.transaction(async (session) => {
    const opportunity = await Opportunity.findOneAndUpdate(
      { _id: id, providerId: ownerId }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false }
    );
    if (!opportunity) throw new ScholarshipAwardError(404, 'Opportunity not found or you do not own it.');
    if (opportunity.scholarshipWithdrawnByAdmin) throw new ScholarshipAwardError(403, 'This withdrawn scholarship is retained for history and cannot be republished.');
    const previous = opportunity.toObject();
    const previousType = opportunity.type;
    applyChanges(opportunity); // Existing payload/capability validation runs on the current document.
    if (previousType === 'scholarship' || opportunity.type === 'scholarship') {
      if (previousType !== opportunity.type && await Application.exists({ opportunityId: id }).session(session)) {
        throw new ScholarshipAwardError(409, 'Scholarship type cannot change after applications have been submitted.');
      }
      if (opportunity.type === 'scholarship') {
        if (await Application.exists({ opportunityId: id, scholarshipVersion: 1 }).session(session)) {
          for (const field of ['title', 'description', 'requiredSkills', 'location', 'workMode', 'amount', 'currency', 'coverageType', 'eligibilityCriteria', 'renewable'] as const) {
            if (JSON.stringify(previous[field]) !== JSON.stringify(opportunity[field])) throw new ScholarshipAwardError(409, 'Published scholarship terms are frozen after versioned applications. Create a new listing for different terms.');
          }
          if (opportunity.applicationDeadline < previous.applicationDeadline) throw new ScholarshipAwardError(409, 'Do not shorten the deadline after versioned applications.');
        }
        const accepted = await Application.countDocuments({ opportunityId: id, status: 'accepted' }).session(session);
        if (accepted > scholarshipCapacity(opportunity.numberOfAwards)) throw new ScholarshipAwardError(409, 'Award capacity cannot be lower than the accepted application count.');
      }
    }
    await opportunity.save({ session }).catch((error: unknown) => {
      if (error instanceof mongoose.Error.ValidationError) throw new ScholarshipAwardError(400, 'Opportunity validation failed.');
      throw error;
    });
    return opportunity;
  }, transactionOptions);
}
