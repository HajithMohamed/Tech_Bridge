import api from './axios';
import type { Opportunity, OpportunityFormData, OpportunityType, WorkMode } from '../types';

interface OpportunityResponse {
  success: boolean;
  message?: string;
  data: { opportunity: Opportunity };
}

interface OpportunitiesResponse {
  success: boolean;
  data: { opportunities: Opportunity[] };
}

export const getOpportunities = async (filters?: {
  type?: OpportunityType;
  skill?: string;
  workMode?: WorkMode;
}): Promise<Opportunity[]> => {
  const response = await api.get<OpportunitiesResponse>('/opportunities', { params: filters });
  return response.data.data.opportunities;
};

export const getScholarships = async (): Promise<Opportunity[]> => {
  const response = await api.get<OpportunitiesResponse>('/opportunities/scholarships');
  return response.data.data.opportunities;
};

export const getMyOpportunities = async (): Promise<Opportunity[]> => {
  const response = await api.get<OpportunitiesResponse>('/opportunities/mine');
  return response.data.data.opportunities;
};

export const getOpportunity = async (id: string): Promise<Opportunity> => {
  const response = await api.get<OpportunityResponse>(`/opportunities/${id}`);
  return response.data.data.opportunity;
};

export const createOpportunity = async (data: OpportunityFormData): Promise<Opportunity> => {
  const response = await api.post<OpportunityResponse>('/opportunities', data);
  return response.data.data.opportunity;
};

export const updateOpportunity = async (id: string, data: OpportunityFormData): Promise<Opportunity> => {
  const response = await api.put<OpportunityResponse>(`/opportunities/${id}`, data);
  return response.data.data.opportunity;
};

export const deleteOpportunity = async (id: string): Promise<void> => {
  await api.delete(`/opportunities/${id}`);
};
