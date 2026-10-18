import { test, expect } from './fixtures';

const syntheticPassword = 'Synthetic-Test-Password-42!';
test('student signs in, retains the session, and submits a real scholarship application', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill('student@example.test');
  await page.getByLabel('Password', { exact: true }).fill(syntheticPassword);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome back, Synthetic' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back, Synthetic' })).toBeVisible();
  await page.goto('/opportunities/000000000000000000000010');
  await expect(page.getByRole('heading', { name: 'Synthetic Scholarship' })).toBeVisible();
  await page.locator('textarea').first().fill('This synthetic application exercises the real API and disposable database end to end.');
  await page.getByRole('button', { name: 'Apply / express interest' }).click();
  await expect(page.getByRole('button', { name: 'Applied', exact: true })).toBeDisabled();
  await page.goto('/my-applications');
  await expect(page.getByText('Synthetic Scholarship')).toBeVisible();
  await page.screenshot({ path: '../output/playwright/student-application.png', fullPage: true });
});

test('signed-out visitors cannot load the administrator page', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Admin control center' })).toHaveCount(0);
});

test('invalid credentials keep the browser signed out through the real API', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill('student@example.test');
  await page.getByLabel('Password', { exact: true }).fill('incorrect-synthetic-password');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('techbridge_token'))).toBeNull();
});
