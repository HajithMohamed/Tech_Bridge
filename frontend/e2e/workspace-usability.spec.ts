import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function login(page: Page, email: string, destination: string) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-Test-Password-42!');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(destination);
}

async function captureAtWidths(page: Page, name: string) {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `../output/playwright/usability-${name}-${width}.png`, fullPage: true });
  }
}

test('resource discovery identifies listings and their providers at desktop, tablet and phone widths', async ({ page }) => {
  await page.goto('/resources');
  const resource = page.getByRole('article', { name: 'Synthetic Test Equipment' });
  await expect(resource.getByRole('heading', { name: 'Synthetic Test Equipment' })).toBeVisible();
  await expect(resource.getByRole('link', { name: 'By Synthetic Support Organization' })).toHaveAttribute('href', '/providers/000000000000000000000002');
  await expect(resource.getByText('Verified provider')).toBeVisible();
  await captureAtWidths(page, 'resources');
  await resource.getByRole('link', { name: 'By Synthetic Support Organization' }).click();
  await expect(page).toHaveURL('/providers/000000000000000000000002');
});

test('a student can inspect an application and follow up through the permitted messaging API', async ({ page }) => {
  await login(page, 'student@example.test', '/dashboard');
  const token = await page.evaluate(() => localStorage.getItem('techbridge_token'));
  const application = await page.request.post('/api/applications', {
    headers: { Authorization: `Bearer ${token}` },
    data: { opportunityId: '000000000000000000000051', justification: 'Synthetic application for isolated follow-up navigation and messaging coverage.', selfDeclaredNeed: 'medium' },
  });
  expect(application.status()).toBe(201);
  await page.goto('/my-applications');
  const applicationCard = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Synthetic Follow-up Scholarship', exact: true }) });
  await expect(applicationCard.getByRole('link', { name: 'Message provider' })).toBeVisible();
  await captureAtWidths(page, 'applications');
  await applicationCard.getByRole('link', { name: 'View opportunity' }).click();
  await expect(page).toHaveURL('/opportunities/000000000000000000000051');
  await page.goto('/my-applications');
  await applicationCard.getByRole('link', { name: 'Message provider' }).click();
  await expect(page).toHaveURL('/messages');
  await expect(page.getByRole('region', { name: 'Conversation', exact: true })).toContainText('Synthetic Provider');
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
  await page.goto('/my-resource-requests');
  const request = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Synthetic Reservation Equipment', exact: true }) });
  await expect(request.getByRole('link', { name: 'View provider' })).toHaveAttribute('href', '/providers/000000000000000000000002');
  await expect(request.getByRole('link', { name: 'Message provider' })).toBeVisible();
  await captureAtWidths(page, 'requests');
});

test('a provider with no listings gets a useful first-listing state', async ({ page }) => {
  await login(page, 'new-provider@example.test', '/provider');
  await page.goto('/provider/applications');
  await expect(page.getByRole('heading', { name: 'No opportunities to review yet' })).toBeVisible();
  await expect(page.getByText('Loading applicants…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Create an opportunity' })).toHaveAttribute('href', '/provider/opportunities');
  await captureAtWidths(page, 'empty-provider');
  await page.getByRole('link', { name: 'Create an opportunity' }).click();
  await expect(page).toHaveURL('/provider/opportunities');
});
