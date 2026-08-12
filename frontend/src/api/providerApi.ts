import api from './axios';
import type { ProviderDashboard, ProviderProfile, PublicProviderResponse, User } from '../types';

export const getProviderDashboard = async (): Promise<ProviderDashboard> => {
  const response = await api.get<{ success: boolean; data: ProviderDashboard }>('/provider/dashboard');
  return response.data.data;
};

export const updateProviderProfile = async (profile: Partial<ProviderProfile>): Promise<User> => {
  const response = await api.put<{ success: boolean; data: { user: User } }>('/provider/profile', profile);
  return response.data.data.user;
};

export const getPublicProviderProfile = async (id: string): Promise<PublicProviderResponse> => {
  const response = await api.get<{ success: boolean; data: PublicProviderResponse }>(`/providers/${id}`);
  return response.data.data;
};
