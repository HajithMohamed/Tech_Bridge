import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { VerificationDocument, VerificationEvent, decisionActions } from '../models/ProviderVerification';
import { adminId, adminPage, AdminActionError, userListFilter } from '../services/adminUsers';
import { decideProviderVerification, reviewVerificationDocument, submitVerificationDocument, verificationStatus } from '../services/providerVerification';
import { generateVerificationToken } from '../utils/jwt';

const failure = (res: Response, error: unknown) => {
  if (error instanceof AdminActionError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
  res.status(503).json({ success: false, message: 'Unable to complete provider verification. Please try again later.' });
};
export const verificationSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || !password || password.length > 1024) throw new AdminActionError(400, 'Enter a valid email and password.');
    const provider = await User.findOne({ email: email.trim().toLowerCase() }).select('+password +tokenVersion');
    // Dummy comparison equalizes password work for missing/non-provider accounts.
    const matches = await bcrypt.compare(password, provider?.password || '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxSU2kMa5Fp1vvsHz8nc.xcY0yG');
    if (!provider || !matches || provider.role !== 'provider' || !provider.providerProfile) throw new AdminActionError(401, 'Invalid provider email or password.');
    if (provider.accountStatus === 'suspended') throw new AdminActionError(403, 'This account is suspended. Contact TechBridge support.');
    res.json({ success: true, data: { token: generateVerificationToken(provider._id.toString(), provider.tokenVersion || 0), expiresIn: 900 } });
  } catch (error) { failure(res, error); }
};
export const getVerificationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = await User.findById(req.user!._id);
    if (!provider?.providerProfile) throw new AdminActionError(404, 'Provider profile not found.');
    const document = provider.providerProfile.verificationDocumentId
      ? await VerificationDocument.findOne({ _id: provider.providerProfile.verificationDocumentId, providerId: provider._id }).select('_id fileName contentType size createdAt') : null;
    const unread = await VerificationEvent.countDocuments({ providerId: provider._id, action: { $in: decisionActions }, readAt: null });
    res.json({ success: true, data: { provider: { _id: provider._id, fullName: provider.fullName, organizationName: provider.providerProfile.organizationName, status: verificationStatus(provider), reason: provider.providerProfile.rejectionReason }, document, unread } });
  } catch (error) { failure(res, error); }
};
export const uploadVerificationDocument = async (req: Request, res: Response): Promise<void> => {
  try { res.status(201).json({ success: true, data: await submitVerificationDocument(req.user!._id, req.body) }); }
  catch (error) { failure(res, error); }
};
const sendDocument = (res: Response, document: { _id: unknown; contentType: string; data: Buffer }) => {
  const extension = document.contentType === 'application/pdf' ? 'pdf' : document.contentType === 'image/png' ? 'png' : 'jpg';
  res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="verification-${document._id}.${extension}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'", 'Cross-Origin-Resource-Policy': 'same-origin' }).send(document.data);
};
export const downloadOwnVerificationDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const document = await VerificationDocument.findOne({ _id: adminId(req.params.documentId), providerId: req.user!._id }).select('+data');
    if (!document) throw new AdminActionError(404, 'Document not found.');
    sendDocument(res, document);
  } catch (error) { failure(res, error); }
};
export const downloadAdminVerificationDocument = async (req: Request, res: Response): Promise<void> => {
  try { sendDocument(res, await reviewVerificationDocument(req.user!._id, req.params.id, req.params.documentId)); }
  catch (error) { failure(res, error); }
};
export const verificationHistory = (admin: boolean) => async (req: Request, res: Response): Promise<void> => {
  try {
    const providerId = admin ? adminId(req.params.id) : req.user!._id;
    if (!await User.exists({ _id: providerId, role: 'provider' })) throw new AdminActionError(404, 'Provider not found.');
    const page = adminPage(req.query.page); const filter = { providerId };
    const [entries, total] = await Promise.all([
      VerificationEvent.find(filter).populate('actorId', 'fullName role').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20),
      VerificationEvent.countDocuments(filter),
    ]);
    res.json({ success: true, data: { entries, page, pages: Math.max(1, Math.ceil(total / 20)), total } });
  } catch (error) { failure(res, error); }
};
export const markVerificationNoticeRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = { _id: adminId(req.params.eventId), providerId: req.user!._id, action: { $in: decisionActions } };
    const entry = await VerificationEvent.findOne(filter);
    if (!entry) throw new AdminActionError(404, 'Decision notice not found.');
    if (!entry.readAt) await VerificationEvent.updateOne({ ...filter, readAt: null }, { $set: { readAt: new Date() } });
    res.json({ success: true });
  } catch (error) { failure(res, error); }
};
export const listVerificationProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = adminPage(req.query.page); const status = req.query.status ?? 'PENDING';
    if (typeof status !== 'string' || !['PENDING', 'VERIFIED', 'REJECTED', 'NEEDS_INFO', 'ALL'].includes(status)) throw new AdminActionError(400, 'Select a valid verification status.');
    const filter = userListFilter({ ...(req.query.q !== undefined ? { q: req.query.q } : {}) });
    const search = filter.$or as { fullName?: unknown }[] | undefined;
    if (search) search.push({ 'providerProfile.organizationName': search[0].fullName } as typeof search[number]);
    filter.role = 'provider';
    if (status !== 'ALL') filter['providerProfile.verificationStatus'] = status;
    const [providers, total] = await Promise.all([
      User.find(filter).select('fullName email accountStatus providerProfile createdAt').sort({ createdAt: 1, _id: 1 }).skip((page - 1) * 20).limit(20),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, data: { providers, page, pages: Math.max(1, Math.ceil(total / 20)), total } });
  } catch (error) { failure(res, error); }
};
export const providerDecision = (action: 'verified' | 'rejected' | 'more_info') => async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = await decideProviderVerification(req.user!._id, req.params.id, action, req.body || {});
    res.json({ success: true, message: 'Verification decision recorded. The provider can sign in to verification status to read it.', data: { provider } });
  } catch (error) { failure(res, error); }
};
