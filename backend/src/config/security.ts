export interface SecurityConfiguration { allowedOrigins: string[] }

/** Validate deployment settings without including rejected values in errors. */
export function securityConfiguration(environment: NodeJS.ProcessEnv = process.env): SecurityConfiguration {
  const mode = environment.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(mode)) throw new Error('NODE_ENV must be development, test or production.');
  const production = mode === 'production';
  if (production && (
    !environment.JWT_SECRET || Buffer.byteLength(environment.JWT_SECRET.trim(), 'utf8') < 32 ||
    /^(change.?me|example|secret|test|demo)/i.test(environment.JWT_SECRET.trim())
  )) throw new Error('Production requires a private JWT_SECRET of at least 32 bytes.');
  const configured = environment.CORS_ORIGINS;
  if (production && !configured) throw new Error('Production requires an explicit CORS_ORIGINS allowlist.');
  const values = configured === undefined ? ['http://localhost:5173', 'http://localhost:3000'] : configured.split(',').map((value) => value.trim());
  if (!values.length || values.length > 10 || values.some((value) => !value || value.length > 200)) throw new Error('Configure between one and ten explicit CORS origins.');
  const origins = values.map((value) => {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('CORS_ORIGINS contains an invalid origin.'); }
    if (
      url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !['http:', 'https:'].includes(url.protocol) || url.hostname.includes('*') ||
      (production && url.protocol !== 'https:')
    ) throw new Error('CORS_ORIGINS must contain explicit origins; production requires HTTPS.');
    return url.origin;
  });
  return { allowedOrigins: [...new Set(origins)] };
}
