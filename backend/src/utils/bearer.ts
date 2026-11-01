/** One bounded JWT credential; reject prefix lookalikes and extra credentials. */
export function bearerToken(authorization: unknown): string | null {
  if (typeof authorization !== 'string' || authorization.length > 4096) return null;
  return /^Bearer[\t ]+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization.trim())?.[1] || null;
}
