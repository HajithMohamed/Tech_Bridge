import { OrganizationType } from '../models/User';
export declare const providerOfferings: readonly ['jobs', 'internships', 'scholarships', 'training', 'mentorship', 'technical_resources'];
export type ProviderOffering = typeof providerOfferings[number];
export declare const providerServiceMatrix: Record<OrganizationType, ProviderOffering[]>;
export declare const organizationTypes: OrganizationType[];
export declare const isProviderOfferingAllowed: (organizationType: OrganizationType, offering: string) => offering is ProviderOffering;
