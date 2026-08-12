import api from './axios';
import type { OpportunityApplication, ApplicationStatus } from '../types';

interface ApplicationResponse {
  success: boolean;
  message?: string;
  data: { application: OpportunityApplication };
}

interface ApplicationsResponse {
  success: boolean;
  data: { applications: OpportunityApplication[] };
}

export const applyToOpportunity = async (
  opportunityId: string,
  message?: string
): Promise<OpportunityApplication> => {
  const response = await api.post<ApplicationResponse>('/applications', { opportunityId, message });
  return response.data.data.application;
};

export const getMyApplications = async (): Promise<OpportunityApplication[]> => {
  const response = await api.get<ApplicationsResponse>('/applications/mine');
  return response.data.data.applications;
};

export const getOpportunityApplicants = async (opportunityId: string): Promise<OpportunityApplication[]> => {
  const response = await api.get<ApplicationsResponse>(`/applications/opportunity/${opportunityId}`);
  return response.data.data.applications;
};

export const updateApplicationStatus = async (
  id: string,
  status: ApplicationStatus
): Promise<OpportunityApplication> => {
  const response = await api.patch<ApplicationResponse>(`/applications/${id}/status`, { status });
  return response.data.data.application;
};
