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
  availabilityHours?: number;
  preferredWorkType?: 'remote' | 'on-site' | 'hybrid' | 'flexible';
  learningGoals?: string[];
  certifications?: string[];
  portfolioUrl?: string;
}

export type OrganizationType = 'company' | 'training_org' | 'scholarship_org' | 'ngo' | 'individual';

export interface ProviderProfile {
  organizationName: string;
  organizationType: OrganizationType;
  verified?: boolean;
  verificationStatus?: 'PENDING' | 'VERIFIED';
  contactEmail: string;
  contactPerson: string;
  phone: string;
  location: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  verificationDocumentName?: string;
  opportunityCategories: string[];
  resourceAccessMethods?: string[];
}

export type OpportunityType = 'job' | 'internship' | 'scholarship' | 'course' | 'freelance' | 'workshop' | 'mentorship';
export type WorkMode = 'remote' | 'on-site' | 'hybrid';
export type OpportunityStatus = 'draft' | 'open' | 'closed' | 'expired';
export type CoverageType = 'full' | 'partial' | 'tuition_only' | 'equipment_only' | 'stipend';

export interface OpportunityProvider {
  _id: string;
  fullName: string;
  email: string;
  providerProfile?: Pick<ProviderProfile, 'organizationName' | 'organizationType' | 'verified' | 'verificationStatus'>;
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

  duration?: string;
  isPaid?: boolean;
  preferredAcademicBackground?: string;
  startDate?: string;
  endDate?: string;
  fee?: number;
  isFree?: boolean;
  mentorName?: string;
  professionalField?: string;
  experience?: string;
  mentorshipType?: 'Career guidance' | 'Technical guidance' | 'Internship guidance' | 'Portfolio guidance';
  availability?: string;
  paymentInfo?: string;
  contactMethod?: string;

  createdAt: string;
  updatedAt: string;
}

export interface SkillResource {
  skill: string;
  label: string;
  url: string;
}

export interface MatchedOpportunity extends Opportunity {
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
  skillScore: number;
  careerRelevanceScore: number;
  locationScore: number;
  skillResources: SkillResource[];
}

export type ResourceCategory = 'laptop' | 'arduino' | 'raspberry_pi' | 'sensor' | 'electronic_component' | 'dev_board' | 'other';
export type ResourceCondition = 'new' | 'used_good' | 'used_fair';
export type ResourceAccessType = 'borrow' | 'share' | 'rent' | 'installment' | 'interest_free' | 'sponsorship' | 'donation';
export type ResourceStatus = 'available' | 'claimed';

export interface ResourceListingOwner {
  _id: string;
  fullName: string;
  email: string;
  role: User['role'];
  providerProfile?: Pick<ProviderProfile, 'organizationName' | 'organizationType' | 'verified' | 'verificationStatus' | 'contactEmail' | 'phone'>;
}

export interface ResourceAccessDetails {
  borrowShare?: {
    borrowDurationDays: number;
    pickupLocation: string;
    returnCondition: string;
  };
  rent?: {
    pricePerMonth: number;
    currency: string;
    minRentalMonths: number;
    securityDeposit?: number;
  };
  installment?: {
    totalPrice: number;
    downPayment: number;
    monthlyInstallmentAmount: number;
    numberOfMonths: number;
    lateFeePolicy: string;
  };
  interestFree?: {
    totalPrice: number;
    monthlyInstallmentAmount: number;
    numberOfMonths: number;
    eligibilityCriteria: string[];
    repaymentStartDate: string;
    interestRate: 0;
  };
  sponsorship?: {
    eligibilityCriteria: string[];
    applicationDeadline: string;
    numberOfUnitsAvailable: number;
    sponsorOrganization: string;
  };
  donation?: {
    itemAgeYears: number;
    conditionNotes: string;
    pickupOrDeliveryMethod: string;
    claimDeadline: string;
  };
}

export interface ResourceListing {
  _id: string;
  itemName: string;
  category: ResourceCategory;
  condition?: ResourceCondition;
  accessType: ResourceAccessType;
  listedBy: string | ResourceListingOwner;
  providerOrgVerified: boolean;
  quantityAvailable: number;
  status: ResourceStatus;
  accessDetails: ResourceAccessDetails;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceListingFormData {
  itemName: string;
  category: ResourceCategory;
  condition?: ResourceCondition;
  accessType: ResourceAccessType;
  quantityAvailable: number;
  accessDetails: ResourceAccessDetails;
}

export type ApplicationStatus = 'applied' | 'reviewed' | 'accepted' | 'rejected';

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
  studentId: string | ApplicationApplicant;
  message?: string;
  status: ApplicationStatus;
  appliedAt: string;
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
  duration?: string;
  isPaid?: boolean;
  preferredAcademicBackground?: string;
  startDate?: string;
  endDate?: string;
  fee?: number;
  isFree?: boolean;
  mentorName?: string;
  professionalField?: string;
  experience?: string;
  mentorshipType?: 'Career guidance' | 'Technical guidance' | 'Internship guidance' | 'Portfolio guidance';
  availability?: string;
  paymentInfo?: string;
  contactMethod?: string;
}

export type ResourceRequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export interface ResourceRequestResource {
  _id: string;
  itemName: string;
  category: ResourceCategory;
  condition?: ResourceCondition;
  accessType: ResourceAccessType;
  quantityAvailable: number;
  status: ResourceStatus;
}

export interface ResourceRequest {
  _id: string;
  studentId: string | ApplicationApplicant;
  providerId: string | ResourceListingOwner;
  resourceId: string | ResourceRequestResource;
  requestedAccessType: ResourceAccessType;
  durationOrTerms?: string;
  message?: string;
  status: ResourceRequestStatus;
  createdAt: string;
  updatedAt: string;
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
