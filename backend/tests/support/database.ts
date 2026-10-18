import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';

export const mongoBinary = {
  version: '7.0.24',
  downloadDir: resolve(__dirname, '../../.cache/mongodb-binaries'),
};

/** Never echo a rejected URI: it might contain real credentials. */
export function assertTestDatabase(uri: string, environment = process.env.NODE_ENV): void {
  let parsed: URL;
  try { parsed = new URL(uri); } catch { throw new Error('Invalid disposable test database configuration.'); }
  if (environment !== 'test' || parsed.protocol !== 'mongodb:' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) ||
      parsed.username || parsed.password ||
      !/^\/techbridge_test_[a-f0-9]{32}$/.test(parsed.pathname)) {
    throw new Error('Refusing database access outside an isolated loopback test database.');
  }
}

export class TestDatabase {
  private replicaSet?: MongoMemoryReplSet;
  private uri?: string;

  async start(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') throw new Error('Test database requires NODE_ENV=test.');
    if (this.replicaSet || mongoose.connection.readyState !== 0) throw new Error('Test database must own a fresh connection.');
    // Only launch our own local server. Never accept MONGODB_URI from the environment.
    process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
    const dbName = `techbridge_test_${randomUUID().replace(/-/g, '')}`;
    try {
      this.replicaSet = await MongoMemoryReplSet.create({
        binary: mongoBinary,
        replSet: { count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
      });
      this.uri = this.replicaSet.getUri(dbName);
      assertTestDatabase(this.uri);
      await mongoose.connect(this.uri, { serverSelectionTimeoutMS: 10_000 });
      await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  private assertOwnership(): void {
    if (!this.uri || !this.replicaSet) throw new Error('No owned test database to clean.');
    assertTestDatabase(this.uri);
    if (`/${mongoose.connection.name}` !== new URL(this.uri).pathname ||
        !['127.0.0.1', 'localhost', '::1'].includes(mongoose.connection.host)) {
      throw new Error('Refusing cleanup of an unowned connection.');
    }
  }

  async clear(): Promise<void> {
    this.assertOwnership();
    await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  }

  async stop(): Promise<void> {
    if (this.uri && mongoose.connection.readyState !== 0) {
      this.assertOwnership();
      await mongoose.disconnect();
    }
    await this.replicaSet?.stop();
    this.replicaSet = undefined;
    this.uri = undefined;
  }
}
