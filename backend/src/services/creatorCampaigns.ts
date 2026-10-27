import mongoose, { Types, type ClientSession } from 'mongoose';
import User, { type IUser } from '../models/User';
import MessagingSettings from '../models/MessagingSettings';
import PromotionRequest, { type CampaignAction, type IPromotionRequest } from '../models/PromotionRequest';
import { AdminActionError } from './adminUsers';
import { campaignProposalInput, campaignRevision, campaignSubmissionInput, campaignText, creatorId } from './creatorPolicy';
import { assertFutureCampaignDeadline, campaignStage, campaignTerms, legacyCampaignStatus, statusTransition } from './campaignLifecycle';
import { enqueueNotification } from './notifications';

const transactionOptions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
export const campaignCreationLimit = 20;
async function lockParticipants(studentId: Types.ObjectId, providerId: Types.ObjectId, actorId: Types.ObjectId, session: ClientSession, exit = false) {
  const users: IUser[] = [];
  for (const id of [studentId, providerId].sort((a, b) => String(a).localeCompare(String(b)))) {
    const user = await User.findOneAndUpdate({ _id: id }, { $inc: { __v: 1 } }, { session, new: true, timestamps: false });
    if (!user && (!exit || id.equals(actorId))) throw new AdminActionError(409, 'A campaign participant is no longer available.');
    if (user) users.push(user);
  }
  const student = users.find((user) => user._id.equals(studentId));
  const provider = users.find((user) => user._id.equals(providerId));
  const actor = users.find((user) => user._id.equals(actorId));
  const providerVerified = provider?.role === 'provider' && provider.accountStatus === 'active' && provider.providerProfile?.verified === true && provider.providerProfile.verificationStatus === 'VERIFIED';
  if (!actor || actor.accountStatus !== 'active' || actor.role !== (actorId.equals(studentId) ? 'student' : 'provider') || (actorId.equals(providerId) && !providerVerified)) throw new AdminActionError(403, 'An active authorized campaign account is required.');
  if (!exit && (student?.role !== 'student' || student.accountStatus !== 'active' || !providerVerified)) throw new AdminActionError(403, 'Campaigns require an active student and a currently verified provider.');
  return { student: student!, provider: provider! };
}
async function assertInvitable(student: IUser, providerId: Types.ObjectId, session: ClientSession, excluding?: Types.ObjectId, checkDuplicate = true) {
  const profile = student.studentProfile?.creatorProfile;
  if (!profile?.isDiscoverable || profile.availability === 'unavailable') throw new AdminActionError(404, 'This creator is not accepting new campaign requests.');
  const settings = await MessagingSettings.find({ ownerId: { $in: [student._id, providerId] } }).session(session);
  if (settings.some((row) => row.blockedIds.some((id) => id.equals(row.ownerId.equals(student._id) ? providerId : student._id)))) throw new AdminActionError(403, 'Campaign invitations are unavailable for this connection.');
  if (!checkDuplicate) return;
  const duplicate = await PromotionRequest.exists({ studentId: student._id, providerId, status: { $in: ['pending', 'accepted'] }, stage: { $ne: 'draft' }, ...(excluding ? { _id: { $ne: excluding } } : {}) }).session(session);
  if (duplicate) throw new AdminActionError(409, 'An active campaign already exists for this creator and provider.');
}
async function notifyCampaign(row: IPromotionRequest, actorId: Types.ObjectId, action: CampaignAction, session: ClientSession) {
  if (action === 'drafted' || action === 'terms_updated') return;
  const studentRecipient = !row.studentId.equals(actorId); const ownerId = studentRecipient ? row.studentId : row.providerId;
  if (!await User.exists({ _id: ownerId }).session(session)) return;
  const words: Record<CampaignAction, string> = { drafted: 'Campaign draft', terms_updated: 'Campaign draft updated', sent: 'New campaign request', started: 'Campaign in progress', created: 'New campaign request', accepted: 'Campaign accepted', declined: 'Campaign declined', cancelled: 'Campaign cancelled', submitted: 'Deliverables submitted', changes_requested: 'Campaign changes requested', approved: 'Campaign deliverables approved', completed: 'Campaign completed' };
  await enqueueNotification({ ownerId: String(ownerId), kind: 'campaign', title: words[action], body: 'Review the campaign details and next steps in your campaign workspace.', href: studentRecipient ? '/my-promotion-requests' : '/provider/promotion-requests', dedupeKey: `campaign:${row._id}:${row.revision ?? 0}:${ownerId}` }, session);
}
export async function createCampaign(providerId: Types.ObjectId, body: Record<string, unknown>) {
  const values = campaignProposalInput(body);
  if (body.saveAsDraft !== undefined && typeof body.saveAsDraft !== 'boolean') throw new AdminActionError(400, 'Choose whether to save a campaign draft.');
  const draft = body.saveAsDraft === true;
  return mongoose.connection.transaction(async (session) => {
    const { student } = await lockParticipants(values.studentId, providerId, providerId, session);
    await assertInvitable(student, providerId, session, undefined, !draft);
    const recent = await PromotionRequest.countDocuments({ providerId, createdAt: { $gte: new Date(Date.now() - 86_400_000) } }).session(session);
    if (recent >= campaignCreationLimit) throw new AdminActionError(429, 'Campaign creation limit reached. Try again after older requests leave the 24-hour window.');
    const action = draft ? 'drafted' : 'created';
    const [row] = await PromotionRequest.create([{ ...values, providerId, workflowVersion: 2, stage: draft ? 'draft' : 'pending', ...(!draft ? { publishedAt: new Date() } : {}), revision: 0, deliveryStatus: 'not_submitted', history: [{ action, actorId: providerId, actorRole: 'provider', at: new Date(), terms: campaignTerms(values) }] }], { session });
    await notifyCampaign(row, providerId, action, session); return row._id;
  }, transactionOptions);
}
export type CampaignMutation = 'status' | 'submission' | 'review' | 'terms';
export async function changeCampaign(id: Types.ObjectId, actorId: Types.ObjectId, mutation: CampaignMutation, body: Record<string, unknown>) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AdminActionError(400, 'Provide a campaign action.');
  const expectedRevision = campaignRevision(body.revision);
  return mongoose.connection.transaction(async (session) => {
    const row = await PromotionRequest.findById(id).session(session);
    if (!row) throw new AdminActionError(404, 'Campaign request not found.');
    const isStudent = row.studentId.equals(actorId); const isProvider = row.providerId.equals(actorId);
    if (row.workflowVersion === 2 && !row.publishedAt && !isProvider) throw new AdminActionError(404, 'Campaign request not found.');
    if (!isStudent && !isProvider) throw new AdminActionError(403, 'Only this campaign\u2019s participants can update it.');
    const exit = mutation === 'status' && ['cancelled', 'declined'].includes(body.status as string);
    const { student } = await lockParticipants(row.studentId, row.providerId, actorId, session, exit);
    if (expectedRevision !== undefined && expectedRevision !== (row.revision ?? 0)) throw new AdminActionError(409, 'This campaign changed. Refresh it before taking another action.');
    if ((row.history?.length ?? 0) >= (exit ? 100 : 99)) throw new AdminActionError(409, 'This campaign has reached its activity limit; only a final exit may remain.');
    const version2 = row.workflowVersion === 2; const before = campaignStage(row);
    let action: CampaignAction; let note: string | undefined; let terms: ReturnType<typeof campaignTerms> | undefined;
    if (mutation === 'terms') {
      if (!isProvider) throw new AdminActionError(403, 'Only the campaign provider can edit a draft.');
      if (!version2 || before !== 'draft') throw new AdminActionError(409, 'Published campaign terms are immutable. Cancel and create a revised invitation.');
      if (body.studentId !== undefined && body.studentId !== String(row.studentId)) throw new AdminActionError(400, 'A campaign draft cannot be retargeted.');
      const values = campaignProposalInput({ ...body, studentId: String(row.studentId) });
      row.campaignBrief = values.campaignBrief; row.deliverables = values.deliverables; row.compensationType = values.compensationType; row.compensationDetails = values.compensationDetails; row.deadline = values.deadline;
      terms = campaignTerms(row); action = 'terms_updated';
    } else if (mutation === 'status') {
      let next;
      if (version2) next = statusTransition(before, isStudent ? 'student' : 'provider', body.status);
      else if (body.status === 'cancelled' && ['pending', 'accepted'].includes(row.status)) next = 'cancelled' as const;
      else if (isStudent && row.status === 'pending' && ['accepted', 'declined'].includes(body.status as string)) next = body.status as 'accepted' | 'declined';
      else if (isProvider && row.status === 'accepted' && body.status === 'completed' && row.workflowVersion !== 1 && !row.submissions?.length) next = 'completed' as const;
      else throw new AdminActionError(409, 'This campaign action is not allowed in its current state.');
      if (next === 'pending' || next === 'accepted') assertFutureCampaignDeadline(row.deadline);
      if (next === 'pending') { await assertInvitable(student, row.providerId, session, row._id); row.publishedAt = new Date(); terms = campaignTerms(row); action = 'sent'; }
      else if (next === 'accepted') { row.agreedTerms = campaignTerms(row); terms = campaignTerms(row); action = 'accepted'; }
      else if (next === 'in_progress') action = 'started';
      else if (next === 'cancelled') { note = campaignText(body.reason, 'Cancellation reason', 10, 1000); row.cancellationReason = note; row.cancelledAt = new Date(); action = 'cancelled'; }
      else if (next === 'declined' || next === 'completed') action = next;
      else throw new AdminActionError(409, 'Unsupported campaign status action.');
      row.status = legacyCampaignStatus(next); if (version2) row.stage = next;
    } else if (mutation === 'submission') {
      if (!isStudent) throw new AdminActionError(403, 'Only the student creator can submit deliverables.');
      if (version2 ? !['in_progress', 'changes_requested'].includes(before) : row.status !== 'accepted' || row.deliveryStatus === 'submitted') throw new AdminActionError(409, 'Start the campaign or wait for its current submission to be reviewed.');
      if ((row.submissions?.length ?? 0) >= 10) throw new AdminActionError(409, 'A campaign supports up to ten deliverable submissions.');
      const values = campaignSubmissionInput(body); const submittedAt = new Date(); const deadline = row.agreedTerms?.deadline ?? row.deadline;
      row.submissions.push({ _id: new Types.ObjectId(), ...values, submittedAt, isLate: Boolean(deadline && submittedAt > deadline) });
      row.deliveryStatus = 'submitted'; if (version2) row.stage = 'submitted'; action = 'submitted';
    } else {
      if (!isProvider) throw new AdminActionError(403, 'Only the campaign provider can review deliverables.');
      const submission = row.submissions[row.submissions.length - 1];
      if (row.status !== 'accepted' || row.deliveryStatus !== 'submitted' || !submission || (version2 && before !== 'submitted')) throw new AdminActionError(409, 'There is no submitted work awaiting review.');
      if (version2 && !submission._id.equals(creatorId(body.submissionId))) throw new AdminActionError(409, 'Review only the current deliverable submission.');
      if (body.decision !== 'approved' && body.decision !== 'changes_requested') throw new AdminActionError(400, 'Choose approval or request changes.');
      note = body.decision === 'changes_requested' ? campaignText(body.note, 'Change request', 10, 1000) : body.note ? campaignText(body.note, 'Review note', 1, 1000) : undefined;
      submission.review = body.decision; submission.reviewNote = note; submission.reviewedAt = new Date(); row.deliveryStatus = body.decision;
      if (version2) row.stage = body.decision === 'approved' ? 'reviewed' : 'changes_requested';
      else if (body.decision === 'approved') row.status = 'completed';
      action = body.decision;
    }
    row.history.push({ action, actorId, actorRole: isStudent ? 'student' : 'provider', at: new Date(), ...(note ? { note } : {}), ...(terms ? { terms } : {}) });
    row.revision = (row.revision ?? 0) + 1; await row.save({ session });
    if (!(before === 'draft' && action === 'cancelled')) await notifyCampaign(row, actorId, action, session);
    return row._id;
  }, transactionOptions);
}
