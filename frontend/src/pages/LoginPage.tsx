import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, Briefcase, Award, Wrench, ArrowRight, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, fieldErrors, clearError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) return;

    try {
      await login(formData);
      navigate('/dashboard');
    } catch {
      // Error is handled by AuthContext
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-50">
      {/* Left Side: Branding & Illustration (Hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-primary-600 relative overflow-hidden flex-col justify-center px-12 lg:px-24">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse-glow"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-primary-700 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        
        <div className="relative z-10 animate-fade-in-up">
          <Link to="/" className="inline-flex items-center gap-3 mb-12 group">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-black/10 group-hover:scale-105 transition-transform duration-300">
              <span className="text-2xl font-bold text-primary-600 font-heading">T</span>
            </div>
            <span className="text-3xl font-bold text-white font-heading tracking-tight">TechBridge</span>
          </Link>
          
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            Bring Opportunities to Students
          </h1>
          <p className="text-primary-100 text-lg mb-12 max-w-md leading-relaxed">
            Not Students to Opportunities. A digital bridge for Faculty of Technology students and the surrounding community.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4 text-white group">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Briefcase className="w-6 h-6 text-primary-200" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Find Internships & Jobs</h3>
                <p className="text-primary-200 text-sm">Connect with industry opportunities</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-white group">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Award className="w-6 h-6 text-primary-200" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Discover Scholarships</h3>
                <p className="text-primary-200 text-sm">Access financial assistance</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-white group">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Wrench className="w-6 h-6 text-primary-200" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Access Technical Resources</h3>
                <p className="text-primary-200 text-sm">Borrow, rent, or find equipment</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-md animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
          
          {/* Mobile Header (Only visible on small screens) */}
          <div className="md:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-xl font-bold text-white font-heading">T</span>
            </div>
            <span className="text-2xl font-bold text-surface-800 font-heading">TechBridge</span>
          </div>

          <div className="mb-8 text-center md:text-left">
            <h2 className="text-3xl font-bold text-surface-800 mb-2">Welcome Back</h2>
            <p className="text-gray-500">Sign in to access your dashboard</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 animate-fade-in">
                <div className="p-1 rounded-full bg-red-100/50 mt-0.5">
                  <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="you@example.com"
                    className={`w-full pl-11 pr-4 py-3 rounded-xl bg-surface-50 border text-gray-800 placeholder-gray-400 text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white ${
                      getFieldError('email')
                        ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  />
                </div>
                {getFieldError('email') && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium">{getFieldError('email')}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <a href="#" className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                    Forgot Password?
                  </a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Enter your password"
                    className={`w-full pl-11 pr-11 py-3 rounded-xl bg-surface-50 border text-gray-800 placeholder-gray-400 text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white ${
                      getFieldError('password')
                        ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {getFieldError('password') && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium">{getFieldError('password')}</p>
                )}
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600 cursor-pointer select-none">
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 mt-2 rounded-xl font-semibold text-sm text-white transition-all duration-300 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-r from-primary-500 to-accent-500 hover:opacity-90 shadow-lg shadow-primary-500/25 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="text-primary-600 hover:text-primary-700 font-semibold transition-colors duration-200"
              >
                Register now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

