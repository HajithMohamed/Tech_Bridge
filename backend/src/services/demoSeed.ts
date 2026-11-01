import mongoose from 'mongoose';
import User, { IUser } from '../models/User';

export const demoAdminEmail = 'admin@demo.techbridge.test';
export class DemoSeedConfigError extends Error {}

/** Validate everything before opening a connection; never include values in errors. */
export function validateDemoSeedConfiguration(environment: NodeJS.ProcessEnv) {
  if (!['development', 'test'].includes(environment.NODE_ENV || '') || environment.ENABLE_DEMO_SEED !== 'true') {
    throw new DemoSeedConfigError('Demo seeding requires development/test mode and ENABLE_DEMO_SEED=true.');
  }
  let target: URL;
  try { target = new URL(environment.MONGODB_URI || ''); }
  catch { throw new DemoSeedConfigError('Provide an explicit local demo database URI.'); }
  const allowedDatabase = environment.NODE_ENV === 'development'
    ? target.pathname === '/techbridge_demo'
    : /^\/techbridge_test_[a-f0-9]{32}$/.test(target.pathname);
  if (target.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
      target.username || target.password || target.hash || !allowedDatabase) {
    throw new DemoSeedConfigError('Demo seeding is restricted to the dedicated loopback demo database (or an isolated test database).');
  }
  const options = [...target.searchParams.entries()];
  if (new Set(options.map(([key]) => key)).size !== options.length || options.some(([key, value]) =>
    key === 'replicaSet' ? !/^[a-zA-Z0-9_-]{1,100}$/.test(value)
      : key === 'directConnection' ? value !== 'true' : true)) {
    throw new DemoSeedConfigError('Only replicaSet and directConnection options are allowed for the local demo database.');
  }
  const password = environment.DEMO_ADMIN_PASSWORD;
  if (!password || password.length < 16 || Buffer.byteLength(password, 'utf8') > 72 || /[\r\n]/.test(password)) {
    throw new DemoSeedConfigError('Provide DEMO_ADMIN_PASSWORD with at least 16 characters and at most 72 UTF-8 bytes, without line breaks.');
  }
  return { uri: target.href, password };
}

/** Create only a synthetic administrator; existing users and passwords are immutable here. */
export async function seedDemoAdmin(environment: NodeJS.ProcessEnv): Promise<{ created: boolean }> {
  const config = validateDemoSeedConfiguration(environment);
  const connection = mongoose.createConnection();
  try {
    // Do not follow replica-set advertisements to hosts outside the chosen loopback target.
    await connection.openUri(config.uri, { serverSelectionTimeoutMS: 5_000, directConnection: true });
    const DemoUser = connection.model<IUser>('User', User.schema);
    await DemoUser.init();
    const existing = await DemoUser.findOne({ email: demoAdminEmail }).select('role');
    if (existing) {
      if (existing.role !== 'admin') throw new Error('Reserved demo identity already exists with a different role; no changes made.');
      return { created: false };
    }
    try {
      // Use create/save so the existing bcrypt password hook runs.
      await DemoUser.create({
        fullName: 'Demo Administrator (Synthetic)', email: demoAdminEmail,
        password: config.password, role: 'admin', accountStatus: 'active',
      });
      return { created: true };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const concurrent = await DemoUser.findOne({ email: demoAdminEmail }).select('role');
        if (concurrent?.role === 'admin') return { created: false };
      }
      throw error;
    }
  } finally {
    await connection.close();
  }
}
