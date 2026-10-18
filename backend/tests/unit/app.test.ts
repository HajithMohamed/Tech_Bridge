import { Server } from 'node:net';
import mongoose from 'mongoose';
import { expect, it, vi } from 'vitest';

it('imports and builds the API without connecting to a database or opening a listener', async () => {
  const connect = vi.spyOn(mongoose, 'connect').mockRejectedValue(new Error('Unexpected unit-test database connection.'));
  const listen = vi.spyOn(Server.prototype, 'listen').mockImplementation(() => { throw new Error('Unexpected unit-test listener.'); });
  const { createApp } = await import('../../src/app.js');
  expect(typeof createApp()).toBe('function');
  expect(connect).not.toHaveBeenCalled();
  expect(listen).not.toHaveBeenCalled();
  expect(mongoose.connection.readyState).toBe(0);
});
