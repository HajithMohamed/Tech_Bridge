import axios from 'axios';
import api from './axios';
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_INFO' | 'REVOKED';
export const claimStatusLabel: Record<ClaimStatus, string> = { PENDING: 'Pending review', APPROVED: 'Approved', REJECTED: 'Rejected', NEEDS_INFO: 'More information requested', REVOKED: 'Revoked' };
export interface CommunityProfile { visibility: 'hidden' | 'members'; acceptsStudentMessages: boolean; expertise: string[]; availability: string; bio: string; }
export interface CommunityClaim {
  _id: string; providerId: string | { _id: string; fullName: string; email: string; accountStatus: string; providerProfile?: { organizationType: string; verificationDocumentId?: string } };
  directoryId: string; documentId: string; institution: string; justification: string;
  status: ClaimStatus; revision: number; decisionReason?: string; profile: CommunityProfile; updatedAt: string;
}
export interface CommunityEntry { _id: string; action: string; fromStatus: string; toStatus: ClaimStatus; reason: string; revision: number; createdAt: string; actorId: string | { fullName: string; role: string } | null; affiliationMethod?: string; affiliationReference?: string; }
export interface CommunityMember { _id: string; directoryId: string; fullName: string; category: 'academic' | 'alumni'; department?: string; institution: string; expertise: string[]; availability: string; bio: string; acceptsStudentMessages: boolean; }
export interface PageInfo { page: number; pages: number; total: number; }
export type ClaimState = { claim: CommunityClaim | null; active: boolean; kind: 'faculty' | 'alumni' };
const restricted = axios.create({ baseURL: '/api/community' });
const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });
export const getOwnCommunityClaim = async (token: string) => (await restricted.get<{ data: ClaimState }>('/claim', bearer(token))).data.data;
export const submitCommunityClaim = async (token: string, data: { revision: number; directoryId: string; documentId: string; institution: string; justification: string }) => { await restricted.post('/claim', data, bearer(token)); };
export const saveCommunityProfile = async (token: string, revision: number, profile: CommunityProfile) => { await restricted.put('/claim/profile', { revision, profile }, bearer(token)); };
export const getCommunityHistory = async (access: { token: string } | { claimId: string }, page: number) => 'token' in access
  ? (await restricted.get<{ data: PageInfo & { entries: CommunityEntry[] } }>('/claim/history', { ...bearer(access.token), params: { page } })).data.data
  : (await api.get<{ data: PageInfo & { entries: CommunityEntry[] } }>(`/admin/community-claims/${access.claimId}/history`, { params: { page } })).data.data;
export const getCommunityQueue = async (params: { status: string; q: string; page: number }) => (await api.get<{ data: PageInfo & { claims: CommunityClaim[] } }>('/admin/community-claims', { params })).data.data;
export const decideCommunityClaim = async (id: string, action: string, body: { revision: number; documentId: string; reason: string; identityConfirmed: boolean; affiliationConfirmed: boolean; affiliationMethod: string; affiliationReference: string }) => { await api.patch(`/admin/community-claims/${id}/${action}`, body); };
export const getCommunityMembers = async (params: { category: string; department?: string; q: string; page: number }) => (await api.get<{ data: PageInfo & { people: CommunityMember[] } }>('/community/people', { params })).data.data;
