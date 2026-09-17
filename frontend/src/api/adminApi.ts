import api from './axios';
import type { User } from '../types';

export interface Report { _id: string; targetType: 'opportunity' | 'resource' | 'user' | 'message' | 'promotion_request'; targetId: string; reason: string; status: 'open' | 'reviewed' | 'dismissed'; resolutionNote?: string; createdAt: string; reporterId: Pick<User, '_id' | 'fullName' | 'email' | 'role'> | string; }
export interface AuditEntry { _id: string; action: string; targetType: string; targetId: string; reason?: string; createdAt: string; adminId: Pick<User, '_id' | 'fullName' | 'email'> | string; }
export const getVerificationQueue = async () => (await api.get<{ data: { providers: User[] } }>('/admin/providers?status=PENDING')).data.data.providers;
export const verifyProvider = async (id: string) => { await api.patch(`/admin/providers/${id}/verify`); };
export const rejectProvider = async (id: string, reason: string) => { await api.patch(`/admin/providers/${id}/reject`, { reason }); };
export const getAdminUsers = async (q = '') => (await api.get<{ data: { users: User[] } }>('/admin/users', { params: { q } })).data.data.users;
export const suspendUser = async (id: string, reason: string) => { await api.patch(`/admin/users/${id}/suspend`, { reason }); };
export const reinstateUser = async (id: string) => { await api.patch(`/admin/users/${id}/reinstate`); };
export const getReports = async () => (await api.get<{ data: { reports: Report[] } }>('/admin/reports?status=open')).data.data.reports;
export const resolveReport = async (id: string, status: 'reviewed' | 'dismissed', resolutionNote: string, removeTarget = false) => { await api.patch(`/admin/reports/${id}`, { status, resolutionNote, removeTarget }); };
export const getAuditLog = async () => (await api.get<{ data: { entries: AuditEntry[] } }>('/admin/audit-log')).data.data.entries;
