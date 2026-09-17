import api from './axios';
import type { CreatorDirectoryStudent, CreatorProfile, CreatorCompensationPreference, CreatorPlatform, User } from '../types';

export interface CreatorFilters {
  niche?: string;
  platform?: CreatorPlatform | '';
  contentType?: string;
  compensationPreference?: CreatorCompensationPreference | '';
}

export const updateCreatorProfile = async (profile: CreatorProfile): Promise<User> => {
  const response = await api.put<{ data: { user: User } }>('/creators/profile', profile);
  return response.data.data.user;
};

export const getCreators = async (filters: CreatorFilters = {}): Promise<CreatorDirectoryStudent[]> => {
  const response = await api.get<{ data: { creators: CreatorDirectoryStudent[] } }>('/creators', { params: filters });
  return response.data.data.creators;
};

export const getCreator = async (studentId: string): Promise<CreatorDirectoryStudent> => {
  const response = await api.get<{ data: { creator: CreatorDirectoryStudent } }>(`/creators/${studentId}`);
  return response.data.data.creator;
};
