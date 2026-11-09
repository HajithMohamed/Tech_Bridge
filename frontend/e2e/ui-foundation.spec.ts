import { test, expect } from './fixtures';

test('public navigation fits mobile/tablet/desktop and the native menu traps and restores focus', async ({ page }) => {
  await page.goto('/opportunities');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(page.locator('.tb-header')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `../output/playwright/foundation-public-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 960 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const dialog = page.getByRole('dialog', { name: 'Navigation', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute('href', '/login');
  await expect(dialog.getByRole('link', { name: 'Get started', exact: true })).toHaveAttribute('href', '/register');
  await expect(dialog.getByRole('link', { name: 'Opportunities', exact: true })).toHaveAttribute('aria-current', 'page');
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await dialog.getByRole('link', { name: 'Resources', exact: true }).click();
  await expect(page).toHaveURL('/resources'); await expect(dialog).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.getByRole('button', { name: 'Open navigation' }).evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
  // Fixed navigation must not obscure a keyboard-focused footer link.
  const footerLinks = page.locator('footer a');
  for (let index = 0; index < await footerLinks.count(); index++) {
    const link = footerLinks.nth(index);
    await link.focus();
    await expect.poll(() => link.evaluate(node => {
      const box = node.getBoundingClientRect();
      const header = document.querySelector('.tb-header')!.getBoundingClientRect();
      const bottom = document.querySelector('.tb-bottom-navigation')!.getBoundingClientRect();
      return box.top >= header.bottom && box.bottom <= bottom.top;
    })).toBe(true);
  }
});

test('student uses the real session, one shared header, skip link and mobile profile destination', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill('student@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-Test-Password-42!');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL('/dashboard');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back, Synthetic' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
  await expect(nav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#workspace-content')).toBeFocused();
  await page.goto('/my-activity'); await expect(page.locator('.tb-header')).toHaveCount(1);
  await page.goto('/resources/list'); await expect(page.locator('.tb-header')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 960 });
  await page.getByRole('navigation', { name: 'Quick navigation' }).getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page).toHaveURL('/student-profile');
  await page.screenshot({ path: '../output/playwright/foundation-student-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog', { name: 'Navigation', exact: true }).getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(() => localStorage.getItem('techbridge_token'))).toBeNull();
});

test('provider and admin retain their authorized workspaces and a single shared header', async ({ page }) => {
  for (const [email, home, profile] of [['provider@example.test', '/provider', '/provider/profile'], ['admin@example.test', '/admin', '/admin']] as const) {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Synthetic-Test-Password-42!');
    await page.getByRole('button', { name: /^sign in$/i }).click(); await expect(page).toHaveURL(home);
    await expect(page.locator('.tb-header')).toHaveCount(1);
    const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
    await expect(nav.getByRole('link', { name: 'Creator profile', exact: true })).toHaveCount(0);
    if (home === '/provider') await nav.getByRole('link', { name: 'Profile', exact: true }).click();
    await expect(page).toHaveURL(profile); await expect(page.locator('.tb-header')).toHaveCount(1);
    await page.screenshot({ path: `../output/playwright/foundation-${home.slice(1)}-desktop.png`, fullPage: true });
    await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page).toHaveURL('/');
  }
});
