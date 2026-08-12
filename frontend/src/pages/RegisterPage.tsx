import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, fieldErrors, clearError } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'student' | 'provider',
  });

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) return;

    try {
      await register(formData);
      navigate('/dashboard');
    } catch {
      // Error is handled by AuthContext
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (clientErrors[field]) {
      setClientErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (error) clearError();
  };

  const getFieldError = (field: string): string | undefined => {
    if (clientErrors[field]) return clientErrors[field];
    return fieldErrors?.find((e) => e.field === field)?.message;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 mb-4 shadow-lg shadow-primary-500/25">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Join TechBridge
          </h1>
          <p className="text-gray-400 text-sm">
            Create your account and bridge the opportunity gap
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-card p-8">
          {/* Server Error */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                I am a
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleInputChange('role', 'student')}
                  className={`relative py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer border ${
                    formData.role === 'student'
                      ? 'bg-primary-500/20 border-primary-500/50 text-primary-300 shadow-lg shadow-primary-500/10'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Student
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('role', 'provider')}
                  className={`relative py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer border ${
                    formData.role === 'provider'
                      ? 'bg-accent-500/20 border-accent-500/50 text-accent-400 shadow-lg shadow-accent-500/10'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Provider
                  </div>
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="register-fullName" className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                id="register-fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                placeholder="Enter your full name"
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 text-sm transition-all duration-300 outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 ${
                  getFieldError('fullName')
                    ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                    : 'border-white/10 hover:border-white/20'
                }`}
              />
              {getFieldError('fullName') && (
                <p className="mt-1.5 text-xs text-red-400">{getFieldError('fullName')}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="register-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="you@example.com"
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 text-sm transition-all duration-300 outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 ${
                  getFieldError('email')
                    ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                    : 'border-white/10 hover:border-white/20'
                }`}
              />
              {getFieldError('email') && (
                <p className="mt-1.5 text-xs text-red-400">{getFieldError('email')}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="At least 6 characters"
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 text-sm transition-all duration-300 outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 ${
                  getFieldError('password')
                    ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                    : 'border-white/10 hover:border-white/20'
                }`}
              />
              {getFieldError('password') && (
                <p className="mt-1.5 text-xs text-red-400">{getFieldError('password')}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="register-confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                id="register-confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder="Re-enter your password"
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-gray-500 text-sm transition-all duration-300 outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 ${
                  getFieldError('confirmPassword')
                    ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                    : 'border-white/10 hover:border-white/20'
                }`}
              />
              {getFieldError('confirmPassword') && (
                <p className="mt-1.5 text-xs text-red-400">{getFieldError('confirmPassword')}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-400 hover:to-accent-400 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5 active:translate-y-0"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{ animation: 'spin 0.6s linear infinite' }} />
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary-400 hover:text-primary-300 font-semibold transition-colors duration-200"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-6">
          By creating an account, you agree to TechBridge's Terms of Service
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
