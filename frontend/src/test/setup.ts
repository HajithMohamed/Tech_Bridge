import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';

// A callback rejects even asset requests, which MSW's built-in strategy can bypass.
beforeAll(() => server.listen({ onUnhandledFrame: () => { throw new Error('Unmocked network traffic is forbidden in component tests.'); } }));
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); server.resetHandlers(); localStorage.clear(); });
afterAll(() => server.close());
