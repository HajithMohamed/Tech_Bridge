import mongoose, { Types } from 'mongoose';
import Application, { ApplicationStatus } from '../models/Application';
import Opportunity from '../models/Opportunity';
import User from '../models/User';

export class ScholarshipAwardError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && ['applied', 'reviewed', 'accepted', 'rejected'].includes(value);
}

export function scholarshipCapacity(value: unknown): number {
  if (value === undefined) return 1; // Preserve the existing legacy missing-capacity fallback.
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new ScholarshipAwardError(409, 'This scholarship has an invalid award capacity.');
  }
  return value;
}

// Preserve the existing application-date policy and server-local calendar year.
// This is not an institutional academic-year or actual award-date policy.
export const currentAcademicYearStart = (now = new Date()) => new Date(now.getFullYear(), 0, 1);
const transactionOptions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };

export async function changeApplicationStatus(id: unknown, ownerId: Types.ObjectId, next: unknown) {
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) throw new ScholarshipAwardError(400, 'Invalid application ID.');
  if (!isApplicationStatus(next)) throw new ScholarshipAwardError(400, 'Status must be applied, reviewed, accepted, or rejected.');
  return mongoose.connection.transaction(async (session) => {
    const application = await Application.findOne({ _id: id, providerId: ownerId }).session(session);
    if (!application) throw new ScholarshipAwardError(404, 'Application not found.');
    const opportunity = await Opportunity.findOne({ _id: application.opportunityId, providerId: ownerId }).session(session);
    if (!opportunity) throw new ScholarshipAwardError(404, 'Opportunity not found or you do not own it.');

    if (application.status !== next) {
      if (opportunity.type === 'scholarship' && next === 'accepted') {
        // Serialize a student's scholarship decisions even across providers.
        const student = await User.updateOne(
          { _id: application.studentId, role: 'student', accountStatus: { $ne: 'suspended' } },
          { $inc: { __v: 1 } }, { session, timestamps: false }
        );
        if (student.matchedCount !== 1) throw new ScholarshipAwardError(409, 'The student account is no longer eligible for approval.');
      }
      // Every status writer and opportunity editor shares this serialization point.
      // A conflicting transaction retries against the committed application count.
      await Opportunity.updateOne({ _id: opportunity._id, providerId: ownerId }, { $inc: { __v: 1 } }, { session, timestamps: false });
      if (opportunity.type === 'scholarship' && next === 'accepted') {
        const accepted = await Application.countDocuments({ opportunityId: opportunity._id, status: 'accepted', _id: { $ne: application._id } }).session(session);
        if (accepted >= scholarshipCapacity(opportunity.numberOfAwards)) throw new ScholarshipAwardError(409, 'This scholarship has reached its number of awards.');
        const benefits = await Application.find({ studentId: application.studentId, status: 'accepted', appliedAt: { $gte: currentAcademicYearStart() }, _id: { $ne: application._id } })
          .populate({ path: 'opportunityId', select: 'type', options: { session } }).session(session);
        if (benefits.some((benefit) => (benefit.opportunityId as unknown as { type?: string })?.type === 'scholarship')) {
          throw new ScholarshipAwardError(409, 'This student already holds an accepted scholarship for this academic year.');
        }
      }
      application.status = next;
      await application.save({ session }).catch((error: unknown) => {
        if (error instanceof mongoose.Error.ValidationError) throw new ScholarshipAwardError(400, 'Application validation failed.');
        throw error;
      });
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
    const previousType = opportunity.type;
    applyChanges(opportunity); // Existing payload/capability validation runs on the current document.
    if (previousType === 'scholarship' || opportunity.type === 'scholarship') {
      if (previousType !== opportunity.type && await Application.exists({ opportunityId: id }).session(session)) {
        throw new ScholarshipAwardError(409, 'Scholarship type cannot change after applications have been submitted.');
      }
      if (opportunity.type === 'scholarship') {
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
