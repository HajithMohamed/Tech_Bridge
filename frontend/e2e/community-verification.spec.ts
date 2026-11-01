import { test, expect } from './fixtures';

const email = 'community-faculty-e2e@example.test'; const password = 'Synthetic-Test-Password-42!';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aI9kAAAAASUVORK5CYII=', 'base64');

test('a faculty claim receives independent review, opts into discovery and withdraws messaging consent', async ({ page, context }) => {
  test.setTimeout(60_000);
  const registration = await page.request.post('/api/auth/register', { data: {
    fullName: 'Synthetic Community Faculty', email, password, confirmPassword: password, role: 'provider',
    providerProfile: { organizationName: 'Synthetic Faculty Test Account', organizationType: 'faculty', contactPerson: 'Synthetic Faculty', contactEmail: email, phone: '+94110000000', location: 'Synthetic Campus', description: 'Synthetic faculty identity used only in a disposable browser test database.', opportunityCategories: ['mentorship'] },
  } }); expect(registration.status()).toBe(201);
  await page.goto('/login'); await page.getByLabel('Email Address').fill('admin@example.test'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: /^Sign in$/i }).click(); await expect(page).toHaveURL('/admin');
  const owner = await context.newPage(); await owner.goto('/community-verification');
  async function openClaim() {
    await owner.getByLabel('Community account email').fill(email); await owner.getByLabel('Community password').fill(password);
    await owner.getByRole('button', { name: 'Open community claim' }).click(); await expect(owner.getByRole('heading', { name: 'Your identity claim' })).toBeVisible();
  }
  async function openReview() {
    await page.getByRole('button', { name: 'Search claims', exact: true }).click();
    await page.getByRole('button', { name: /Review claim for Dr. H.M. Chandana/ }).click();
  }
  await openClaim(); await owner.getByLabel('Community supporting document').setInputFiles({ name: 'synthetic-affiliation.png', mimeType: 'image/png', buffer: png });
  await owner.getByRole('button', { name: 'Upload community evidence' }).click(); await expect(owner.getByRole('status')).toHaveText('Evidence uploaded. Submit or resubmit your claim with this document.');
  await owner.getByLabel('Listed identity').selectOption('ict-chandana'); await owner.getByLabel('Identity and affiliation explanation').fill('Synthetic ownership and university affiliation evidence for isolated browser testing only.');
  await owner.getByRole('button', { name: 'Submit identity claim' }).click(); await expect(owner.getByRole('status')).toHaveText('Identity claim submitted for independent administrator review.');
  await page.getByRole('button', { name: 'Community claims', exact: true }).click(); await openReview();
  await page.getByRole('combobox', { name: /^Community decision/ }).selectOption('request-info'); await page.getByLabel('Community decision reason').fill('Please explain how the supplied evidence establishes current affiliation.');
  await page.getByRole('button', { name: 'Confirm community decision' }).click(); await expect(page.getByRole('status')).toHaveText('Community verification decision recorded.');
  await owner.getByRole('button', { name: 'Refresh community claim' }).click(); await expect(owner.getByText('More information requested', { exact: true })).toBeVisible();
  await owner.getByLabel('Identity and affiliation explanation').fill('Synthetic additional institution confirmation supplied for independent identity review.');
  await owner.getByRole('button', { name: 'Submit identity claim' }).click(); await expect(owner.getByRole('status')).toHaveText('Identity claim submitted for independent administrator review.');
  await openReview(); await page.getByLabel('Community decision reason').fill('Synthetic identity ownership and affiliation independently confirmed.');
  await page.getByLabel('Independent check reference').fill('Synthetic institution confirmation from an independently located official contact.');
  await page.getByLabel('I independently confirmed this claimant owns the listed identity').check(); await page.getByLabel('I independently confirmed the university or alumni affiliation').check();
  await expect(page.getByRole('button', { name: 'Confirm community decision' })).toBeDisabled();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download claim evidence' }).click(); expect((await download).suggestedFilename()).toMatch(/^verification-[a-f0-9]+\.png$/);
  await expect(page.getByRole('button', { name: 'Confirm community decision' })).toBeEnabled();
  await page.screenshot({ path: '../output/playwright/community-review-admin.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirm community decision' }).click(); await expect(page.getByRole('status')).toHaveText('Community verification decision recorded.');
  await owner.getByRole('button', { name: 'Refresh community claim' }).click(); await expect(owner.getByRole('button', { name: 'Open community claim' })).toBeVisible(); await openClaim();
  await expect(owner.getByText('Approved', { exact: true })).toBeVisible(); await expect(owner.getByLabel('Profile visibility')).toHaveValue('hidden');
  await owner.getByLabel('Profile visibility').selectOption('members'); await owner.getByLabel('Allow student messages').check(); await owner.getByLabel('Expertise topics (comma separated)').fill('TypeScript, React');
  await owner.getByLabel('Availability preferences').fill('Weekday afternoons');
  const savedProfile = owner.waitForResponse((response) => response.url().endsWith('/api/community/claim/profile') && response.request().method() === 'PUT');
  await owner.getByRole('button', { name: 'Save community preferences' }).click(); expect((await savedProfile).status()).toBe(200);
  await expect(owner.getByRole('status')).toHaveText('Community preferences saved. Visibility and messaging also require a current approved claim.');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.goto('/login');
  await page.getByLabel('Email Address').fill('student@example.test'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: /^Sign in$/i }).click(); await expect(page).toHaveURL('/dashboard');
  await page.goto('/connections'); const verified = page.getByRole('region', { name: 'Verified TechBridge members' });
  await expect(verified.getByRole('button', { name: /Message Dr. H.M. Chandana/ })).toBeVisible();
  await page.screenshot({ path: '../output/playwright/community-members-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '../output/playwright/community-members-mobile.png' });
  await verified.getByRole('button', { name: /Message Dr. H.M. Chandana/ }).click(); await expect(page).toHaveURL('/messages');
  await page.getByPlaceholder(/Write a message/).fill('Synthetic student message to a consenting verified member.'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('section').getByText('Synthetic student message to a consenting verified member.', { exact: true })).toBeVisible();
  await owner.getByLabel('Allow student messages').uncheck();
  const withdrawn = owner.waitForResponse((response) => response.url().endsWith('/api/community/claim/profile') && response.request().method() === 'PUT');
  await owner.getByRole('button', { name: 'Save community preferences' }).click(); expect((await withdrawn).status()).toBe(200);
  await expect(owner.getByRole('status')).toHaveText('Community preferences saved. Visibility and messaging also require a current approved claim.');
  await page.getByPlaceholder(/Write a message/).fill('This message should be blocked after consent withdrawal.'); await page.getByRole('button', { name: 'Send', exact: true }).click(); await expect(page.getByText('Unable to send message.', { exact: true })).toBeVisible();
  await page.goto('/connections'); await expect(page.getByRole('region', { name: 'Verified TechBridge members' }).getByText('Student messaging is paused.', { exact: true })).toBeVisible();
  await owner.setViewportSize({ width: 390, height: 844 }); await owner.screenshot({ path: '../output/playwright/community-owner-mobile.png' });
});
