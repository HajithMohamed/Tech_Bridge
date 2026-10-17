import api from './axios';
import type { CreatorCompensationPreference, PromotionRequest, PromotionRequestStatus } from '../types';

interface RequestResponse { data: { request: PromotionRequest }; }
interface RequestsResponse { data: { requests: PromotionRequest[] }; }

export interface PromotionRequestInput {
  studentId: string;
  campaignBrief: string;
  deliverables: string;
  compensationType: CreatorCompensationPreference;
  compensationDetails?: string;
  deadline?: string;
}

export const createPromotionRequest = async (input: PromotionRequestInput): Promise<PromotionRequest> =>
  (await api.post<RequestResponse>('/promotion-requests', input)).data.data.request;

export const getMyPromotionRequests = async (): Promise<PromotionRequest[]> =>
  (await api.get<RequestsResponse>('/promotion-requests/mine')).data.data.requests;

export const getProviderPromotionRequests = async (): Promise<PromotionRequest[]> =>
  (await api.get<RequestsResponse>('/promotion-requests/provider')).data.data.requests;

export const updatePromotionRequestStatus = async (id: string, status: PromotionRequestStatus): Promise<PromotionRequest> =>
  (await api.patch<RequestResponse>(`/promotion-requests/${id}/status`, { status })).data.data.request;
