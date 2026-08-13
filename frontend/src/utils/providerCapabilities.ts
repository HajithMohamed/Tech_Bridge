import type { OpportunityType, OrganizationType, ProviderProfile, ResourceAccessType } from '../types';

export type ProviderOfferingId = 'jobs' | 'internships' | 'scholarships' | 'training' | 'mentorship' | 'technical_resources';

export const providerOfferings: Array<{ id: ProviderOfferingId; label: string; description: string; types: OpportunityType[] }> = [
  { id: 'jobs', label: 'Jobs & paid projects', description: 'Jobs, part-time work, remote work, freelancing and student projects.', types: ['job', 'freelance'] },
  { id: 'internships', label: 'Internships & referrals', description: 'Internships, student placements and work referrals.', types: ['internship'] },
  { id: 'scholarships', label: 'Scholarships & financial support', description: 'Scholarships, financial assistance and educational support.', types: ['scholarship'] },
  { id: 'training', label: 'Training & career programs', description: 'Courses, workshops, skill programs and certifications.', types: ['course', 'workshop'] },
  { id: 'mentorship', label: 'Mentorship & guidance', description: 'Career, technical, internship and portfolio guidance.', types: ['mentorship'] },
  { id: 'technical_resources', label: 'Technical resources', description: 'Equipment access through rental, installments, sponsorship or donation.', types: [] },
];

export interface ProviderTypeConfig {
  label: string;
  shortLabel: string;
  description: string;
  allowedOfferings: ProviderOfferingId[];
  impactLabel: string;
  quickActionLabel: string;
  quickActionDescription: string;
}

export const providerTypeConfigs: Record<OrganizationType, ProviderTypeConfig> = {
  company: { label: 'Companies & employers', shortLabel: 'Employer portal', description: 'Post jobs, internships, paid student projects and industry mentorship.', allowedOfferings: ['jobs', 'internships', 'mentorship'], impactLabel: 'Students connected to industry', quickActionLabel: 'Post a job or internship', quickActionDescription: 'Create employment, placement or industry-mentorship listings.' },
  scholarship_org: { label: 'Scholarship & financial providers', shortLabel: 'Financial support portal', description: 'Manage scholarships, financial assistance and educational support.', allowedOfferings: ['scholarships'], impactLabel: 'Students supported financially', quickActionLabel: 'Create financial support listing', quickActionDescription: 'Publish a scholarship or educational support opportunity.' },
  training_org: { label: 'Training providers', shortLabel: 'Training portal', description: 'Deliver courses, workshops, skill-development programs and certifications.', allowedOfferings: ['training'], impactLabel: 'Learning opportunities delivered', quickActionLabel: 'Create course or workshop', quickActionDescription: 'Publish a course, workshop or skills program.' },
  individual: { label: 'Professionals & mentors', shortLabel: 'Mentor portal', description: 'Offer career, technical, internship and portfolio guidance to students.', allowedOfferings: ['mentorship'], impactLabel: 'Students receiving guidance', quickActionLabel: 'Offer mentorship', quickActionDescription: 'Create a mentoring or industry-advice listing.' },
  resource_provider: { label: 'Technical resource providers', shortLabel: 'Resource provider portal', description: 'Provide affordable access to equipment and project resources.', allowedOfferings: ['technical_resources'], impactLabel: 'Resources made accessible', quickActionLabel: 'List technical resource', quickActionDescription: 'Offer equipment through approved access pathways.' },
  local_business: { label: 'Local businesses & project providers', shortLabel: 'Project provider portal', description: 'Publish student-friendly paid projects and local digital-service work.', allowedOfferings: ['jobs'], impactLabel: 'Paid projects created', quickActionLabel: 'Post a paid student project', quickActionDescription: 'Create a freelance brief, job or technical-assistance project.' },
  alumni: { label: 'Alumni', shortLabel: 'Alumni portal', description: 'Support students through mentorship, networking, referrals and industry connections.', allowedOfferings: ['jobs', 'internships', 'mentorship'], impactLabel: 'Students supported through alumni', quickActionLabel: 'Share an opportunity or guidance', quickActionDescription: 'Post a referral, internship or mentorship listing.' },
  faculty: { label: 'Faculty & academic community', shortLabel: 'Academic community portal', description: 'Share academic guidance, workshops, career programs and industry recommendations.', allowedOfferings: ['training', 'mentorship'], impactLabel: 'Academic support opportunities', quickActionLabel: 'Create academic support listing', quickActionDescription: 'Post a workshop, career program or guidance opportunity.' },
  ngo: { label: 'Community & NGO providers', shortLabel: 'Community support portal', description: 'Provide financial support, mentorship and technical-resource access.', allowedOfferings: ['scholarships', 'mentorship', 'technical_resources'], impactLabel: 'Students supported by the community', quickActionLabel: 'Create community support listing', quickActionDescription: 'Publish assistance, guidance or resource-access opportunities.' },
};

export const providerTypeOptions = (Object.keys(providerTypeConfigs) as OrganizationType[]).map((value) => ({ value, label: providerTypeConfigs[value].label }));

export const providerConfigFor = (profile?: ProviderProfile): ProviderTypeConfig => providerTypeConfigs[profile?.organizationType || 'company'];

export const allowedProviderOfferings = (profile?: ProviderProfile) => providerOfferings.filter((offering) => providerConfigFor(profile).allowedOfferings.includes(offering.id));

export const resourceAccessOptions: Array<{ value: ResourceAccessType; label: string }> = [
  { value: 'rent', label: 'Rent' }, { value: 'installment', label: 'Installment payment' }, { value: 'interest_free', label: 'Interest-free payment' }, { value: 'sponsorship', label: 'Sponsorship' }, { value: 'donation', label: 'Donation' },
];

export const enabledOpportunityTypes = (profile?: ProviderProfile): OpportunityType[] => {
  const selected = profile?.opportunityCategories || [];
  return allowedProviderOfferings(profile).filter((offering) => selected.includes(offering.id)).flatMap((offering) => offering.types);
};

export const canManageResources = (profile?: ProviderProfile) => allowedProviderOfferings(profile).some((offering) => offering.id === 'technical_resources') && profile?.opportunityCategories?.includes('technical_resources') === true;

export const enabledResourceAccess = (profile?: ProviderProfile): ResourceAccessType[] => canManageResources(profile) ? (profile?.resourceAccessMethods || []) as ResourceAccessType[] : [];
