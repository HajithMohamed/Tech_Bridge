import { createApp } from '../src/app';
import User from '../src/models/User';
import Opportunity from '../src/models/Opportunity';
import Resource from '../src/models/Resource';
import ResourceRequest from '../src/models/ResourceRequest';
import { Types } from 'mongoose';
import { TestDatabase } from './support/database';
import { adminFixture, providerFixture, resourceFixture, resourceRequestFixture, scholarshipFixture, studentFixture } from './support/fixtures';

async function start() {
  if (process.env.NODE_ENV !== 'test' || !process.env.JWT_SECRET) throw new Error('E2E server requires explicit test configuration.');
  const database = new TestDatabase();
  await database.start();
  try {
    await User.create([studentFixture(), providerFixture(), adminFixture()]);
    await Opportunity.create(scholarshipFixture());
    await Resource.create(resourceFixture());
    const reservationResourceId = new Types.ObjectId('000000000000000000000013');
    await Resource.create(resourceFixture({ _id: reservationResourceId, itemName: 'Synthetic Reservation Equipment' }));
    await ResourceRequest.create(resourceRequestFixture({ _id: new Types.ObjectId('000000000000000000000014'), resourceId: reservationResourceId }));
    const server = createApp().listen(4510, '127.0.0.1', () => console.log('Isolated TechBridge E2E API ready.'));
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await database.stop();
    };
    process.once('SIGINT', () => void stop());
    process.once('SIGTERM', () => void stop());
    server.once('error', () => void database.stop().finally(() => { process.exitCode = 1; }));
  } catch (error) {
    await database.stop();
    throw error;
  }
}
void start().catch(() => { console.error('Isolated E2E API could not start.'); process.exitCode = 1; });
