import api from './axios';
import type { User } from '../types';

export interface Report { _id: string; targetType: 'opportunity' | 'resource' | 'user' | 'message' | 'promotion_request'; targetId: string; reason: string; status: 'open' | 'reviewed' | 'dismissed'; resolutionNote?: string; createdAt: string; reporterId: Pick<User, '_id' | 'fullName' | 'email' | 'role'> | string; }
export interface AuditEntry { _id: string; action: string; targetType: string; targetId: string; reason?: string; createdAt: string; adminId: Pick<User, '_id' | 'fullName' | 'email'> | string; before?: { role?: string; accountStatus?: string }; after?: { role?: string; accountStatus?: string }; }
export interface UserPage { users: User[]; page: number; total: number; pages: number; }
export interface AuditPage { entries: AuditEntry[]; page: number; total: number; pages: number; }
export const fetchAdminUsers = async (params: { q?: string; role?: string; status?: string; page?: number }) => (await api.get<{ data: UserPage }>('/admin/users', { params })).data.data;
export const changeAdminRole = async (id: string, role: User['role'], reason: string) => (await api.patch<{ data: { user: User } }>(`/admin/users/${id}/role`, { role, reason })).data.data.user;
export const fetchAdminAudit = async (page = 1, userId?: string) => (await api.get<{ data: AuditPage }>(userId ? `/admin/users/${userId}/history` : '/admin/audit-log', { params: { page } })).data.data;
export const getAdminUsers = async (q = '') => (await api.get<{ data: { users: User[] } }>('/admin/users', { params: { q } })).data.data.users;
export const suspendUser = async (id: string, reason: string) => { await api.patch(`/admin/users/${id}/suspend`, { reason }); };
export const reinstateUser = async (id: string, reason: string) => { await api.patch(`/admin/users/${id}/reinstate`, { reason }); };
export const getReports = async () => (await api.get<{ data: { reports: Report[] } }>('/admin/reports?status=open')).data.data.reports;
export const resolveReport = async (id: string, status: 'reviewed' | 'dismissed', resolutionNote: string, removeTarget = false) => { await api.patch(`/admin/reports/${id}`, { status, resolutionNote, removeTarget }); };
export const getAuditLog = async () => (await api.get<{ data: { entries: AuditEntry[] } }>('/admin/audit-log')).data.data.entries;
