import type { Request, Response } from 'express';
import User from '../models/User';
import AuditLog from '../models/AuditLog';
import { MentorApproval, MentorProfile, MentorshipEvent } from '../models/Mentorship';
import { AdminActionError } from '../services/adminUsers';
import { changeMentorship, decideIndustryMentor, discoverMentors, listMentorships, mentorAvailability, mentorshipView, ownMentorProfile, participantSession, requestMentorship, updateMentorProfile } from '../services/mentorship';
import { mentorshipBody, mentorshipId, mentorshipPage } from '../services/mentorshipPolicy';

export function mentorshipFailure(res: Response, error: unknown) {
  if (error instanceof AdminActionError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
  res.status(503).json({ success: false, message: 'Unable to complete mentorship operation. Please try again.' });
}
export const getMentorProfile = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: await ownMentorProfile(req.user!._id) }); } catch (error) { mentorshipFailure(res, error); }
};
export const saveMentorProfile = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: { profile: await updateMentorProfile(req.user!._id, req.body) } }); } catch (error) { mentorshipFailure(res, error); }
};
export const browseMentors = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: await discoverMentors(req.user!._id, req.query) }); } catch (error) { mentorshipFailure(res, error); }
};
export const getMentorAvailability = async (req: Request, res: Response) => {
  try { mentorshipBody(req.query, []); res.json({ success: true, data: await mentorAvailability(req.user!._id, req.params.id) }); } catch (error) { mentorshipFailure(res, error); }
};
export const createMentorship = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, data: { session: mentorshipView(await requestMentorship(req.user!._id, req.body)) } }); } catch (error) { mentorshipFailure(res, error); }
};
export const getMentorships = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: await listMentorships(req.user!._id, req.query) }); } catch (error) { mentorshipFailure(res, error); }
};
export const getMentorship = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: { session: mentorshipView(await participantSession(req.user!._id, req.params.id)) } }); } catch (error) { mentorshipFailure(res, error); }
};
export const actOnMentorship = (action: string) => async (req: Request, res: Response) => {
  try { res.json({ success: true, data: { session: mentorshipView(await changeMentorship(req.user!._id, req.params.id, action, req.body)) } }); } catch (error) { mentorshipFailure(res, error); }
};
export const mentorshipHistory = async (req: Request, res: Response) => {
  try {
    const row = await participantSession(req.user!._id, req.params.id);
    const query = mentorshipBody(req.query, ['page', 'limit']); const page = mentorshipPage(query.page); const limit = mentorshipPage(query.limit, 20, 50);
    const [events, total] = await Promise.all([MentorshipEvent.find({ sessionId: row._id }).select('-__v').sort({ revision: -1 }).skip((page - 1) * limit).limit(limit), MentorshipEvent.countDocuments({ sessionId: row._id })]);
    res.json({ success: true, data: { events, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { mentorshipFailure(res, error); }
};
export const approveIndustryMentor = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: { approval: await decideIndustryMentor(req.user!._id, req.params.id, req.body) } }); } catch (error) { mentorshipFailure(res, error); }
};
export const industryMentors = async (req: Request, res: Response) => {
  try {
    const query = mentorshipBody(req.query, ['page', 'limit']); const page = mentorshipPage(query.page); const limit = mentorshipPage(query.limit, 20, 50);
    const filter = { role: 'provider', 'providerProfile.organizationType': 'individual' };
    const [users, total] = await Promise.all([User.find(filter).select('fullName accountStatus providerProfile.verificationStatus providerProfile.verificationDocumentId').sort({ _id: 1 }).skip((page - 1) * limit).limit(limit), User.countDocuments(filter)]);
    const approvals = await MentorApproval.find({ ownerId: { $in: users.map(user => user._id) } }).select('-__v');
    const profiles = await MentorProfile.find({ ownerId: { $in: users.map(user => user._id) } }).select('ownerId expertise enabled');
    res.json({ success: true, data: { mentors: users.map(user => ({ user, approval: approvals.find(row => row.ownerId.equals(user._id)) ?? null, profile: profiles.find(row => row.ownerId.equals(user._id)) ?? null })), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { mentorshipFailure(res, error); }
};
export const industryMentorHistory = async (req: Request, res: Response) => {
  try {
    const targetId = mentorshipId(req.params.id); const query = mentorshipBody(req.query, ['page', 'limit']); const page = mentorshipPage(query.page); const limit = mentorshipPage(query.limit, 20, 50);
    const filter = { targetType: 'user', targetId, action: { $in: ['industry_mentor_approved', 'industry_mentor_revoked'] } };
    const [events, total] = await Promise.all([AuditLog.find(filter).select('-__v').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), AuditLog.countDocuments(filter)]);
    res.json({ success: true, data: { events, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { mentorshipFailure(res, error); }
};
