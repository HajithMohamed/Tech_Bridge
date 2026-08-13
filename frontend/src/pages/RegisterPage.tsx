import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Building, GraduationCap, Briefcase, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import type { OrganizationType, RegisterData } from '../types';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, fieldErrors, clearError } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'student' | 'provider',
    studentProfile: {
      institution: 'Faculty of Technology',
      degree: 'ICT',
      studyYear: 1,
      skills: '',
      location: '',
      careerGoal: '',
    },
    providerProfile: {
      organizationName: '',
      organizationType: 'company',
      contactPerson: '',
      contactEmail: '',
      phone: '',
      location: '',
      website: '',
      description: '',
      verificationDocumentName: '',
      opportunityCategories: [] as string[],
      resourceAccessMethods: [] as string[],
    },
  });

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [providerSubmitted, setProviderSubmitted] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Common validations
    if (!formData.fullName.trim()) errors.fullName = 'Full name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Please enter a valid email';
    
    if (!formData.password) errors.password = 'Password is required';
    else if (formData.password.length < 6) errors.password = 'At least 6 characters required';
    
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';

    // Role specific validations
    if (formData.role === 'provider') {
      if (!formData.providerProfile.organizationName.trim()) errors.organizationName = 'Organization name is required';
      if (!formData.providerProfile.contactPerson.trim()) errors.contactPerson = 'Contact person is required';
      if (!formData.providerProfile.contactEmail.trim()) errors.contactEmail = 'Provider contact email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.providerProfile.contactEmail)) errors.contactEmail = 'Please enter a valid contact email';
      if (!formData.providerProfile.phone.trim()) errors.phone = 'Phone number is required';
      else if (!/^[+0-9][0-9\s-]{7,28}$/.test(formData.providerProfile.phone)) errors.phone = 'Enter a valid phone number (e.g. +94771234567)';
      if (!formData.providerProfile.location.trim()) errors.location = 'Location is required';
      if (formData.providerProfile.description.trim().length < 20) errors.description = 'Add at least 20 characters about your organization';
      if (!formData.providerProfile.opportunityCategories.length) errors.opportunityCategories = 'Select at least one offering';
      if (formData.providerProfile.opportunityCategories.includes('technical_resources') && !formData.providerProfile.resourceAccessMethods.length) errors.resourceAccessMethods = 'Select at least one resource access pathway';
    } else if (!formData.studentProfile.skills.trim()) {
      errors.skills = 'Add at least one skill or interest';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    setStep(2);
    clearError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) return;

    try {
      const submissionData: RegisterData = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role: formData.role,
        ...(formData.role === 'student' ? {
          studentProfile: {
            institution: formData.studentProfile.institution,
            degree: formData.studentProfile.degree as 'ICT' | 'ET' | 'BST' | 'other',
            studyYear: formData.studentProfile.studyYear,
            location: formData.studentProfile.location,
            careerGoal: formData.studentProfile.careerGoal,
            skills: formData.studentProfile.skills.split(',').map(s => s.trim()).filter(s => s),
          }
        } : {
          providerProfile: {
            organizationName: formData.providerProfile.organizationName,
            organizationType: formData.providerProfile.organizationType as OrganizationType,
            contactPerson: formData.providerProfile.contactPerson,
            contactEmail: formData.providerProfile.contactEmail || formData.email,
            phone: formData.providerProfile.phone,
            location: formData.providerProfile.location,
            website: formData.providerProfile.website,
            description: formData.providerProfile.description,
            verificationDocumentName: formData.providerProfile.verificationDocumentName || undefined,
            opportunityCategories: formData.providerProfile.opportunityCategories,
            resourceAccessMethods: formData.providerProfile.opportunityCategories.includes('technical_resources') ? formData.providerProfile.resourceAccessMethods : []
          }
        })
      };

      await register(submissionData);
      if (formData.role === 'provider') {
        setProviderSubmitted(true);
        return;
      }
      navigate('/dashboard');
    } catch {
      // Error handled by context
    }
  };

  const handleInputChange = (field: string, value: string | number, profileField?: 'studentProfile' | 'providerProfile') => {
    if (profileField) {
      setFormData((prev) => ({
        ...prev,
        [profileField]: { ...prev[profileField], [field]: value }
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
    
    if (clientErrors[field]) {
      setClientErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (error) clearError();
  };

  const toggleProviderOffer = (offer: string) => {
    setFormData((prev) => {
      const current = prev.providerProfile.opportunityCategories;
      const updated = current.includes(offer)
        ? current.filter(o => o !== offer)
        : [...current, offer];
      return {
        ...prev,
        providerProfile: { ...prev.providerProfile, opportunityCategories: updated }
      };
    });
  };

  const toggleResourceAccess = (method: string) => {
    setFormData((prev) => {
      const current = prev.providerProfile.resourceAccessMethods;
      const updated = current.includes(method) ? current.filter((item) => item !== method) : [...current, method];
      return { ...prev, providerProfile: { ...prev.providerProfile, resourceAccessMethods: updated } };
    });
  };

  const getFieldError = (field: string): string | undefined => {
    if (clientErrors[field]) return clientErrors[field];
    return fieldErrors?.find((e) => e.field === field)?.message;
  };

  if (providerSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-50">
        <div className="max-w-lg bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 text-amber-700 grid place-items-center text-2xl">⌛</div>
          <h1 className="mt-5 text-2xl font-bold text-surface-800">Provider verification pending</h1>
          <p className="mt-3 text-gray-600 leading-7">Thank you for registering. Your organization is under review. You will be able to publish opportunities after verification by the TechBridge team.</p>
          <p className="mt-3 text-sm text-gray-500">For this MVP, verification is completed manually before your provider account is activated.</p>
          <Link to="/login" className="inline-flex mt-6 px-5 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold hover:opacity-90 transition-opacity">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-50">
      {/* Left Side: Branding & Illustration */}
      <div className="hidden md:flex md:w-5/12 bg-primary-600 relative overflow-hidden flex-col justify-center px-10 lg:px-16 sticky top-0 h-screen">
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
            Join the Platform
          </h1>
          <p className="text-primary-100 text-lg mb-12 max-w-md leading-relaxed">
            Create a profile that helps us connect the right opportunities with the right talent.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4 text-white group">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <GraduationCap className="w-6 h-6 text-primary-200" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">For Students</h3>
                <p className="text-primary-200 text-sm">Find jobs, internships, and resources</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-white group">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Briefcase className="w-6 h-6 text-primary-200" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">For Providers</h3>
                <p className="text-primary-200 text-sm">Post opportunities and find talent</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Form Wizard */}
      <div className="flex-1 flex min-h-screen">
        <div className="w-full max-w-3xl mx-auto p-6 md:p-12 lg:p-16 animate-fade-in-up">
          
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-xl font-bold text-white font-heading">T</span>
            </div>
            <span className="text-2xl font-bold text-surface-800 font-heading">TechBridge</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-surface-800 mb-2">
              {step === 1 ? 'Join TechBridge' : `Create ${formData.role === 'student' ? 'Student' : 'Provider'} Account`}
            </h2>
            <p className="text-gray-500">
              {step === 1 ? 'Step 1 of 2: Select your role on the platform' : 'Step 2 of 2: Fill out your profile details'}
            </p>
          </div>

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

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 sm:p-8">
            
            {/* --- STEP 1: Role Selection --- */}
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <p className="font-semibold text-gray-700 mb-2 text-lg">I am joining as</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Student Card */}
                  <label 
                    className={`relative flex flex-col p-6 cursor-pointer rounded-2xl border-2 transition-all duration-200 ${
                      formData.role === 'student' 
                        ? 'border-primary-500 bg-primary-50/50 shadow-md shadow-primary-500/10' 
                        : 'border-gray-100 hover:border-primary-200 hover:bg-surface-50'
                    }`}
                  >
                    <input type="radio" name="role" value="student" checked={formData.role === 'student'} onChange={() => handleInputChange('role', 'student')} className="sr-only" />
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`p-3 rounded-xl ${formData.role === 'student' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'}`}>
                        <GraduationCap className="w-7 h-7" />
                      </div>
                      <h3 className={`font-semibold text-xl ${formData.role === 'student' ? 'text-primary-700' : 'text-gray-800'}`}>Student</h3>
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed">Find jobs, internships, scholarships, and technical resources to build your career.</p>
                    {formData.role === 'student' && (
                      <div className="absolute top-6 right-6 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </label>

                  {/* Provider Card */}
                  <label 
                    className={`relative flex flex-col p-6 cursor-pointer rounded-2xl border-2 transition-all duration-200 ${
                      formData.role === 'provider' 
                        ? 'border-secondary-500 bg-secondary-50/50 shadow-md shadow-secondary-500/10' 
                        : 'border-gray-100 hover:border-secondary-200 hover:bg-surface-50'
                    }`}
                  >
                    <input type="radio" name="role" value="provider" checked={formData.role === 'provider'} onChange={() => handleInputChange('role', 'provider')} className="sr-only" />
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`p-3 rounded-xl ${formData.role === 'provider' ? 'bg-secondary-100 text-secondary-600' : 'bg-gray-100 text-gray-500'}`}>
                        <Building className="w-7 h-7" />
                      </div>
                      <h3 className={`font-semibold text-xl ${formData.role === 'provider' ? 'text-secondary-700' : 'text-gray-800'}`}>Opportunity Provider</h3>
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed">Publish opportunities, offer mentorship, or provide technical resources to students.</p>
                    {formData.role === 'provider' && (
                      <div className="absolute top-6 right-6 w-5 h-5 rounded-full bg-secondary-500 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full py-4 mt-8 rounded-xl font-semibold text-white transition-all duration-300 cursor-pointer bg-gradient-to-r from-primary-500 to-accent-500 hover:opacity-90 shadow-lg shadow-primary-500/20 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group"
                >
                  Continue to Profile Details
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}

            {/* --- STEP 2: Detailed Form --- */}
            {step === 2 && (
              <div className="space-y-6 animate-slide-in-left">
                {formData.role === 'provider' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                    <p className="text-sm text-amber-800 font-medium">Provider accounts are reviewed manually by the TechBridge team to keep opportunities and resource arrangements trustworthy.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full name</label>
                    <input type="text" value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                    {getFieldError('fullName') && <p className="mt-1 text-xs text-red-500">{getFieldError('fullName')}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
                    <input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                    {getFieldError('email') && <p className="mt-1 text-xs text-red-500">{getFieldError('email')}</p>}
                  </div>
                </div>

                {/* --- STUDENT FIELDS --- */}
                {formData.role === 'student' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Institution</label>
                        <select value={formData.studentProfile.institution} onChange={(e) => handleInputChange('institution', e.target.value, 'studentProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all appearance-none cursor-pointer">
                          <option value="Faculty of Technology">Faculty of Technology</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Programme</label>
                        <select value={formData.studentProfile.degree} onChange={(e) => handleInputChange('degree', e.target.value, 'studentProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all appearance-none cursor-pointer">
                          <option value="ICT">ICT</option>
                          <option value="ET">Engineering Tech</option>
                          <option value="BST">Biosystems Tech</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Study year</label>
                        <select value={formData.studentProfile.studyYear} onChange={(e) => handleInputChange('studyYear', parseInt(e.target.value), 'studentProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all appearance-none cursor-pointer">
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Skills or interests (comma separated)</label>
                      <input type="text" placeholder="HTML, CSS, React..." value={formData.studentProfile.skills} onChange={(e) => handleInputChange('skills', e.target.value, 'studentProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location <span className="font-normal text-gray-400">(optional)</span></label>
                        <input type="text" value={formData.studentProfile.location} onChange={(e) => handleInputChange('location', e.target.value, 'studentProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Career goal <span className="font-normal text-gray-400">(optional)</span></label>
                        <input type="text" placeholder="Frontend developer" value={formData.studentProfile.careerGoal} onChange={(e) => handleInputChange('careerGoal', e.target.value, 'studentProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                      </div>
                    </div>
                  </>
                )}

                {/* --- PROVIDER FIELDS --- */}
                {formData.role === 'provider' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Provider type</label>
                        <select value={formData.providerProfile.organizationType} onChange={(e) => handleInputChange('organizationType', e.target.value, 'providerProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all appearance-none cursor-pointer">
                          <option value="company">Company</option>
                          <option value="ngo">NGO</option>
                          <option value="training_org">Training Organization</option>
                          <option value="scholarship_org">Scholarship Organization</option>
                          <option value="individual">Individual</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organization / professional name</label>
                        <input type="text" value={formData.providerProfile.organizationName} onChange={(e) => handleInputChange('organizationName', e.target.value, 'providerProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                        {getFieldError('organizationName') && <p className="mt-1 text-xs text-red-500">{getFieldError('organizationName')}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact person</label>
                        <input type="text" value={formData.providerProfile.contactPerson} onChange={(e) => handleInputChange('contactPerson', e.target.value, 'providerProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                        {getFieldError('contactPerson') && <p className="mt-1 text-xs text-red-500">{getFieldError('contactPerson')}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Provider contact email</label>
                        <input type="email" value={formData.providerProfile.contactEmail} onChange={(e) => handleInputChange('contactEmail', e.target.value, 'providerProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                        {getFieldError('contactEmail') && <p className="mt-1 text-xs text-red-500">{getFieldError('contactEmail')}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone number</label>
                        <input type="tel" value={formData.providerProfile.phone} onChange={(e) => handleInputChange('phone', e.target.value, 'providerProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                        {getFieldError('phone') && <p className="mt-1 text-xs text-red-500">{getFieldError('phone')}</p>}
                      </div>
                    </div>

                    {formData.providerProfile.organizationType === 'scholarship_org' && <div className="p-3 rounded-xl border border-primary-200 bg-primary-50 text-primary-800 text-sm">Verified scholarship provider badge requested. The TechBridge team will manually review this provider before scholarship publishing is enabled.</div>}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location</label>
                        <input type="text" value={formData.providerProfile.location} onChange={(e) => handleInputChange('location', e.target.value, 'providerProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                        {getFieldError('location') && <p className="mt-1 text-xs text-red-500">{getFieldError('location')}</p>}
                      </div>
                      {getFieldError('opportunityCategories') && <p className="mt-2 text-xs text-red-500">{getFieldError('opportunityCategories')}</p>}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Website <span className="font-normal text-gray-400">(optional)</span></label>
                        <input type="url" value={formData.providerProfile.website} onChange={(e) => handleInputChange('website', e.target.value, 'providerProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organization description</label>
                      <textarea value={formData.providerProfile.description} onChange={(e) => handleInputChange('description', e.target.value, 'providerProfile')} minLength={20} className="w-full min-h-28 px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" placeholder="Briefly describe your organization and the support you offer students." />
                      {getFieldError('description') && <p className="mt-1 text-xs text-red-500">{getFieldError('description')}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Supporting document <span className="font-normal text-gray-400">(optional)</span></label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleInputChange('verificationDocumentName', e.target.files?.[0]?.name || '', 'providerProfile')} className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 text-sm text-gray-600" />
                      <p className="mt-1 text-xs text-gray-500">For the MVP, TechBridge records the filename for manual review; file storage can be added later.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">What can you offer?</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { id: 'jobs', label: 'Jobs / freelance projects' },
                          { id: 'internships', label: 'Internships / hiring' },
                          { id: 'scholarships', label: 'Scholarships / financial assistance' },
                          { id: 'training', label: 'Training / workshops' },
                          { id: 'mentorship', label: 'Mentorship / guidance' },
                          { id: 'technical_resources', label: 'Technical resources' },
                        ].map(offer => (
                          <label key={offer.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-surface-50 cursor-pointer hover:bg-white hover:border-primary-300 transition-colors">
                            <input 
                              type="checkbox" 
                              checked={formData.providerProfile.opportunityCategories.includes(offer.id)}
                              onChange={() => toggleProviderOffer(offer.id)}
                              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" 
                            />
                            <span className="text-sm font-medium text-gray-700">{offer.label}</span>
                          </label>
                        ))}
                      </div>
                      {formData.providerProfile.opportunityCategories.includes('technical_resources') && <div className="mt-5 rounded-xl border border-primary-100 bg-primary-50/50 p-4"><label className="block text-sm font-semibold text-primary-800 mb-3">Technical resource access pathways</label><p className="text-xs text-primary-700 mb-3">Select the arrangements your organization can genuinely provide. TechBridge only connects students to your terms.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{[{ id: 'rent', label: 'Rental' }, { id: 'installment', label: 'Installment payment' }, { id: 'interest_free', label: 'Interest-free payment' }, { id: 'sponsorship', label: 'Sponsorship' }, { id: 'donation', label: 'Donation' }].map((method) => <label key={method.id} className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={formData.providerProfile.resourceAccessMethods.includes(method.id)} onChange={() => toggleResourceAccess(method.id)} />{method.label}</label>)}</div>{getFieldError('resourceAccessMethods') && <p className="mt-2 text-xs text-red-500">{getFieldError('resourceAccessMethods')}</p>}</div>}
                    </div>
                  </>
                )}
                {/* --- PASSWORD FIELDS --- */}
                <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} placeholder="At least 6 characters" value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} className="w-full px-4 pr-11 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {getFieldError('password') && <p className="mt-1 text-xs text-red-500">{getFieldError('password')}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={(e) => handleInputChange('confirmPassword', e.target.value)} className="w-full px-4 pr-11 py-2.5 rounded-xl bg-surface-50 border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {getFieldError('confirmPassword') && <p className="mt-1 text-xs text-red-500">{getFieldError('confirmPassword')}</p>}
                  </div>
                </div>

                <div className="flex gap-4 mt-8 pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-5 py-3.5 rounded-xl font-semibold text-gray-600 bg-surface-100 hover:bg-surface-200 transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-white transition-all duration-300 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2 group ${
                      formData.role === 'student' 
                        ? 'bg-gradient-to-r from-primary-500 to-accent-500 hover:opacity-90 shadow-primary-500/25 hover:shadow-primary-500/40' 
                        : 'bg-gradient-to-r from-secondary-500 to-primary-500 hover:opacity-90 shadow-secondary-500/25 hover:shadow-secondary-500/40'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create {formData.role === 'student' ? 'student' : 'provider'} account
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-8 text-center pb-8">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary-600 hover:text-primary-700 font-bold transition-colors duration-200"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

