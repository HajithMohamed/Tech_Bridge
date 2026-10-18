import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'synthetic-test-signing-key-never-for-deployment',
      MONGODB_URI: '',
      MONGOMS_RUNTIME_DOWNLOAD: 'false',
    },
    clearMocks: true,
    restoreMocks: true,
  },
});
