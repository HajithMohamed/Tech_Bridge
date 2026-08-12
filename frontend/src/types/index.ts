export interface User {
  _id: string;
  fullName: string;
  email: string;
  role: 'student' | 'provider' | 'admin';
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface MeResponse {
  success: boolean;
  data: {
    user: User;
  };
}

export interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'student' | 'provider';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}
