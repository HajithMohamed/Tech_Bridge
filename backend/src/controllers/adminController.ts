import { AdminActionError, adminId, adminPage, changeManagedUser, userListFilter } from '../services/adminUsers';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog';
import Opportunity from '../models/Opportunity';
import Report from '../models/Report';
import Resource from '../models/Resource';
import User from '../models/User';
import { reviewReportedMessage, resolveMessageReport } from '../services/messageReports';
import { messageId, messageText } from '../services/messagingPolicy';

const audit = (adminId: mongoose.Types.ObjectId, action: string, targetType: 'user' | 'opportunity' | 'resource', targetId: mongoose.Types.ObjectId, reason?: string) =>
  AuditLog.create({ adminId, action, targetType, targetId, ...(reason ? { reason } : {}) });

const validId = (id: string | string[]) => mongoose.isValidObjectId(Array.isArray(id) ? id[0] : id);

const adminFailure = (res: Response, error: unknown): void => {
  if (error instanceof AdminActionError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
  res.status(503).json({ success: false, message: 'Unable to complete this administrative action. Please try again later.' });
};
export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = userListFilter(req.query);
    const page = adminPage(req.query.page);
    const [users, total] = await Promise.all([
      User.find(filter).select('fullName email role accountStatus adminBaseRole providerProfile.organizationName providerProfile.organizationType providerProfile.verificationStatus createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, data: { users, page, total, pages: Math.max(1, Math.ceil(total / 20)) } });
  } catch (error) { adminFailure(res, error); }
};
const changeAccountStatus = (status: 'active' | 'suspended') => async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await changeManagedUser(req.user!._id, req.params.id, { kind: 'status', value: status }, req.body?.reason);
    res.json({ success: true, message: status === 'active' ? 'Account reinstated.' : 'Account suspended.', data: { user } });
  } catch (error) { adminFailure(res, error); }
};
export const suspendUser = changeAccountStatus('suspended');
export const reinstateUser = changeAccountStatus('active');
export const changeUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await changeManagedUser(req.user!._id, req.params.id, { kind: 'role', value: req.body?.role }, req.body?.reason);
    res.json({ success: true, message: 'Account role updated. The user must sign in again.', data: { user } });
  } catch (error) { adminFailure(res, error); }
};
export const listUserHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = adminId(req.params.id);
    if (!await User.exists({ _id: targetId })) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    const page = adminPage(req.query.page);
    const filter = { targetType: 'user', targetId };
    const [entries, total] = await Promise.all([
      AuditLog.find(filter).populate('adminId', 'fullName email').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 30).limit(30),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ success: true, data: { entries, page, total, pages: Math.max(1, Math.ceil(total / 30)) } });
  } catch (error) { adminFailure(res, error); }
};

export const listReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' && ['open', 'reviewed', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
    const reports = await Report.find({ status }).populate('reporterId', 'fullName email role').sort({ createdAt: -1 });
    res.json({ success: true, data: { reports } });
  } catch { res.status(500).json({ success: false, message: 'Unable to load reports.' }); }
};

export const resolveReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, resolutionNote, removeTarget } = req.body as { status?: string; resolutionNote?: string; removeTarget?: boolean };
    if (!validId(req.params.id) || !['reviewed', 'dismissed'].includes(status || '')) { res.status(400).json({ success: false, message: 'Select reviewed or dismissed.' }); return; }
    const report = await Report.findById(req.params.id);
    if (!report) { res.status(404).json({ success: false, message: 'Report not found.' }); return; }
    if (report.targetType === 'message') {
      if (removeTarget) throw new AdminActionError(400, 'Private message deletion is not supported by this review workflow.');
      const resolved = await resolveMessageReport(req.user!._id, messageId(req.params.id), status as 'reviewed' | 'dismissed', messageText(resolutionNote, 10, 500));
      res.json({ success: true, message: 'Report resolved.', data: { report: resolved } }); return;
    }
    report.status = status as 'reviewed' | 'dismissed';
    report.resolutionNote = typeof resolutionNote === 'string' ? resolutionNote.trim().slice(0, 1000) : undefined;
    await report.save();
    if (removeTarget && report.targetType === 'opportunity') {
      await Opportunity.findByIdAndDelete(report.targetId);
      await audit(req.user!._id, 'opportunity_removed_from_report', 'opportunity', report.targetId, report.resolutionNote);
    } else if (removeTarget && report.targetType === 'resource') {
      await Resource.findByIdAndDelete(report.targetId);
      await audit(req.user!._id, 'resource_removed_from_report', 'resource', report.targetId, report.resolutionNote);
    } else {
      await audit(req.user!._id, 'report_resolved', 'user', report.reporterId, report.resolutionNote);
    }
    res.json({ success: true, message: 'Report resolved.', data: { report } });
  } catch (error) { adminFailure(res, error); }
};

export const readReportedMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const message = await reviewReportedMessage(req.user!._id, messageId(req.params.id), messageText(req.body?.reason, 10, 500));
    res.set('Cache-Control', 'no-store').json({ success: true, data: { message } });
  } catch (error) { adminFailure(res, error); }
};

const removeListing = (targetType: 'opportunity' | 'resource') => async (req: Request, res: Response): Promise<void> => {
  try {
    if (!validId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid listing ID.' }); return; }
    const listing = targetType === 'opportunity'
      ? await Opportunity.findByIdAndDelete(req.params.id)
      : await Resource.findByIdAndDelete(req.params.id);
    if (!listing) { res.status(404).json({ success: false, message: 'Listing not found.' }); return; }
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : undefined;
    await audit(req.user!._id, `${targetType}_removed`, targetType, listing._id, reason);
    res.json({ success: true, message: `${targetType === 'opportunity' ? 'Opportunity' : 'Resource'} removed.` });
  } catch { res.status(500).json({ success: false, message: 'Unable to remove listing.' }); }
};

export const removeOpportunity = removeListing('opportunity');
export const removeResource = removeListing('resource');

export const listAuditLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.targetType !== undefined) {
      if (!['user', 'opportunity', 'resource'].includes(req.query.targetType as string)) throw new AdminActionError(400, 'Invalid audit target type.');
      filter.targetType = req.query.targetType;
    }
    if (req.query.targetId !== undefined) filter.targetId = adminId(req.query.targetId);
    const page = adminPage(req.query.page);
    const [entries, total] = await Promise.all([
      AuditLog.find(filter).populate('adminId', 'fullName email').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 30).limit(30),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ success: true, data: { entries, page, total, pages: Math.max(1, Math.ceil(total / 30)) } });
  } catch (error) { adminFailure(res, error); }
};
