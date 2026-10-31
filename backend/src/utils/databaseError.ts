/** Return actionable diagnostics without logging driver messages, URIs or credentials. */
export function databaseErrorMessage(error: unknown): string {
  const info = error && typeof error === 'object' ? error as { code?: unknown; name?: unknown; message?: unknown } : {};
  if (info.code === 18 || info.code === 8000 || (typeof info.message === 'string' && /bad auth|authentication failed/i.test(info.message))) {
    return 'MongoDB authentication failed. Check the database-user credentials and authSource in backend/.env MONGODB_URI. URL-encode special characters in credentials. No database changes were made by this connection attempt.';
  }
  if (info.name === 'MongoParseError') return 'Invalid MONGODB_URI. Check the connection-string format in backend/.env; no connection was opened.';
  if (info.name === 'MongoServerSelectionError' || info.name === 'MongooseServerSelectionError') {
    return 'MongoDB is unreachable. Check the database service, network access list, DNS and connection-string options in backend/.env.';
  }
  return 'MongoDB connection failed. Check backend/.env and database availability. Driver details are withheld to protect credentials.';
}
