import mongoose, { Types, type ClientSession } from 'mongoose';
import User, { type IUser } from '../models/User';
import PromotionRequest, { type CampaignAction, type IPromotionRequest } from '../models/PromotionRequest';
import { AdminActionError } from './adminUsers';
import { campaignProposalInput, campaignRevision, campaignSubmissionInput, creatorText } from './creatorPolicy';
import { enqueueNotification } from './notifications';

const transactionOptions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
async function lockParticipants(studentId: Types.ObjectId, providerId: Types.ObjectId, session: ClientSession) {
  const users: IUser[] = [];
  for (const id of [studentId, providerId].sort((a, b) => String(a).localeCompare(String(b)))) {
    const user = await User.findOneAndUpdate({ _id: id, accountStatus: 'active' }, { $inc: { __v: 1 } }, { session, new: true, timestamps: false });
    if (!user) throw new AdminActionError(409, 'A campaign participant is no longer available.');
    users.push(user);
  }
  const student = users.find((user) => user._id.equals(studentId));
  const provider = users.find((user) => user._id.equals(providerId));
  if (student?.role !== 'student' || provider?.role !== 'provider' || !provider.providerProfile?.verified || provider.providerProfile.verificationStatus !== 'VERIFIED') throw new AdminActionError(403, 'Campaigns require an active student and a currently verified provider.');
  return { student, provider };
}
async function notifyCampaign(row: IPromotionRequest, actorId: Types.ObjectId, action: CampaignAction, session: ClientSession) {
  const studentRecipient = !row.studentId.equals(actorId);
  const ownerId = studentRecipient ? row.studentId : row.providerId;
  const words: Record<CampaignAction, string> = { created: 'New campaign request', accepted: 'Campaign accepted', declined: 'Campaign declined', cancelled: 'Campaign cancelled', submitted: 'Deliverables submitted', changes_requested: 'Campaign changes requested', approved: 'Campaign deliverables approved', completed: 'Campaign completed' };
  await enqueueNotification({ ownerId: String(ownerId), kind: 'campaign', title: words[action], body: 'Review the campaign details and next steps in your campaign workspace.', href: studentRecipient ? '/my-promotion-requests' : '/provider/promotion-requests', dedupeKey: `campaign:${row._id}:${row.revision ?? 0}:${ownerId}` }, session);
}
export async function createCampaign(providerId: Types.ObjectId, body: Record<string, unknown>) {
  const values = campaignProposalInput(body);
  return mongoose.connection.transaction(async (session) => {
    const { student } = await lockParticipants(values.studentId, providerId, session);
    const profile = student.studentProfile?.creatorProfile;
    if (!profile?.isDiscoverable || profile.availability === 'unavailable') throw new AdminActionError(404, 'This creator is not accepting new campaign requests.');
    const [row] = await PromotionRequest.create([{ ...values, providerId, workflowVersion: 1, revision: 0, deliveryStatus: 'not_submitted', history: [{ action: 'created', actorId: providerId, actorRole: 'provider', at: new Date() }] }], { session });
    await notifyCampaign(row, providerId, 'created', session);
    return row._id;
  }, transactionOptions);
}
export type CampaignMutation = 'status' | 'submission' | 'review';
export async function changeCampaign(id: Types.ObjectId, actorId: Types.ObjectId, mutation: CampaignMutation, body: Record<string, unknown>) {
  const expectedRevision = campaignRevision(body.revision);
  return mongoose.connection.transaction(async (session) => {
    const row = await PromotionRequest.findById(id).session(session);
    if (!row) throw new AdminActionError(404, 'Campaign request not found.');
    const isStudent = row.studentId.equals(actorId); const isProvider = row.providerId.equals(actorId);
    if (!isStudent && !isProvider) throw new AdminActionError(403, 'Only this campaign’s participants can update it.');
    await lockParticipants(row.studentId, row.providerId, session);
    if (expectedRevision !== undefined && expectedRevision !== (row.revision ?? 0)) throw new AdminActionError(409, 'This campaign changed. Refresh it before taking another action.');
    if ((row.history?.length ?? 0) >= 100) throw new AdminActionError(409, 'This campaign has reached its activity limit.');
    let action: CampaignAction; let note: string | undefined;
    if (mutation === 'status') {
      if (body.status === 'cancelled') {
        if (!['pending', 'accepted'].includes(row.status)) throw new AdminActionError(409, 'Only a pending or accepted campaign can be cancelled.');
        note = creatorText(body.reason, 'Cancellation reason', 10, 1000);
        row.status = 'cancelled'; row.cancellationReason = note; row.cancelledAt = new Date(); action = 'cancelled';
      } else if (isStudent && row.status === 'pending' && (body.status === 'accepted' || body.status === 'declined')) {
        row.status = body.status; action = body.status;
      } else if (isProvider && row.status === 'accepted' && body.status === 'completed' && row.workflowVersion !== 1 && !row.submissions?.length) {
        // Keep the old completion contract for pre-workflow accepted campaigns.
        row.status = 'completed'; action = 'completed';
      } else throw new AdminActionError(409, 'This campaign action is not allowed in its current state.');
    } else if (mutation === 'submission') {
      if (!isStudent) throw new AdminActionError(403, 'Only the student creator can submit deliverables.');
      if (row.status !== 'accepted' || row.deliveryStatus === 'submitted') throw new AdminActionError(409, 'Accept the campaign, or wait for its current submission to be reviewed.');
      if ((row.submissions?.length ?? 0) >= 10) throw new AdminActionError(409, 'A campaign supports up to ten deliverable submissions.');
      const values = campaignSubmissionInput(body);
      row.submissions.push({ _id: new Types.ObjectId(), ...values, submittedAt: new Date() });
      row.deliveryStatus = 'submitted'; action = 'submitted';
    } else {
      if (!isProvider) throw new AdminActionError(403, 'Only the campaign provider can review deliverables.');
      const submission = row.submissions[row.submissions.length - 1];
      if (row.status !== 'accepted' || row.deliveryStatus !== 'submitted' || !submission) throw new AdminActionError(409, 'There is no submitted work awaiting review.');
      if (body.decision !== 'approved' && body.decision !== 'changes_requested') throw new AdminActionError(400, 'Choose approval or request changes.');
      note = body.decision === 'changes_requested' ? creatorText(body.note, 'Change request', 10, 1000) : body.note ? creatorText(body.note, 'Review note', 1, 1000) : undefined;
      submission.review = body.decision; submission.reviewNote = note; submission.reviewedAt = new Date();
      row.deliveryStatus = body.decision;
      if (body.decision === 'approved') row.status = 'completed';
      action = body.decision;
    }
    row.history.push({ action, actorId, actorRole: isStudent ? 'student' : 'provider', at: new Date(), ...(note ? { note } : {}) });
    row.revision = (row.revision ?? 0) + 1;
    await row.save({ session });
    await notifyCampaign(row, actorId, action, session);
    return row._id;
  }, transactionOptions);
}
