import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, LoginData, RegisterData } from '../types';
import { loginUser, registerUser, getMe } from '../api/authApi';
import axios from 'axios';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  fieldErrors: Array<{ field: string; message: string }> | null;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateStoredUser: (user: User) => void;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('techbridge_token')
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Array<{ field: string; message: string }> | null
  >(null);

  const isAuthenticated = !!user && !!token;

  // Rehydrate session on mount
  useEffect(() => {
    const rehydrate = async () => {
      const savedToken = localStorage.getItem('techbridge_token');
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await getMe();
        setUser(response.data.user);
        setToken(savedToken);
      } catch {
        // Token is invalid — clean up
        localStorage.removeItem('techbridge_token');
        localStorage.removeItem('techbridge_user');
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    rehydrate();
  }, []);

  const login = useCallback(async (data: LoginData) => {
    setIsLoading(true);
    setError(null);
    setFieldErrors(null);

    try {
      const response = await loginUser(data);
      const { user: userData, token: newToken } = response.data;

      if (!newToken) {
        throw new Error('Login did not return an access token');
      }

      localStorage.setItem('techbridge_token', newToken);
      localStorage.setItem('techbridge_user', JSON.stringify(userData));

      setUser(userData);
      setToken(newToken);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const errorData = err.response.data;
        setError(errorData.message || 'Login failed');
        if (errorData.errors) {
          setFieldErrors(errorData.errors);
        }
      } else {
        setError('An unexpected error occurred');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    setError(null);
    setFieldErrors(null);

    try {
      const response = await registerUser(data);
      const { user: userData, token: newToken } = response.data;

      if (!newToken) {
        return;
      }

      localStorage.setItem('techbridge_token', newToken);
      localStorage.setItem('techbridge_user', JSON.stringify(userData));

      setUser(userData);
      setToken(newToken);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const errorData = err.response.data;
        setError(errorData.message || 'Registration failed');
        if (errorData.errors) {
          setFieldErrors(errorData.errors);
        }
      } else {
        setError('An unexpected error occurred');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('techbridge_token');
    localStorage.removeItem('techbridge_user');
    setUser(null);
    setToken(null);
    setError(null);
    setFieldErrors(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setFieldErrors(null);
  }, []);

  const updateStoredUser = useCallback((updatedUser: User) => {
    localStorage.setItem('techbridge_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        error,
        fieldErrors,
        login,
        register,
        logout,
        updateStoredUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
