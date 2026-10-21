import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const email = 'verification-e2e@example.test'; const password = 'Synthetic-Test-Password-42!';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aI9kAAAAASUVORK5CYII=', 'base64');

test('a provider submits evidence, responds to information/rejection, and receives verified portal access', async ({ page, context }) => {
  test.setTimeout(60_000); // Three review decisions, restricted reauthentication and a final full login.
  const registration = await page.request.post('/api/auth/register', { data: {
    fullName: 'Verification Test Provider', email, password, confirmPassword: password, role: 'provider',
    providerProfile: { organizationName: 'Verification Test Organization', organizationType: 'ngo', contactPerson: 'Synthetic Reviewer', contactEmail: email, phone: '+94110000000', location: 'Synthetic Campus', description: 'Synthetic organization evidence for the isolated browser verification workflow.', opportunityCategories: ['mentorship'] },
  } });
  expect(registration.status()).toBe(201);
  await page.goto('/login'); await page.getByLabel('Email Address').fill('admin@example.test'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: /^Sign In$/i }).click(); await expect(page).toHaveURL('/admin');
  const providerPage = await context.newPage(); await providerPage.goto('/provider-verification');
  async function openStatus(status: string) {
    await providerPage.getByLabel('Provider email').fill(email); await providerPage.getByLabel('Verification password').fill(password); await providerPage.getByRole('button', { name: 'Open verification status' }).click();
    await expect(providerPage.getByRole('region', { name: 'Organization verification status' }).getByText(status, { exact: true })).toBeVisible();
  }
  async function submitEvidence(name: string) {
    await providerPage.getByLabel('Supporting document', { exact: true }).setInputFiles({ name, mimeType: 'image/png', buffer: png });
    await providerPage.getByLabel('Submission note').fill(`Synthetic supporting evidence ${name}`); await providerPage.getByRole('button', { name: 'Submit evidence', exact: true }).click(); await expect(providerPage.getByText('Evidence submitted for administrator review.')).toBeVisible();
  }
  async function openReview() {
    await page.getByRole('button', { name: 'Refresh verification queue' }).click(); await page.getByRole('button', { name: 'Review Verification Test Organization', exact: true }).click();
  }
  async function downloadEvidence(browserPage: Page) {
    const download = browserPage.waitForEvent('download'); await browserPage.getByRole('button', { name: 'Download current evidence', exact: true }).click(); expect((await download).suggestedFilename()).toMatch(/^verification-[a-f0-9]+\.png$/);
  }
  async function readDecision(status: string) {
    await providerPage.getByRole('button', { name: 'Refresh verification status' }).click(); await expect(providerPage.getByRole('button', { name: 'Open verification status' })).toBeVisible(); await openStatus(status);
    await expect(providerPage.getByText('1 unread verification decisions')).toBeVisible(); await providerPage.getByRole('button', { name: 'Mark decision as read', exact: true }).click(); await expect(providerPage.getByText('0 unread verification decisions')).toBeVisible();
  }
  await openStatus('Pending review'); await submitEvidence('initial-evidence.png');
  // The independent verification page keeps the administrator's full-session token intact.
  const me = await page.request.get('/api/auth/me', { headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('techbridge_token'))}` } }); expect((await me.json()).data.user.role).toBe('admin');
  await openReview(); await downloadEvidence(page); await page.getByLabel('Verification decision').selectOption('request-info'); await page.getByLabel('Decision reason').fill('Please add institution affiliation confirmation'); await page.getByRole('button', { name: 'Confirm verification decision' }).click();
  await expect(page.getByText('Verification decision recorded. A decision notice is available to the provider.')).toBeVisible();
  await readDecision('More information requested'); await submitEvidence('affiliation-correction.png');
  await openReview(); await page.getByLabel('Verification decision').selectOption('reject'); await page.getByLabel('Decision reason').fill('Affiliation document needs an authorized signature'); await page.getByRole('button', { name: 'Confirm verification decision' }).click();
  await expect(page.getByText('Verification decision recorded. A decision notice is available to the provider.')).toBeVisible();
  await readDecision('Rejected'); await submitEvidence('signed-affiliation.png');
  await openReview(); await page.getByLabel('Decision reason').fill('Organization identity and affiliation checked'); await expect(page.getByRole('button', { name: 'Confirm verification decision' })).toBeDisabled();
  await downloadEvidence(page); await expect(page.getByRole('button', { name: 'Confirm verification decision' })).toBeEnabled();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../output/playwright/provider-verification-admin.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirm verification decision' }).click(); await expect(page.getByText('Verification decision recorded. A decision notice is available to the provider.')).toBeVisible();
  await readDecision('Verified'); await expect(providerPage.getByRole('button', { name: 'Submit evidence', exact: true })).toHaveCount(0);
  await providerPage.evaluate(() => window.scrollTo(0, 0)); await providerPage.screenshot({ path: '../output/playwright/provider-verification-owner.png', fullPage: true });
  await providerPage.setViewportSize({ width: 390, height: 844 }); await providerPage.screenshot({ path: '../output/playwright/provider-verification-mobile.png' });
  await providerPage.getByRole('link', { name: 'Sign in to the provider portal' }).click(); await providerPage.getByLabel('Email Address').fill(email); await providerPage.getByLabel('Password', { exact: true }).fill(password); await providerPage.getByRole('button', { name: /^Sign In$/i }).click(); await expect(providerPage).toHaveURL('/provider');
  await providerPage.goto('/provider/profile'); await providerPage.getByLabel('Organization name', { exact: true }).fill('Updated Verification Test Organization');
  await providerPage.getByRole('button', { name: 'Save profile and services', exact: true }).click(); await expect(providerPage).toHaveURL('/provider-verification');
  await openStatus('More information requested'); await expect(providerPage.getByText('Latest update: Organization identity or contact details changed. Submit updated supporting evidence.')).toBeVisible();
  await providerPage.evaluate(() => window.scrollTo(0, 0)); await providerPage.screenshot({ path: '../output/playwright/provider-reverification.png', fullPage: true });
});
