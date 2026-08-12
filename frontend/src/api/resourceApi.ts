import api from './axios';
import type { ResourceAccessType, ResourceCategory, ResourceListing, ResourceListingFormData, ResourceStatus } from '../types';

interface ResourceResponse { success: boolean; message?: string; data: { resource: ResourceListing } }
interface ResourcesResponse { success: boolean; data: { resources: ResourceListing[] } }

export const getResources = async (filters?: { item?: string; accessType?: ResourceAccessType; category?: ResourceCategory }): Promise<ResourceListing[]> => {
  const response = await api.get<ResourcesResponse>('/resources', { params: filters });
  return response.data.data.resources;
};

export const getResource = async (id: string): Promise<ResourceListing> => {
  const response = await api.get<ResourceResponse>(`/resources/${id}`);
  return response.data.data.resource;
};

export const getMyResources = async (): Promise<ResourceListing[]> => {
  const response = await api.get<ResourcesResponse>('/resources/mine');
  return response.data.data.resources;
};

export const createResource = async (data: ResourceListingFormData): Promise<ResourceListing> => {
  const response = await api.post<ResourceResponse>('/resources', data);
  return response.data.data.resource;
};

export const updateResourceStatus = async (id: string, status: ResourceStatus): Promise<ResourceListing> => {
  const response = await api.patch<ResourceResponse>(`/resources/${id}/status`, { status });
  return response.data.data.resource;
};

export const deleteResource = async (id: string): Promise<void> => { await api.delete(`/resources/${id}`); };
