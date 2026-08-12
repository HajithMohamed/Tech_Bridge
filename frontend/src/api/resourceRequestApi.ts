import api from './axios';
import type { ResourceRequest, ResourceRequestStatus } from '../types';

interface SingleRequestResponse {
  success: boolean;
  message?: string;
  data: { request: ResourceRequest };
}

interface MultipleRequestsResponse {
  success: boolean;
  data: { requests: ResourceRequest[] };
}

export const createResourceRequest = async (
  resourceId: string,
  requestedAccessType: string,
  durationOrTerms?: string,
  message?: string
): Promise<ResourceRequest> => {
  const response = await api.post<SingleRequestResponse>('/resource-requests', {
    resourceId,
    requestedAccessType,
    durationOrTerms,
    message,
  });
  return response.data.data.request;
};

export const getMyResourceRequests = async (): Promise<ResourceRequest[]> => {
  const response = await api.get<MultipleRequestsResponse>('/resource-requests/mine');
  return response.data.data.requests;
};

export const getProviderResourceRequests = async (): Promise<ResourceRequest[]> => {
  const response = await api.get<MultipleRequestsResponse>('/resource-requests/provider');
  return response.data.data.requests;
};

export const updateResourceRequestStatus = async (
  id: string,
  status: ResourceRequestStatus
): Promise<ResourceRequest> => {
  const response = await api.patch<SingleRequestResponse>(`/resource-requests/${id}/status`, { status });
  return response.data.data.request;
};
