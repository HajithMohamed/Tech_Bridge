import type { IUser } from '../models/User';

// Deliberately exclude account email, contact details and verification evidence.
// New model fields stay private until explicitly added to this contract.
const publicProfileFields = [
  'organizationName', 'organizationType', 'verified', 'location', 'website',
  'logoUrl', 'description', 'opportunityCategories', 'resourceAccessMethods',
] as const;

type ProviderProfile = NonNullable<IUser['providerProfile']>;
export type PublicProviderDetails = Pick<ProviderProfile, typeof publicProfileFields[number]>;

export const publicProviderProfileSelect = [
  'fullName', 'createdAt', ...publicProfileFields.map((field) => `providerProfile.${field}`),
].join(' ');

export const publicListingProviderSelect =
  'fullName providerProfile.organizationName providerProfile.organizationType providerProfile.verified';

export const publicResourceOwnerSelect = `role ${publicListingProviderSelect}`;

export function toPublicProviderDetails(profile: PublicProviderDetails): PublicProviderDetails {
  return Object.fromEntries(publicProfileFields.map((field) => [field, profile[field]])) as PublicProviderDetails;
}
