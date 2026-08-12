import api from './axios';
import type { Resource, ResourceFormData, ResourceCategory, AccessMethod } from '../types';

interface ResourceResponse { success: boolean; message?: string; data: { resource: Resource } }
interface ResourcesResponse { success: boolean; data: { resources: Resource[] } }

export const getResources = async (filters?: { category?: ResourceCategory; accessMethod?: AccessMethod; search?: string }): Promise<Resource[]> => {
  const response = await api.get<ResourcesResponse>('/resources', { params: filters });
  return response.data.data.resources;
};

export const getMyResources = async (search?: string): Promise<Resource[]> => {
  const response = await api.get<ResourcesResponse>('/resources/mine', { params: search ? { search } : undefined });
  return response.data.data.resources;
};

export const createResource = async (data: ResourceFormData): Promise<Resource> => {
  const response = await api.post<ResourceResponse>('/resources', data);
  return response.data.data.resource;
};

export const updateResource = async (id: string, data: ResourceFormData): Promise<Resource> => {
  const response = await api.put<ResourceResponse>(`/resources/${id}`, data);
  return response.data.data.resource;
};

export const deleteResource = async (id: string): Promise<void> => { await api.delete(`/resources/${id}`); };
