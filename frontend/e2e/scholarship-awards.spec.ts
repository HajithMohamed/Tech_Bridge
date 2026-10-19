import { test, expect } from './fixtures';

test('a provider makes a scholarship decision and sees it persist after reload', async ({ page }) => {
  async function login(email: string, destination: string) {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Synthetic-Test-Password-42!');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(destination);
  }
  await login('provider@example.test', '/provider');
  // Arrange independent content through the real API; leave the existing journey's scholarship untouched.
  const created = await page.evaluate(async () => {
    const response = await fetch('/api/opportunities', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('techbridge_token')}` },
      body: JSON.stringify({ title: 'Synthetic Capacity Scholarship', description: 'Synthetic scholarship for an isolated human review journey.',
        type: 'scholarship', requiredSkills: ['TypeScript'], location: 'Test Campus', workMode: 'remote', status: 'open',
        applicationDeadline: '2099-01-01T00:00:00Z', amount: 1000, currency: 'LKR', coverageType: 'partial',
        eligibilityCriteria: ['Enrolled student'], numberOfAwards: 1, renewable: false }),
    });
    const body = await response.json();
    return { status: response.status, id: body.data?.opportunity?._id };
  });
  expect(created.status).toBe(201);
  await page.getByRole('button', { name: /Sign out/i }).click();
  await login('student@example.test', '/dashboard');
  await page.goto(`/opportunities/${created.id}`);
  await page.locator('textarea').first().fill('This synthetic application exercises the real scholarship review and capacity checks.');
  await page.getByRole('button', { name: 'Apply / express interest' }).click();
  await expect(page.getByRole('button', { name: 'Applied', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /Sign out/i }).click();
  await login('provider@example.test', '/provider');
  await page.goto('/provider/applications');
  await page.getByRole('combobox').first().selectOption(created.id);
  await expect(page.getByRole('heading', { name: 'Synthetic Student' })).toBeVisible();
  await expect(page.getByRole('combobox').nth(1)).toHaveValue('applied');
  const decision = page.waitForResponse((response) => response.url().includes('/api/applications/') && response.url().endsWith('/status') && response.request().method() === 'PATCH');
  await page.getByRole('combobox').nth(1).selectOption('accepted');
  expect((await decision).status()).toBe(200);
  await expect(page.getByRole('combobox').nth(1)).toHaveValue('accepted');
  await page.reload();
  await page.getByRole('combobox').first().selectOption(created.id);
  await expect(page.getByRole('combobox').nth(1)).toHaveValue('accepted');
  await expect(page.getByRole('heading', { name: 'Synthetic Student' })).toBeVisible();
  await page.screenshot({ path: '../output/playwright/scholarship-award.png', fullPage: true });
});
