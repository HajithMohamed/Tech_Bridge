import api from './axios';
import type { AuthResponse, MeResponse, RegisterData, LoginData, StudentProfile, User } from '../types';

export const registerUser = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/register', data);
  return response.data;
};

export const loginUser = async (data: LoginData): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', data);
  return response.data;
};

export const getMe = async (): Promise<MeResponse> => {
  const response = await api.get<MeResponse>('/auth/me');
  return response.data;
};

export const updateStudentProfile = async (profile: StudentProfile): Promise<User> => {
  const response = await api.put<{ success: boolean; data: { user: User } }>('/auth/student-profile', profile);
  return response.data.data.user;
};
