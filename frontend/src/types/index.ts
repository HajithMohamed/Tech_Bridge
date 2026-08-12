export interface User {
  _id: string;
  fullName: string;
  email: string;
  role: 'student' | 'provider' | 'admin';
  studentProfile?: StudentProfile;
  providerProfile?: ProviderProfile;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token?: string;
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
  studentProfile?: StudentProfile;
  providerProfile?: ProviderProfile;
}

export interface StudentProfile {
  institution: string;
  degree: 'ICT' | 'ET' | 'BST' | 'other';
  studyYear: number;
  location?: string;
  skills: string[];
  careerGoal?: string;
}

export type OrganizationType = 'company' | 'training_org' | 'scholarship_org' | 'ngo' | 'individual';

export interface ProviderProfile {
  organizationName: string;
  organizationType: OrganizationType;
  verified?: boolean;
  contactEmail: string;
  contactPerson: string;
  phone: string;
  location: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  opportunityCategories: string[];
  resourceAccessMethods?: string[];
}

export type OpportunityType = 'job' | 'internship' | 'scholarship' | 'course' | 'freelance' | 'workshop';
export type WorkMode = 'remote' | 'on-site' | 'hybrid';
export type OpportunityStatus = 'draft' | 'open' | 'closed' | 'expired';
export type CoverageType = 'full' | 'partial' | 'tuition_only' | 'equipment_only' | 'stipend';

export interface OpportunityProvider {
  _id: string;
  fullName: string;
  email: string;
  providerProfile?: Pick<ProviderProfile, 'organizationName' | 'organizationType' | 'verified'>;
}

export interface Opportunity {
  _id: string;
  title: string;
  description: string;
  type: OpportunityType;
  requiredSkills: string[];
  location: string;
  workMode: WorkMode;
  providerId: string | OpportunityProvider;
  status: OpportunityStatus;
  views: number;
  applicationCount?: number;
  applicationDeadline: string;
  amount?: number;
  currency?: string;
  coverageType?: CoverageType;
  eligibilityCriteria?: string[];
  numberOfAwards?: number;
  renewable?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ResourceCategory = 'laptop' | 'arduino' | 'raspberry_pi' | 'sensor' | 'development_board' | 'electronic_component' | 'project_equipment' | 'other';
export type AccessMethod = 'borrow' | 'share' | 'rent' | 'installment' | 'interest_free' | 'sponsorship' | 'donation';
export type ResourceAvailability = 'available' | 'unavailable';

export interface ResourceProvider {
  _id: string;
  fullName: string;
  email: string;
  providerProfile?: Pick<ProviderProfile, 'organizationName' | 'organizationType' | 'verified' | 'contactEmail' | 'phone'>;
}

export interface Resource {
  _id: string;
  name: string;
  description: string;
  category: ResourceCategory;
  accessMethods: AccessMethod[];
  location: string;
  availability: ResourceAvailability;
  quantity: number;
  rentalRate?: number;
  currency?: string;
  providerId: string | ResourceProvider;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceFormData {
  name: string;
  description: string;
  category: ResourceCategory;
  accessMethods: AccessMethod[];
  location: string;
  availability: ResourceAvailability;
  quantity: number;
  rentalRate?: number;
  currency?: string;
}

export type ApplicationStatus = 'submitted' | 'reviewing' | 'accepted' | 'rejected';

export interface ApplicationApplicant {
  _id: string;
  fullName: string;
  email: string;
  studentProfile?: Pick<StudentProfile, 'institution' | 'degree' | 'studyYear' | 'skills' | 'careerGoal'>;
}

export interface ApplicationOpportunity {
  _id: string;
  title: string;
  type: OpportunityType;
  location: string;
  workMode: WorkMode;
  applicationDeadline: string;
  status: OpportunityStatus;
}

export interface OpportunityApplication {
  _id: string;
  opportunityId: string | ApplicationOpportunity;
  applicantId: string | ApplicationApplicant;
  message?: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderDashboard {
  stats: {
    totalOpportunities: number;
    scholarships: number;
    applicationsReceived: number;
    activeListings: number;
    resourceCount: number;
    expiringSoon: number;
    views: number;
  };
  recentOpportunities: Array<Pick<Opportunity, '_id' | 'title' | 'type' | 'status' | 'applicationDeadline' | 'createdAt' | 'views'>>;
}

export interface OpportunityFormData {
  title: string;
  description: string;
  type: OpportunityType;
  requiredSkills: string[];
  location: string;
  workMode: WorkMode;
  status: OpportunityStatus;
  applicationDeadline: string;
  amount?: number;
  currency?: string;
  coverageType?: CoverageType;
  eligibilityCriteria?: string[];
  numberOfAwards?: number;
  renewable?: boolean;
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
