import { OrganizationType } from '../models/User';

export const providerOfferings = ['jobs', 'internships', 'scholarships', 'training', 'mentorship', 'technical_resources'] as const;
export type ProviderOffering = typeof providerOfferings[number];

export const providerServiceMatrix: Record<OrganizationType, ProviderOffering[]> = {
  company: ['jobs', 'internships', 'mentorship'],
  scholarship_org: ['scholarships'],
  training_org: ['training'],
  individual: ['mentorship'],
  resource_provider: ['technical_resources'],
  local_business: ['jobs'],
  alumni: ['jobs', 'internships', 'mentorship'],
  faculty: ['training', 'mentorship'],
  ngo: ['scholarships', 'mentorship', 'technical_resources'],
};

export const organizationTypes = Object.keys(providerServiceMatrix) as OrganizationType[];

export const isProviderOfferingAllowed = (organizationType: OrganizationType, offering: string): offering is ProviderOffering =>
  providerServiceMatrix[organizationType].includes(offering as ProviderOffering);
