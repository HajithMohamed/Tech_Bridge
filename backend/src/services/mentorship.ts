import mongoose, { Types, type ClientSession, type PipelineStage } from 'mongoose';
import User, { type IUser } from '../models/User';
import { CommunityClaim, type CommunityClaimRecord } from '../models/CommunityClaim';
import { MentorApproval, MentorProfile, Mentorship, MentorshipEvent, type MentorApprovalRecord, type MentorshipRecord, type MentorshipStatus, type TimeWindow } from '../models/Mentorship';
import MessagingSettings from '../models/MessagingSettings';
import AuditLog from '../models/AuditLog';
import { VerificationEvent } from '../models/ProviderVerification';
import { directoryContacts, findDirectoryContact } from '../data/communityDirectory';
import { communityVisible } from './communityPolicy';
import { AdminActionError } from './adminUsers';
import { messageText, assertContactPreferences } from './messagingPolicy';
import { mentorshipBody, mentorshipId, mentorshipPage, mentorshipRevision, mentorProfileInput, mentorshipTransition, mentorshipWindow, windowContains, freeMentorWindows } from './mentorshipPolicy';
import { enqueueDomainNotification } from './notifications';

export const mentorshipTransactions = { readPreference: 'primary' as const, readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
const activeStatuses = ['pending', 'approved', 'scheduled'];
export function mentorIdentityEligible(user: IUser | null, claim: CommunityClaimRecord | null, approval: MentorApprovalRecord | null) {
  if (!user || user.role !== 'provider' || user.accountStatus === 'suspended' || (user.requiresEmailVerification && !user.emailVerifiedAt) || user.providerProfile?.verified !== true || user.providerProfile.verificationStatus !== 'VERIFIED') return false;
  if (['faculty', 'alumni'].includes(user.providerProfile.organizationType)) return communityVisible(user, claim);
  return user.providerProfile.organizationType === 'individual' && Boolean(approval?.status === 'approved' && approval.ownerId.equals(user._id) && user.providerProfile.verificationDocumentId?.equals(approval.documentId));
}
async function identity(id: Types.ObjectId, session: ClientSession | null = null) {
  const user = await User.findById(id).session(session);
  const claim = await CommunityClaim.findOne({ providerId: id }).session(session);
  const approval = await MentorApproval.findOne({ ownerId: id }).session(session);
  return { user, claim, approval, eligible: mentorIdentityEligible(user, claim, approval) };
}
function identityKey(current: Awaited<ReturnType<typeof identity>>) {
  const type = current.user?.providerProfile?.organizationType;
  return `${type}:${current.user?.providerProfile?.verificationDocumentId}:${type === 'individual' ? current.approval?.revision : current.claim?.directoryId}`;
}
export async function lockMentorshipUsers(ids: Types.ObjectId[], session: ClientSession) {
  const users = new Map<string, IUser>();
  for (const id of [...new Set(ids.map(String))].sort()) {
    const user = await User.findOneAndUpdate({ _id: id }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false });
    if (!user) throw new AdminActionError(404, 'Mentorship participant not found.');
    users.set(id, user);
  }
  return users;
}
async function acceptingMentor(mentorId: Types.ObjectId, studentId: Types.ObjectId, session: ClientSession) {
  const current = await identity(mentorId, session);
  const student = await User.findById(studentId).session(session);
  const profile = await MentorProfile.findOne({ ownerId: mentorId, enabled: true }).select('+identityKey').session(session);
  if (!profile || profile.identityKey !== identityKey(current) || !current.eligible || !student || student.role !== 'student' || student.accountStatus === 'suspended' || (student.requiresEmailVerification && !student.emailVerifiedAt)) throw new AdminActionError(409, 'This mentorship connection is not currently available.');
  if (current.claim && ['faculty', 'alumni'].includes(current.user!.providerProfile!.organizationType) && !current.claim.profile.acceptsStudentMessages) throw new AdminActionError(409, 'This mentor has withdrawn student contact consent.');
  const settings = await MessagingSettings.find({ ownerId: { $in: [mentorId, studentId] } }).session(session);
  assertContactPreferences(settings, studentId, mentorId);
  assertContactPreferences(settings, mentorId, studentId);
  return profile;
}
export async function ownMentorProfile(ownerId: Types.ObjectId) {
  const current = await identity(ownerId);
  const profile = await MentorProfile.findOne({ ownerId }).select('+identityKey');
  const settings = await MessagingSettings.findOne({ ownerId });
  const contactEnabled = current.user?.providerProfile?.organizationType === 'individual' || current.claim?.profile.acceptsStudentMessages === true;
  const safe = profile?.toObject(); if (safe) delete safe.identityKey;
  return { profile: safe ?? null, acceptingRequests: Boolean(profile?.enabled && current.eligible && profile.identityKey === identityKey(current) && contactEnabled && settings?.acceptsMessages !== false), identityEligible: current.eligible, approval: current.approval ? { status: current.approval.status, revision: current.approval.revision, documentId: current.approval.documentId } : null };
}
export async function updateMentorProfile(ownerId: Types.ObjectId, value: unknown, now = new Date()) {
  const values = mentorProfileInput(value, now);
  return mongoose.connection.transaction(async session => {
    const users = await lockMentorshipUsers([ownerId], session); const user = users.get(String(ownerId))!;
    if (user.role !== 'provider' || user.accountStatus === 'suspended' || (user.requiresEmailVerification && !user.emailVerifiedAt) || !['faculty', 'alumni', 'individual'].includes(user.providerProfile?.organizationType || '')) throw new AdminActionError(403, 'A faculty, alumni or individual provider account is required.');
    const current = await identity(ownerId, session);
    if (values.enabled && !current.eligible) throw new AdminActionError(403, 'Current community identity verification or explicit industry mentor approval is required.');
    const existing = await MentorProfile.findOne({ ownerId }).session(session);
    if ((existing?.revision ?? 0) !== values.revision) throw new AdminActionError(409, 'Mentor profile changed. Reload before editing.');
    const bookings = await Mentorship.find({ mentorId: ownerId, status: 'scheduled', 'appointment.endAt': { $gt: now } }).select('appointment').session(session);
    if (bookings.some(row => row.appointment && !windowContains(values.windows, row.appointment))) throw new AdminActionError(409, 'Keep confirmed appointments within availability, or cancel/reschedule them first.');
    return MentorProfile.findOneAndUpdate({ ownerId }, { $set: { ...values, identityKey: identityKey(current), revision: values.revision + 1 } }, { new: true, upsert: true, runValidators: true, session });
  }, mentorshipTransactions);
}
export async function decideIndustryMentor(actorId: Types.ObjectId, idValue: unknown, value: unknown) {
  const ownerId = mentorshipId(idValue); const body = mentorshipBody(value, ['revision', 'status', 'documentId', 'reason', 'identityConfirmed', 'expertiseConfirmed']);
  const revision = mentorshipRevision(body.revision); const documentId = mentorshipId(body.documentId); const reason = messageText(body.reason, 10, 1000);
  if (!['approved', 'revoked'].includes(body.status as string)) throw new AdminActionError(400, 'Choose approved or revoked.');
  if (body.status === 'approved' && (body.identityConfirmed !== true || body.expertiseConfirmed !== true)) throw new AdminActionError(400, 'Independently confirm this individual’s identity and mentoring expertise.');
  return mongoose.connection.transaction(async session => {
    const users = await lockMentorshipUsers([actorId, ownerId], session); const actor = users.get(String(actorId))!; const owner = users.get(String(ownerId))!;
    if (actor.role !== 'admin' || actor.accountStatus === 'suspended' || actorId.equals(ownerId)) throw new AdminActionError(403, 'An independent active administrator is required.');
    const current = await MentorApproval.findOne({ ownerId }).session(session);
    if ((current?.revision ?? 0) !== revision) throw new AdminActionError(409, 'Mentor approval changed. Reload before deciding.');
    if (body.status === 'approved') {
      if (current?.status === 'approved' && current.documentId.equals(documentId)) throw new AdminActionError(409, 'This evidence already has active mentor approval.');
      if (owner.role !== 'provider' || owner.accountStatus === 'suspended' || owner.providerProfile?.organizationType !== 'individual' || owner.providerProfile.verified !== true || owner.providerProfile.verificationStatus !== 'VERIFIED' || !owner.providerProfile.verificationDocumentId?.equals(documentId)) throw new AdminActionError(409, 'Approve only currently verified individual providers using their current evidence.');
      if (!await VerificationEvent.exists({ providerId: ownerId, actorId, documentId, action: 'document_reviewed' }).session(session)) throw new AdminActionError(409, 'Review the current verification document before approving this mentor.');
    } else if (!current || current.status !== 'approved' || !current.documentId.equals(documentId)) throw new AdminActionError(409, 'There is no matching active industry approval to revoke.');
    const approval = await MentorApproval.findOneAndUpdate({ ownerId }, { $set: { revision: revision + 1, status: body.status, documentId, actorId, reason } }, { new: true, upsert: true, runValidators: true, session });
    // Revocation withdraws the old opt-in; reapproval never silently publishes it.
    if (body.status === 'revoked') await MentorProfile.updateOne({ ownerId }, { $set: { enabled: false }, $inc: { revision: 1 } }, { session });
    await AuditLog.create([{ adminId: actorId, targetType: 'user', targetId: ownerId, action: `industry_mentor_${body.status}`, reason, before: { role: owner.role, accountStatus: owner.accountStatus, verificationStatus: current?.status ?? 'pending' }, after: { role: owner.role, accountStatus: owner.accountStatus, verificationStatus: body.status }, mentorshipApproval: { documentId, revision: revision + 1 } }], { session });
    await enqueueDomainNotification('mentorship', ownerId, `mentor-approval:${ownerId}:${revision + 1}`, approval!._id, session, 'decision');
    return approval;
  }, mentorshipTransactions);
}

/** Database filtering occurs before pagination; private user/claim data is projected away. */
function publicMentorPipeline(studentId: Types.ObjectId): PipelineStage[] {
  const academic = directoryContacts.filter(contact => contact.category === 'academic').map(contact => contact.id);
  const alumni = directoryContacts.filter(contact => contact.category === 'alumni').map(contact => contact.id);
  return [
    { $match: { enabled: true } },
    { $lookup: { from: User.collection.name, localField: 'ownerId', foreignField: '_id', as: 'user' } }, { $unwind: '$user' },
    { $match: { 'user.role': 'provider', 'user.accountStatus': { $ne: 'suspended' }, 'user.providerProfile.verified': true, 'user.providerProfile.verificationStatus': 'VERIFIED', $or: [{ 'user.requiresEmailVerification': { $ne: true } }, { 'user.emailVerifiedAt': { $type: 'date' } }] } },
    { $lookup: { from: CommunityClaim.collection.name, localField: 'ownerId', foreignField: 'providerId', as: 'claim' } }, { $set: { claim: { $arrayElemAt: ['$claim', 0] } } },
    { $lookup: { from: MentorApproval.collection.name, localField: 'ownerId', foreignField: 'ownerId', as: 'approval' } }, { $set: { approval: { $arrayElemAt: ['$approval', 0] } } },
    { $match: { $expr: { $or: [
      { $and: [{ $eq: ['$user.providerProfile.organizationType', 'individual'] }, { $eq: ['$approval.status', 'approved'] }, { $eq: [{ $type: '$user.providerProfile.verificationDocumentId' }, 'objectId'] }, { $eq: ['$approval.documentId', '$user.providerProfile.verificationDocumentId'] }] },
      { $and: [{ $eq: ['$claim.status', 'APPROVED'] }, { $eq: ['$claim.profile.visibility', 'members'] }, { $eq: ['$claim.profile.acceptsStudentMessages', true] }, { $eq: ['$claim.documentId', '$user.providerProfile.verificationDocumentId'] }, { $or: [
        { $and: [{ $eq: ['$user.providerProfile.organizationType', 'faculty'] }, { $in: ['$claim.directoryId', academic] }] },
        { $and: [{ $eq: ['$user.providerProfile.organizationType', 'alumni'] }, { $in: ['$claim.directoryId', alumni] }] },
      ] }] },
    ] } } },
    { $match: { $expr: { $eq: ['$identityKey', { $concat: ['$user.providerProfile.organizationType', ':', { $toString: '$user.providerProfile.verificationDocumentId' }, ':', { $cond: [{ $eq: ['$user.providerProfile.organizationType', 'individual'] }, { $toString: '$approval.revision' }, '$claim.directoryId'] }] }] } } },
    { $lookup: { from: MessagingSettings.collection.name, localField: 'ownerId', foreignField: 'ownerId', as: 'contact' } },
    { $match: { 'contact.acceptsMessages': { $ne: false }, 'contact.blockedIds': { $ne: studentId } } },
    { $project: { _id: 0, ownerId: 1, expertise: 1, bio: 1, timeZone: 1, revision: 1, organizationType: '$user.providerProfile.organizationType', directoryId: '$claim.directoryId', name: '$user.fullName' } },
  ];
}
function publicMentor(row: Record<string, unknown>) {
  const contact = row.organizationType !== 'individual' && typeof row.directoryId === 'string' ? findDirectoryContact(row.directoryId) : undefined;
  return { mentorId: row.ownerId, name: contact?.name ?? row.name, category: row.organizationType, department: contact && 'department' in contact ? contact.department : undefined, expertise: row.expertise, bio: row.bio, timeZone: row.timeZone, revision: row.revision };
}
export async function discoverMentors(studentId: Types.ObjectId, queryValue: unknown) {
  const query = mentorshipBody(queryValue, ['page', 'limit', 'q', 'expertise', 'department']); const page = mentorshipPage(query.page); const limit = mentorshipPage(query.limit, 20, 20);
  const department = query.department === undefined ? undefined : messageText(query.department, 1, 80);
  const expertise = query.expertise === undefined ? undefined : messageText(query.expertise, 1, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const q = query.q === undefined ? undefined : messageText(query.q, 1, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const settings = await MessagingSettings.findOne({ ownerId: studentId });
  const pipeline = publicMentorPipeline(studentId);
  pipeline.unshift({ $match: { ownerId: { $nin: settings?.blockedIds ?? [] } } });
  if (settings?.acceptsMessages === false) return { mentors: [], page, limit, total: 0, pages: 1 };
  if (department !== undefined) {
    const ids = directoryContacts.filter(contact => 'department' in contact && contact.department === department).map(contact => contact.id);
    pipeline.push({ $match: { organizationType: { $in: ['faculty', 'alumni'] }, directoryId: { $in: ids } } });
  }
  if (expertise !== undefined) pipeline.push({ $match: { expertise: { $regex: expertise, $options: 'i' } } });
  // Directory names are canonical, never the account's self-entered faculty name.
  pipeline.push({ $set: { name: { $switch: { branches: directoryContacts.map(contact => ({ case: { $and: [{ $ne: ['$organizationType', 'individual'] }, { $eq: ['$directoryId', contact.id] }] }, then: { $literal: contact.name } })), default: '$name' } } } });
  if (q !== undefined) pipeline.push({ $match: { $or: [{ name: { $regex: q, $options: 'i' } }, { expertise: { $regex: q, $options: 'i' } }] } });
  pipeline.push({ $facet: { rows: [{ $sort: { name: 1, ownerId: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'total' }] } });
  const [result] = await MentorProfile.aggregate(pipeline); const total = result.count[0]?.total ?? 0;
  return { mentors: result.rows.map(publicMentor), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
export async function mentorAvailability(studentId: Types.ObjectId, idValue: unknown, now = new Date()) {
  const ownerId = mentorshipId(idValue);
  const mine = await MessagingSettings.findOne({ ownerId: studentId });
  const [row] = await MentorProfile.aggregate([{ $match: { ownerId } }, ...publicMentorPipeline(studentId)]);
  if (!row || mine?.acceptsMessages === false || mine?.blockedIds.some(id => id.equals(ownerId))) throw new AdminActionError(404, 'Mentor not found.');
  const profile = await MentorProfile.findOne({ ownerId, enabled: true });
  if (!profile) throw new AdminActionError(404, 'Mentor not found.');
  const bookings = await Mentorship.find({ mentorId: ownerId, status: 'scheduled', 'appointment.endAt': { $gt: now } }).select('appointment');
  return { mentor: publicMentor(row), windows: freeMentorWindows(profile.windows, bookings.flatMap(row => row.appointment ? [row.appointment] : []), now) };
}
export const mentorshipView = (row: MentorshipRecord & { _id: Types.ObjectId }) => ({ _id: row._id, mentorId: row.mentorId, studentId: row.studentId, status: row.status, revision: row.revision, topic: row.topic, message: row.message, appointment: row.appointment, proposal: row.proposal, createdAt: row.createdAt, updatedAt: row.updatedAt });
export async function participantSession(actorId: Types.ObjectId, idValue: unknown, session: ClientSession | null = null) {
  const row = await Mentorship.findOne({ _id: mentorshipId(idValue), $or: [{ mentorId: actorId }, { studentId: actorId }] }).session(session);
  if (!row) throw new AdminActionError(404, 'Mentorship session not found.'); return row;
}
async function recordEvent(row: MentorshipRecord & { _id: Types.ObjectId }, actorId: Types.ObjectId, action: string, fromStatus: MentorshipStatus | 'none', session: ClientSession, reason?: string) {
  const [event] = await MentorshipEvent.create([{ sessionId: row._id, actorId, action, revision: row.revision, fromStatus, toStatus: row.status, reason, appointment: row.appointment, proposal: row.proposal }], { session });
  const otherId = actorId.equals(row.mentorId) ? row.studentId : row.mentorId;
  await enqueueDomainNotification('mentorship', otherId, `mentorship-event:${event._id}`, row._id, session, action === 'requested' ? 'submitted' : 'updated');
}
export async function requestMentorship(studentId: Types.ObjectId, value: unknown, now = new Date()) {
  const body = mentorshipBody(value, ['mentorId', 'topic', 'message']); const mentorId = mentorshipId(body.mentorId);
  const topic = messageText(body.topic, 3, 120); const message = messageText(body.message, 20, 1000);
  if (mentorId.equals(studentId)) throw new AdminActionError(400, 'Choose a different mentor.');
  try { return await mongoose.connection.transaction(async session => {
    await lockMentorshipUsers([studentId, mentorId], session); await acceptingMentor(mentorId, studentId, session);
    if (await Mentorship.exists({ mentorId, studentId, status: { $in: activeStatuses } }).session(session)) throw new AdminActionError(409, 'You already have an active request with this mentor.');
    if (await Mentorship.countDocuments({ studentId, createdAt: { $gte: new Date(now.getTime() - 86_400_000) } }).session(session) >= 10) throw new AdminActionError(429, 'You may request up to ten mentorship sessions in 24 hours.');
    const [row] = await Mentorship.create([{ mentorId, studentId, topic, message, status: 'pending', revision: 1 }], { session });
    await recordEvent(row, studentId, 'requested', 'none', session); return row;
  }, mentorshipTransactions); } catch (error) { if ((error as { code?: number }).code === 11000) throw new AdminActionError(409, 'You already have an active request with this mentor.'); throw error; }
}
async function assertSlot(row: MentorshipRecord & { _id: Types.ObjectId }, slot: TimeWindow, session: ClientSession) {
  const profile = await acceptingMentor(row.mentorId, row.studentId, session);
  if (!windowContains(profile.windows, slot)) throw new AdminActionError(409, 'The requested time is outside the mentor’s current availability.');
  if (await Mentorship.exists({ _id: { $ne: row._id }, status: 'scheduled', $or: [{ mentorId: row.mentorId }, { studentId: row.studentId }], 'appointment.startAt': { $lt: slot.endAt }, 'appointment.endAt': { $gt: slot.startAt } }).session(session)) throw new AdminActionError(409, 'A participant already has an overlapping appointment.');
}
export async function changeMentorship(actorId: Types.ObjectId, idValue: unknown, action: string, value: unknown, now = new Date()) {
  const body = mentorshipBody(value, action === 'propose' ? ['revision', 'startAt', 'endAt', 'reason'] : ['revision', 'reason']); const revision = mentorshipRevision(body.revision);
  const reason = body.reason === undefined ? undefined : messageText(body.reason, 3, 1000);
  if (['reject', 'cancel', 'decline'].includes(action) && !reason) throw new AdminActionError(400, 'Provide a reason for this action.');
  const slot = action === 'propose' ? mentorshipWindow({ startAt: body.startAt, endAt: body.endAt }, now) : undefined;
  return mongoose.connection.transaction(async session => {
    const first = await participantSession(actorId, idValue, session);
    const users = await lockMentorshipUsers([first.mentorId, first.studentId], session); const actor = users.get(String(actorId))!;
    if (actor.accountStatus === 'suspended' || (actor.requiresEmailVerification && !actor.emailVerifiedAt)) throw new AdminActionError(403, 'An active verified session is required.');
    const row = await participantSession(actorId, idValue, session);
    if (row.revision !== revision) throw new AdminActionError(409, 'Session changed. Reload before acting.');
    const fromStatus = row.status; const role = actorId.equals(row.mentorId) ? 'mentor' : 'student';
    if (['approve', 'reject', 'complete'].includes(action) && role !== 'mentor') throw new AdminActionError(403, 'Only this session’s mentor may perform that action.');
    if (['propose', 'accept', 'decline'].includes(action)) {
      if (!['approved', 'scheduled'].includes(row.status)) throw new AdminActionError(409, 'Approve the request before arranging an appointment.');
      if (row.appointment && row.appointment.endAt <= now) throw new AdminActionError(409, 'An ended appointment cannot be rescheduled.');
      if (action === 'propose') {
        if (await MentorshipEvent.countDocuments({ actorId, action: 'propose', createdAt: { $gte: new Date(now.getTime() - 86_400_000) } }).session(session) >= 20) throw new AdminActionError(429, 'You may propose up to twenty appointment times in 24 hours.');
        await assertSlot(row, slot!, session); row.proposal = { ...slot!, proposedBy: actorId };
      } else {
        if (!row.proposal || row.proposal.proposedBy.equals(actorId)) throw new AdminActionError(403, 'Only the other participant may accept or decline a proposal.');
        if (action === 'accept') {
          const proposed = mentorshipWindow({ startAt: row.proposal.startAt.toISOString(), endAt: row.proposal.endAt.toISOString() }, now);
          await assertSlot(row, proposed, session); row.appointment = proposed; row.status = 'scheduled';
        }
        row.proposal = undefined;
      }
    } else {
      row.status = mentorshipTransition(row.status, action, role, row.appointment?.endAt, now);
      if (action === 'approve') await acceptingMentor(row.mentorId, row.studentId, session);
      row.proposal = undefined;
    }
    row.revision += 1; await row.save({ session }); await recordEvent(row, actorId, action, fromStatus, session, reason); return row;
  }, mentorshipTransactions);
}
export async function listMentorships(actorId: Types.ObjectId, queryValue: unknown) {
  const query = mentorshipBody(queryValue, ['page', 'limit', 'status']); const page = mentorshipPage(query.page); const limit = mentorshipPage(query.limit, 20, 50);
  if (query.status !== undefined && !['pending', 'approved', 'scheduled', 'completed', 'rejected', 'cancelled'].includes(query.status as string)) throw new AdminActionError(400, 'Choose a valid session status.');
  const filter = { $or: [{ studentId: actorId }, { mentorId: actorId }], ...(query.status ? { status: query.status } : {}) };
  const [rows, total] = await Promise.all([Mentorship.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), Mentorship.countDocuments(filter)]);
  return { sessions: rows.map(mentorshipView), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Recheck appointment identity and current consent before materializing a reminder. */
export async function mentorshipReminderAvailable(sourceId: Types.ObjectId | undefined, ownerId: Types.ObjectId, scheduledFor: Date | undefined, now: Date, session: ClientSession) {
  if (!sourceId || !scheduledFor) return false;
  const row = await Mentorship.findOne({ _id: sourceId, status: 'scheduled', $or: [{ mentorId: ownerId }, { studentId: ownerId }] }).session(session);
  if (!row?.appointment || row.appointment.startAt.getTime() !== scheduledFor.getTime() || scheduledFor <= now || scheduledFor.getTime() > now.getTime() + 86_400_000) return false;
  if (await User.countDocuments({ _id: { $in: [row.mentorId, row.studentId] } }).session(session) !== 2) return false;
  await lockMentorshipUsers([row.mentorId, row.studentId], session);
  try { await acceptingMentor(row.mentorId, row.studentId, session); return true; }
  catch (error) { if (error instanceof AdminActionError) return false; throw error; }
}
