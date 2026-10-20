import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import AuditLog from '../models/AuditLog';

export class AdminBootstrapError extends Error {}

/** An offline, explicitly enabled development command, never an HTTP signup path. */
export function validateAdminBootstrap(environment: NodeJS.ProcessEnv) {
  if (!['development', 'test'].includes(environment.NODE_ENV || '') || environment.ADMIN_CREATE_ENABLED !== 'true') {
    throw new AdminBootstrapError('Admin creation requires NODE_ENV=development and ADMIN_CREATE_ENABLED=true (test mode is reserved for isolated tests).');
  }
  const uri = environment.MONGODB_URI || '';
  // Extract only the database path, supporting SRV, replica-set and escaped credentials.
  const target = /^mongodb(?:\+srv)?:\/\/[^/?#]+\/([^/?#]+)(?:\?[^#]*)?$/.exec(uri);
  let database = '';
  try { database = decodeURIComponent(target?.[1] || ''); } catch { /* Fail closed below. */ }
  if (!target || !database || !/^[a-zA-Z0-9_-]{1,63}$/.test(database) || environment.ADMIN_CREATE_CONFIRM_DATABASE !== database) {
    throw new AdminBootstrapError('Set an explicit database in MONGODB_URI and ADMIN_CREATE_CONFIRM_DATABASE to its exact database name.');
  }
  if (environment.NODE_ENV === 'test') {
    let parsed: URL;
    try { parsed = new URL(uri); } catch { throw new AdminBootstrapError('Invalid isolated test database.'); }
    if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || parsed.username || parsed.password || !/^techbridge_test_[a-f0-9]{32}$/.test(database)) {
      throw new AdminBootstrapError('Test admin creation requires an isolated loopback test database.');
    }
  }
  const email = environment.ADMIN_CREATE_EMAIL?.trim().toLowerCase() || '';
  const fullName = environment.ADMIN_CREATE_NAME?.trim() || '';
  const password = environment.ADMIN_CREATE_PASSWORD || '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminBootstrapError('Provide a valid ADMIN_CREATE_EMAIL.');
  if (fullName.length < 2 || fullName.length > 100 || /[\r\n]/.test(fullName)) throw new AdminBootstrapError('Provide ADMIN_CREATE_NAME between 2 and 100 characters.');
  if (password.length < 16 || Buffer.byteLength(password, 'utf8') > 72 || /[\r\n]/.test(password)) {
    throw new AdminBootstrapError('Provide ADMIN_CREATE_PASSWORD with at least 16 characters, at most 72 UTF-8 bytes, and no line breaks.');
  }
  return { uri, email, fullName, password };
}

export async function createDevelopmentAdmin(environment: NodeJS.ProcessEnv): Promise<{ created: boolean }> {
  const config = validateAdminBootstrap(environment);
  const connection = mongoose.createConnection();
  try {
    // Do not initialize indexes or collections merely by inspecting this database.
    await connection.openUri(config.uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5_000 });
    const BootstrapUser = connection.model<IUser>('User', User.schema);
    const BootstrapAudit = connection.model('AuditLog', AuditLog.schema);
    const indexes = await BootstrapUser.collection.indexes();
    if (!indexes.some((index) => index.unique === true && index.key.email === 1 && Object.keys(index.key).length === 1 && !index.sparse && !index.partialFilterExpression)) {
      throw new AdminBootstrapError('A standard unique email index is required. Initialize the application database through its normal setup before creating an admin.');
    }
    const existing = async () => {
      const user = await BootstrapUser.findOne({ email: config.email }).select('role');
      if (user && user.role !== 'admin') throw new AdminBootstrapError('This email already belongs to another role. No account was promoted or changed.');
      return Boolean(user);
    };
    if (await existing()) return { created: false };
    try {
      await connection.transaction(async (session) => {
        const [admin] = await BootstrapUser.create([{
          fullName: config.fullName, email: config.email, password: config.password,
          role: 'admin', accountStatus: 'active', tokenVersion: 0,
        }], { session });
        await BootstrapAudit.create([{
          adminId: admin._id, targetType: 'user', targetId: admin._id,
          action: 'admin_created_local_cli',
          reason: 'Authorized offline development bootstrap by the machine operator. adminId identifies the created account, not an authenticated operator.',
          after: { role: 'admin', accountStatus: 'active' },
        }], { session });
      }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 });
      return { created: true };
    } catch (error) {
      if ((error as { code?: unknown }).code === 11000 && await existing()) return { created: false };
      throw error;
    }
  } finally {
    await connection.close();
  }
}
