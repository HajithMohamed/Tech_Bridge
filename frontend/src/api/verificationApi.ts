import axios from 'axios';
import api from './axios';
import type { User } from '../types';

export type VerificationStatus = 'PENDING' | 'NEEDS_INFO' | 'REJECTED' | 'VERIFIED';
export const verificationStatusLabel: Record<VerificationStatus, string> = { PENDING: 'Pending review', NEEDS_INFO: 'More information requested', REJECTED: 'Rejected', VERIFIED: 'Verified' };
export const verificationActionLabel = { submitted: 'Evidence submitted', verified: 'Approved', rejected: 'Rejected', more_info: 'More information requested', document_reviewed: 'Document reviewed', profile_changed: 'Organization details changed' };
export interface VerificationEntry {
  _id: string; action: 'submitted' | 'verified' | 'rejected' | 'more_info' | 'document_reviewed' | 'profile_changed';
  actorId: { fullName: string; role: string } | string | null; documentId?: string;
  fromStatus: VerificationStatus; toStatus: VerificationStatus; reason: string; readAt?: string | null; createdAt: string;
}
export interface VerificationHistoryPage { entries: VerificationEntry[]; page: number; pages: number; total: number; }
export interface VerificationState {
  provider: { _id: string; fullName: string; organizationName: string; status: VerificationStatus; reason?: string };
  document: { _id: string; fileName: string; contentType: string; size: number; createdAt: string } | null;
  unread: number;
}
export interface VerificationQueue { providers: User[]; page: number; pages: number; total: number; }
// Deliberately separate: verification tokens must never enter the full-session
// localStorage/interceptors or overwrite an administrator's existing session.
const restricted = axios.create({ baseURL: '/api/provider-verification' });
const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });
export const startVerificationSession = async (email: string, password: string) => (await restricted.post<{ data: { token: string } }>('/session', { email, password })).data.data.token;
export const fetchVerificationState = async (token: string) => (await restricted.get<{ data: VerificationState }>('/', bearer(token))).data.data;
export const fetchOwnVerificationHistory = async (token: string, page: number) => (await restricted.get<{ data: VerificationHistoryPage }>('/history', { ...bearer(token), params: { page } })).data.data;
export const markVerificationRead = async (token: string, id: string) => { await restricted.patch(`/history/${id}/read`, {}, bearer(token)); };
export const submitVerificationFile = async (token: string, file: File, note: string) => {
  if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('Choose a document of 2 MiB or smaller.');
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(new Error('Unable to read the document.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file);
  });
  await restricted.post('/documents', { fileName: file.name, content, note }, bearer(token));
};
export const fetchVerificationQueue = async (params: { status: string; q: string; page: number }) => (await api.get<{ data: VerificationQueue }>('/admin/providers', { params })).data.data;
export const fetchAdminVerificationHistory = async (id: string, page: number) => (await api.get<{ data: VerificationHistoryPage }>(`/admin/providers/${id}/history`, { params: { page } })).data.data;
export const decideVerification = async (id: string, decision: 'verify' | 'reject' | 'request-info', reason: string, documentId: string | null) => { await api.patch(`/admin/providers/${id}/${decision}`, { reason, documentId }); };
export async function downloadVerificationDocument(id: string, access: { token: string } | { providerId: string }) {
  const response = 'token' in access
    ? await restricted.get<Blob>(`/documents/${id}`, { ...bearer(access.token), responseType: 'blob' })
    : await api.get<Blob>(`/admin/providers/${access.providerId}/documents/${id}`, { responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] || '');
  const filename = /filename="(verification-[a-f0-9]+\.(?:pdf|png|jpg))"/.exec(disposition)?.[1] || 'verification-document';
  const url = URL.createObjectURL(response.data); const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function verificationError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401 && error.response?.data?.message !== 'Invalid provider email or password.') return 'Your verification session changed or expired. Sign in again to see the latest decision.';
    return typeof error.response?.data?.message === 'string' ? error.response.data.message : 'Unable to complete verification. Please try again.';
  }
  return error instanceof Error ? error.message : 'Unable to complete verification.';
}
