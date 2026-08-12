import api from './axios';
import type { ResourceAccessType, ResourceRequest, ResourceRequestStatus } from '../types';

interface ResourceRequestResponse {
  success: boolean;
  message?: string;
  data: { request: ResourceRequest };
}

interface ResourceRequestsResponse {
  success: boolean;
  data: { requests: ResourceRequest[] };
}

export const createResourceRequest = async (
  resourceId: string,
  requestedAccessType: string,
  durationOrTerms?: string,
  message?: string
): Promise<ResourceRequest> => {
  const response = await api.post<ResourceRequestResponse>('/resource-requests', {
    resourceId,
    requestedAccessType,
    durationOrTerms,
    message,
  });
  return response.data.data.request;
};

export const getMyResourceRequests = async (): Promise<ResourceRequest[]> => {
  const response = await api.get<ResourceRequestsResponse>('/resource-requests/mine');
  return response.data.data.requests;
};

export const getReceivedResourceRequests = async (): Promise<ResourceRequest[]> => {
  const response = await api.get<ResourceRequestsResponse>('/resource-requests/received');
  return response.data.data.requests;
};

export const getProviderResourceRequests = async (): Promise<ResourceRequest[]> => {
  const response = await api.get<ResourceRequestsResponse>('/resource-requests/provider');
  return response.data.data.requests;
};

export const updateResourceRequestStatus = async (
  id: string,
  status: ResourceRequestStatus
): Promise<ResourceRequest> => {
  const response = await api.patch<ResourceRequestResponse>(`/resource-requests/${id}/status`, { status });
  return response.data.data.request;
};
