import api from './axios';
import type { AuthResponse, MeResponse, RegisterData, LoginData, StudentProfile, User } from '../types';

export interface AuthActionResponse { success: boolean; message: string; }
export interface RegistrationResponse extends AuthActionResponse { data?: { user?: User; token?: string }; }

export const registerUser = async (data: RegisterData): Promise<RegistrationResponse> => {
  const response = await api.post<RegistrationResponse>('/auth/register', data);
  return response.data;
};

export const loginUser = async (data: LoginData): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', data);
  return response.data;
};

export const requestPasswordReset = async (email: string): Promise<AuthActionResponse> => (await api.post<AuthActionResponse>('/auth/forgot-password', { email })).data;
export const resetPassword = async (token: string, password: string, confirmPassword: string): Promise<AuthActionResponse> => (await api.post<AuthActionResponse>('/auth/reset-password', { token, password, confirmPassword })).data;
export const verifyEmail = async (token: string): Promise<AuthActionResponse> => (await api.post<AuthActionResponse>('/auth/verify-email', { token })).data;
export const resendEmailVerification = async (email: string): Promise<AuthActionResponse> => (await api.post<AuthActionResponse>('/auth/resend-verification', { email })).data;

export const getMe = async (): Promise<MeResponse> => {
  const response = await api.get<MeResponse>('/auth/me');
  return response.data;
};

export const updateStudentProfile = async (profile: StudentProfile): Promise<User> => {
  const response = await api.put<{ success: boolean; data: { user: User } }>('/auth/student-profile', profile);
  return response.data.data.user;
};
