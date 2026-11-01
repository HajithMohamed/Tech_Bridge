import { test, expect } from './fixtures';

test('a student edits private activity preferences and browses or disables the backend recommendation feed', async ({ page }) => {
  // Own user avoids sharing recommendation revisions, saves or throttles with
  // other journeys. This checks the backend contract, not the deferred feed UI.
  const email = 'personalized-student@example.test'; const password = 'Synthetic-Test-Password-42!';
  const registered = await page.request.post('/api/auth/register', { data: { fullName: 'Synthetic Creative Student', email, password, confirmPassword: password, role: 'student', studentProfile: { institution: 'Synthetic Campus', degree: 'BST', studyYear: 2, skills: ['photography'] } } });
  expect(registered.status()).toBe(201);
  await page.goto('/login'); await page.getByLabel('Email Address').fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: /^sign in$/i }).click(); await expect(page).toHaveURL('/dashboard');
  const token = await page.evaluate(() => localStorage.getItem('techbridge_token'));
  const headers = { Authorization: `Bearer ${token}` };
  const initial = await page.request.get('/api/opportunities/recommendation-preferences', { headers }); expect(initial.status()).toBe(200);
  const updated = await page.request.patch('/api/opportunities/recommendation-preferences', { headers, data: { revision: (await initial.json()).data.revision, extracurricularActivities: ['content writing', 'video editing', 'photography'] } });
  expect(updated.status()).toBe(200); const preferences = (await updated.json()).data; expect(preferences.extracurricularActivities).toEqual(['content writing', 'video editing', 'photography']);
  const feed = await page.request.get('/api/opportunities/recommendations?limit=2', { headers }); expect(feed.status()).toBe(200); expect(feed.headers()['cache-control']).toBe('no-store'); const result = (await feed.json()).data;
  expect(result).toMatchObject({ personalized: true, method: 'rules', version: 3, limit: 2 }); expect(result.opportunities.length).toBeGreaterThan(0);
  const id = result.opportunities[0]._id;
  expect((await page.request.put(`/api/opportunities/${id}/saved`, { headers, data: {} })).status()).toBe(200);
  const saved = await page.request.get('/api/opportunities/recommendations?view=saved', { headers }); expect((await saved.json()).data.opportunities.map((row: { _id: string }) => row._id)).toContain(id);
  const all = await page.request.get('/api/opportunities/recommendations?view=all', { headers }); expect((await all.json()).data).toMatchObject({ personalized: false, sort: 'newest' });
  const disabled = await page.request.patch('/api/opportunities/recommendation-preferences', { headers, data: { revision: preferences.revision, personalizationEnabled: false } }); expect(disabled.status()).toBe(200);
  const unranked = await page.request.get('/api/opportunities/recommendations', { headers }); expect((await unranked.json()).data.opportunities.every((row: { recommendation: unknown }) => row.recommendation === null)).toBe(true);
  expect((await page.request.get('/api/opportunities/recommendation-preferences')).status()).toBe(401);
});
