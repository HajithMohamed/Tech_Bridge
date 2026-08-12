import type { OpportunityType, ProviderProfile, ResourceAccessType } from '../types';

export const providerOfferings = [
  { id: 'jobs', label: 'Jobs & freelance projects', description: 'Post paid jobs and project briefs.', types: ['job', 'freelance'] as OpportunityType[] },
  { id: 'internships', label: 'Internships & hiring', description: 'Connect students to work placements.', types: ['internship'] as OpportunityType[] },
  { id: 'scholarships', label: 'Scholarships & assistance', description: 'Offer funding and eligibility-based support.', types: ['scholarship'] as OpportunityType[] },
  { id: 'training', label: 'Training & workshops', description: 'Publish courses, workshops and certifications.', types: ['course', 'workshop'] as OpportunityType[] },
  { id: 'mentorship', label: 'Mentorship & guidance', description: 'Offer career, technical or portfolio guidance.', types: ['mentorship'] as OpportunityType[] },
  { id: 'technical_resources', label: 'Technical resources', description: 'Offer affordable equipment access.', types: [] as OpportunityType[] },
] as const;

export const resourceAccessOptions: Array<{ value: ResourceAccessType; label: string }> = [
  { value: 'rent', label: 'Rent' },
  { value: 'installment', label: 'Installment payment' },
  { value: 'interest_free', label: 'Interest-free payment' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'donation', label: 'Donation' },
];

export const enabledOpportunityTypes = (profile?: ProviderProfile): OpportunityType[] => {
  const selected = profile?.opportunityCategories || [];
  return providerOfferings
    .filter((offering) => selected.includes(offering.id) && (offering.id !== 'scholarships' || profile?.organizationType === 'scholarship_org' || profile?.organizationType === 'ngo'))
    .flatMap((offering) => offering.types)
    .filter((type, index, values) => values.indexOf(type) === index);
};

export const canManageResources = (profile?: ProviderProfile) =>
  profile?.opportunityCategories?.includes('technical_resources') === true;

export const enabledResourceAccess = (profile?: ProviderProfile): ResourceAccessType[] =>
  canManageResources(profile) ? (profile?.resourceAccessMethods || []) as ResourceAccessType[] : [];
