import { test, expect } from './fixtures';

test('a provider approves once, retains the decision and completes without reserving again', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill('provider@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-Test-Password-42!');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL('/provider');
  await page.goto('/provider/resource-requests');
  await expect(page.getByRole('heading', { name: 'Synthetic Reservation Equipment' })).toBeVisible();
  const accepted = page.waitForResponse((response) => response.url().endsWith('/api/resource-requests/000000000000000000000014/status') && response.request().method() === 'PATCH');
  await page.getByRole('combobox').selectOption('accepted');
  expect((await accepted).status()).toBe(200);
  await page.getByRole('button', { name: 'Accepted', exact: true }).click();
  await expect(page.getByRole('combobox')).toHaveValue('accepted');
  await expect(page.getByRole('heading', { name: 'Synthetic Reservation Equipment' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Accepted', exact: true }).click();
  await expect(page.getByRole('combobox')).toHaveValue('accepted');
  const completed = page.waitForResponse((response) => response.url().endsWith('/api/resource-requests/000000000000000000000014/status') && response.request().method() === 'PATCH');
  await page.getByRole('combobox').selectOption('completed');
  expect((await completed).status()).toBe(200);
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.getByRole('combobox')).toHaveValue('completed');
  await expect(page.getByRole('heading', { name: 'Synthetic Reservation Equipment' })).toBeVisible();
  await page.screenshot({ path: '../output/playwright/resource-reservation.png', fullPage: true });
  // Observe the real public resource API through the browser's isolated origin.
  const resource = await page.evaluate(async () => {
    const response = await fetch('/api/resources/000000000000000000000013');
    return { status: response.status, data: await response.json() };
  });
  expect(resource.status).toBe(200);
  expect(resource.data.data.resource).toMatchObject({ quantityAvailable: 0, status: 'claimed' });
});
