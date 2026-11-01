import mongoose, { Types } from 'mongoose';
import User, { IUser } from '../models/User';
import AuditLog from '../models/AuditLog';

export class AdminActionError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}
export function adminReason(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 1000) throw new AdminActionError(400, 'Provide a reason between 3 and 1000 characters.');
  return value.trim();
}
export function adminId(value: unknown): string {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) throw new AdminActionError(400, 'Invalid user ID.');
  return value;
}
export function adminPage(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^[1-9]\d{0,5}$/.test(value) || Number(value) > 100000) throw new AdminActionError(400, 'Select a valid page.');
  return Number(value);
}
export function userListFilter(query: Record<string, unknown>): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.role !== undefined) {
    if (!['student', 'provider', 'admin'].includes(query.role as string)) throw new AdminActionError(400, 'Select a valid role filter.');
    filter.role = query.role;
  }
  if (query.status !== undefined) {
    if (!['active', 'suspended'].includes(query.status as string)) throw new AdminActionError(400, 'Select a valid account status filter.');
    filter.accountStatus = query.status === 'active' ? { $ne: 'suspended' } : 'suspended';
  }
  if (query.q !== undefined) {
    if (typeof query.q !== 'string' || query.q.length > 100) throw new AdminActionError(400, 'Search must be 100 characters or fewer.');
    const q = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (q) filter.$or = [{ fullName: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }];
  }
  return filter;
}
export function originalRoleEligible(user: IUser): boolean {
  if (user.role === 'student') return Boolean(user.studentProfile?.institution && ['ICT', 'ET', 'BST', 'other'].includes(user.studentProfile.degree) && Number.isInteger(user.studentProfile.studyYear) && user.studentProfile.studyYear >= 1 && user.studentProfile.studyYear <= 6 && user.studentProfile.skills?.length);
  return user.role === 'provider' && user.providerProfile?.verified === true && user.providerProfile.verificationStatus === 'VERIFIED' && Boolean(user.providerProfile.organizationName && user.providerProfile.organizationType && user.providerProfile.contactEmail && user.providerProfile.contactPerson && user.providerProfile.phone && user.providerProfile.location);
}
const snapshot = (user: IUser) => ({ role: user.role, accountStatus: user.accountStatus || 'active' });
type Action = { kind: 'status'; value: 'active' | 'suspended' } | { kind: 'role'; value: unknown };

export async function changeManagedUser(actorId: Types.ObjectId, targetValue: unknown, action: Action, reasonValue: unknown) {
  const targetId = adminId(targetValue);
  const reason = adminReason(reasonValue);
  if (actorId.toString() === targetId) throw new AdminActionError(400, 'You cannot change your own role or account status.');
  if (action.kind === 'role' && !['student', 'provider', 'admin'].includes(action.value as string)) throw new AdminActionError(400, 'Select a valid role.');
  return mongoose.connection.transaction(async (session) => {
    // Reauthorize and lock the acting administrator. A concurrent removal of their
    // privileges conflicts with this write and is rechecked on transaction retry.
    const actor = await User.updateOne({ _id: actorId, role: 'admin', accountStatus: { $ne: 'suspended' } }, { $inc: { __v: 1 } }, { session, timestamps: false });
    if (actor.matchedCount !== 1) throw new AdminActionError(403, 'An active administrator is required.');
    const target = await User.findById(targetId).session(session);
    if (!target) throw new AdminActionError(404, 'User not found.');
    const before = snapshot(target);
    let auditAction: string;
    if (action.kind === 'status') {
      if (before.accountStatus === action.value) return target;
      if (target.role === 'admin' && action.value === 'suspended' && await User.countDocuments({ role: 'admin', accountStatus: { $ne: 'suspended' } }).session(session) <= 1) throw new AdminActionError(409, 'At least one active administrator must remain.');
      target.accountStatus = action.value;
      auditAction = action.value === 'suspended' ? 'user_suspended' : 'user_reinstated';
    } else {
      if (target.role === action.value) return target;
      if (target.accountStatus === 'suspended') throw new AdminActionError(409, 'Reinstate this account before changing its role.');
      if (target.role !== 'admin') {
        if (action.value !== 'admin' || !originalRoleEligible(target)) throw new AdminActionError(409, 'Only eligible student or verified provider accounts can be granted admin access.');
        target.adminBaseRole = target.role;
        target.role = 'admin';
      } else {
        if (!target.adminBaseRole || action.value !== target.adminBaseRole) throw new AdminActionError(409, 'An administrator can only be restored to their recorded original role.');
        if (await User.countDocuments({ role: 'admin', accountStatus: { $ne: 'suspended' } }).session(session) <= 1) throw new AdminActionError(409, 'At least one active administrator must remain.');
        target.role = target.adminBaseRole;
        target.adminBaseRole = undefined;
      }
      auditAction = 'user_role_changed';
    }
    // Query update increments the private version while avoiding password hooks.
    const changed = await User.findOneAndUpdate({ _id: target._id }, {
      $set: { role: target.role, accountStatus: target.accountStatus, ...(target.adminBaseRole ? { adminBaseRole: target.adminBaseRole } : {}) },
      ...(!target.adminBaseRole ? { $unset: { adminBaseRole: '' } } : {}),
      $inc: { tokenVersion: 1, __v: 1 },
    }, { new: true, runValidators: true, session });
    if (!changed) throw new AdminActionError(409, 'The account changed. Please reload.');
    await AuditLog.create([{ adminId: actorId, targetType: 'user', targetId: target._id, action: auditAction, reason, before, after: snapshot(changed) }], { session });
    return changed;
  }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 });
}
