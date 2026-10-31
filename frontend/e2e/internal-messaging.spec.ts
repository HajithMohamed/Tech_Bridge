import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const password = 'Synthetic-Test-Password-42!';
async function login(page: Page, email: string, destination: string) {
  await page.goto('/login'); await page.getByLabel('Email Address').fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: /^Sign in$/i }).click(); await expect(page).toHaveURL(destination);
}
test('permitted participants exchange live messages, review one complaint and withdraw contact', async ({ page, browser }) => {
  test.setTimeout(60_000);
  const providerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const adminContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  for (const context of [providerContext, adminContext]) await context.route('**/*', (route) => new URL(route.request().url()).origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient'));
  const provider = await providerContext.newPage(); const admin = await adminContext.newPage();
  try {
    await login(page, 'student@example.test', '/dashboard'); const token = await page.evaluate(() => localStorage.getItem('techbridge_token'));
    const conversation = await page.request.post('/api/messages/conversations', { headers: { Authorization: `Bearer ${token}` }, data: { recipientId: '000000000000000000000002' } }); expect(conversation.status()).toBe(201);
    await page.goto('/messages'); await page.getByRole('button', { name: /Synthetic Provider/ }).click();
    await login(provider, 'provider@example.test', '/provider'); await provider.goto('/messages'); await provider.getByRole('button', { name: /Synthetic Student/ }).click();
    await page.getByLabel('Message', { exact: true }).fill('Synthetic live question, kept private from reviewers.');
    await expect(provider.getByText('Your connection is typing…')).toBeVisible();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(provider.getByRole('region', { name: 'Conversation', exact: true }).getByText('Synthetic live question, kept private from reviewers.', { exact: true })).toBeVisible();
    await provider.getByLabel('Message', { exact: true }).fill('Synthetic provider reply selected for complaint review.'); await provider.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Conversation', exact: true }).getByText('Synthetic provider reply selected for complaint review.', { exact: true })).toBeVisible();
    await expect(provider.getByText('Read', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Report message', exact: true }).click(); await page.getByLabel('Report reason').fill('Synthetic complaint for the exact incoming message.'); await page.getByRole('button', { name: 'Submit message report' }).click(); await expect(page.getByRole('status').filter({ hasText: 'Report submitted.' })).toBeVisible();
    await login(admin, 'admin@example.test', '/admin'); await admin.getByRole('button', { name: /^reports$/i }).click();
    await admin.getByLabel('Reason for accessing complaint evidence').fill('Reviewing the exact reported content for an independent complaint decision.'); await admin.getByRole('button', { name: 'Record access and view reported message' }).click();
    await expect(admin.locator('blockquote')).toContainText('Synthetic provider reply selected for complaint review.'); await expect(admin.getByText('Synthetic live question, kept private from reviewers.', { exact: true })).toHaveCount(0);
    await admin.getByLabel('Message complaint resolution note').fill('Synthetic complaint independently reviewed; no broader conversation accessed.'); await admin.getByRole('button', { name: 'Resolve message complaint' }).click(); await expect(admin.getByLabel('Reason for accessing complaint evidence')).toHaveCount(0);
    await page.getByRole('button', { name: 'Block member', exact: true }).click(); await expect(page.getByLabel('Message', { exact: true })).toBeDisabled();
    await provider.getByLabel('Message', { exact: true }).fill('This reply should be blocked.'); await provider.getByRole('button', { name: 'Send', exact: true }).click(); await expect(provider.getByRole('alert')).toHaveText('Unable to send message.');
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '../output/playwright/internal-messaging-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Unblock member', exact: true }).click(); await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
    // The settings refresh may enable the composer before unblock's own reload finishes.
    // Wait for the complete action before editing consent, which is saved separately.
    await expect(page.getByRole('button', { name: 'Block member', exact: true })).toBeEnabled();
    await page.getByText('Communication preferences', { exact: true }).click(); await page.getByLabel('Accept messages from permitted connections').uncheck(); await page.getByLabel('Show in-app unread message notices').uncheck();
    const consentSaved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/messages/settings' && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save messaging preferences' }).click();
    const saved = await consentSaved; expect(saved.request().postDataJSON()).toEqual({ acceptsMessages: false, notifications: false }); expect(saved.status()).toBe(200);
    await expect(page.getByRole('status').filter({ hasText: 'Messaging preferences saved.' })).toBeVisible();
    await provider.getByRole('button', { name: 'Send', exact: true }).click(); await expect(provider.getByRole('alert')).toHaveText('Unable to send message.');
    // Restore fixture preference to keep later browser cases independent.
    await page.getByLabel('Accept messages from permitted connections').check(); await page.getByLabel('Show in-app unread message notices').check(); await page.getByRole('button', { name: 'Save messaging preferences' }).click();
    await provider.setViewportSize({ width: 1440, height: 1000 }); await provider.screenshot({ path: '../output/playwright/internal-messaging-desktop.png', fullPage: true });
  } finally { await providerContext.close(); await adminContext.close(); }
});
