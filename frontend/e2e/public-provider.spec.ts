import { test, expect } from './fixtures';

test('anonymous visitors can browse a provider without receiving private contact or verification data', async ({ page }) => {
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/providers/000000000000000000000002'));
  await page.goto('/providers/000000000000000000000002');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(Object.keys(data.data.provider).sort()).toEqual(['_id', 'createdAt', 'fullName', 'providerProfile']);
  const profile = data.data.provider.providerProfile;
  for (const field of ['contactPerson', 'contactEmail', 'phone', 'verificationDocumentName', 'rejectionReason', 'verificationStatus']) {
    expect(profile).not.toHaveProperty(field);
  }
  await expect(page.getByRole('heading', { name: 'Synthetic Support Organization' })).toBeVisible();
  await expect(page.getByText('Verified provider', { exact: false })).toBeVisible();
  await expect(page.getByText(/^Contact:/)).toHaveCount(0);
  await expect(page.getByText(/^Phone:/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Synthetic Test Equipment/ })).toBeVisible();
  await page.screenshot({ path: '../output/playwright/public-provider.png', fullPage: true });
  await page.getByRole('link', { name: /Synthetic Scholarship/ }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic Scholarship' })).toBeVisible();
});
