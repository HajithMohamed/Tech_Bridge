import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ networkIsolation: void }>({
  networkIsolation: [async ({ context }, use) => {
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:4173') await route.continue();
      else await route.abort('blockedbyclient');
    });
    await use();
  }, { auto: true }],
});
export { expect };
