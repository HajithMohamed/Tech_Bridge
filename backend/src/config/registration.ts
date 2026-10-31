import { mailDeliveryMode, publicAppUrl } from '../services/mailDelivery';

export type RegistrationMode = 'legacy' | 'email_verification';

/** Server-owned rollout choice. Existing clients retain the approved 201 contract. */
export function registrationMode(environment: NodeJS.ProcessEnv = process.env): RegistrationMode {
  const mode = environment.AUTH_REGISTRATION_MODE ?? 'legacy';
  if (mode !== 'legacy' && mode !== 'email_verification') throw new Error('AUTH_REGISTRATION_MODE must be legacy or email_verification.');
  if (mode === 'email_verification') {
    // The draft only has a local adapter. Do not activate a flow that locks new
    // accounts behind undeliverable links, particularly in production.
    if (mailDeliveryMode(environment) !== 'local') throw new Error('Email-verification registration requires a configured delivery adapter.');
    publicAppUrl(environment);
  }
  return mode;
}
