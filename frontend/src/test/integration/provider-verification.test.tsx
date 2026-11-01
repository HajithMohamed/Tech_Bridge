import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import ProviderVerificationPage from '../../pages/ProviderVerificationPage';
import AdminVerificationPanel from '../../components/admin/AdminVerificationPanel';
import ProviderProfilePage from '../../pages/ProviderProfilePage';
import ProtectedRoute from '../../components/ProtectedRoute';
import { AuthProvider } from '../../context/AuthContext';
import * as verificationApi from '../../api/verificationApi';
import type { VerificationState } from '../../api/verificationApi';
import { providerFixture, testPassword } from '../fixtures';
import { apiUrl, server } from '../mocks/server';

const providerId = '000000000000000000000002'; const documentId = '000000000000000000000020'; const eventId = '000000000000000000000021';
const emptyHistory = { entries: [], page: 1, pages: 1, total: 0 };
const initialState = (): VerificationState => ({ provider: { _id: providerId, fullName: 'Synthetic Provider', organizationName: 'Synthetic Organization', status: 'PENDING' }, document: null, unread: 0 });
const evidence = () => new File(['synthetic fixture bytes'], 'evidence.png', { type: 'image/png' });
function mockPortal(state: () => VerificationState = initialState) {
  server.use(http.post(apiUrl('/provider-verification/session'), () => HttpResponse.json({ data: { token: 'restricted-synthetic-token' } })),
    http.get(apiUrl('/provider-verification/'), () => HttpResponse.json({ data: state() })),
    http.get(apiUrl('/provider-verification/history'), () => HttpResponse.json({ data: emptyHistory })));
}
async function enterPortal() {
  const user = userEvent.setup(); render(<MemoryRouter><ProviderVerificationPage /></MemoryRouter>);
  await user.type(screen.getByLabelText('Provider email'), 'provider@example.test'); await user.type(screen.getByLabelText('Verification password'), testPassword);
  await user.click(screen.getByRole('button', { name: 'Open verification status' })); await screen.findByText('Synthetic Organization'); return user;
}
describe('provider verification portal with its restricted API client', () => {
  it('uploads actual selected bytes with the restricted bearer and preserves the full platform session', async () => {
    localStorage.setItem('techbridge_token', 'existing-full-token'); let state = initialState(); let submitted: Record<string, unknown> | undefined; let header = '';
    mockPortal(() => state);
    server.use(http.post(apiUrl('/provider-verification/documents'), async ({ request }) => {
      header = request.headers.get('authorization') || ''; submitted = await request.json() as Record<string, unknown>;
      state = { ...state, document: { _id: documentId, fileName: 'evidence.png', contentType: 'image/png', size: 23, createdAt: '2026-01-01T00:00:00Z' } };
      return HttpResponse.json({ data: { documentId } }, { status: 201 });
    }));
    const user = await enterPortal(); await user.upload(screen.getByLabelText('Supporting document'), evidence()); await user.type(screen.getByLabelText('Submission note'), 'Organization affiliation evidence');
    // JSDOM cannot validate user-event's synthetic FileList. Real browser
    // validation is exercised by the complete Playwright upload journey.
    fireEvent.submit(screen.getByRole('button', { name: 'Submit evidence' }).closest('form')!); expect(await screen.findByText('Evidence submitted for administrator review.')).toBeVisible();
    expect(submitted).toEqual({ fileName: 'evidence.png', content: btoa('synthetic fixture bytes'), note: 'Organization affiliation evidence' }); expect(header).toBe('Bearer restricted-synthetic-token');
    expect(localStorage.getItem('techbridge_token')).toBe('existing-full-token'); expect(Object.values(localStorage)).not.toContain('restricted-synthetic-token');
  });
  it('displays an information request and marks its owned notice as read', async () => {
    let read = false; let called = '';
    const state = () => ({ ...initialState(), provider: { ...initialState().provider, status: 'NEEDS_INFO' as const, reason: 'Provide institution affiliation evidence' }, unread: read ? 0 : 1 }); mockPortal(state);
    server.use(http.get(apiUrl('/provider-verification/history'), () => HttpResponse.json({ data: { ...emptyHistory, total: 1, entries: [{ _id: eventId, action: 'more_info', fromStatus: 'PENDING', toStatus: 'NEEDS_INFO', reason: 'Provide institution affiliation evidence', actorId: { fullName: 'Synthetic Admin', role: 'admin' }, createdAt: '2026-01-01T00:00:00Z', readAt: read ? '2026-01-01T01:00:00Z' : null }] } })),
      http.patch(apiUrl(`/provider-verification/history/${eventId}/read`), ({ request }) => { called = request.headers.get('authorization') || ''; read = true; return HttpResponse.json({ success: true }); }));
    const user = await enterPortal(); expect(await screen.findByText('1 unread verification decisions')).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Mark decision as read' })); expect(await screen.findByText('0 unread verification decisions')).toBeVisible(); expect(called).toBe('Bearer restricted-synthetic-token');
    await waitFor(() => expect(screen.queryByText('New decision')).not.toBeInTheDocument());
  });
  it('rejects an oversized file before contacting the upload API', async () => {
    mockPortal(); let uploads = 0; server.use(http.post(apiUrl('/provider-verification/documents'), () => { uploads++; return HttpResponse.json({ success: true }); }));
    const user = await enterPortal(); await user.upload(screen.getByLabelText('Supporting document'), new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Submit evidence' }).closest('form')!); expect(await screen.findByRole('alert')).toHaveTextContent('2 MiB'); expect(uploads).toBe(0);
  });
  it('asks for verification sign-in again after revocation without clearing the platform session', async () => {
    mockPortal(); localStorage.setItem('techbridge_token', 'existing-full-token'); const user = await enterPortal();
    server.use(http.get(apiUrl('/provider-verification/'), () => HttpResponse.json({ message: 'Your session changed.' }, { status: 401 })));
    await user.click(screen.getByRole('button', { name: 'Refresh verification status' })); expect(await screen.findByRole('button', { name: 'Open verification status' })).toBeVisible(); expect(screen.getByRole('alert')).toHaveTextContent('Sign in again'); expect(localStorage.getItem('techbridge_token')).toBe('existing-full-token');
  });
  it('clears the full session and opens verification after an organization identity edit', async () => {
    const provider = providerFixture(); provider.providerProfile = { ...provider.providerProfile!, verified: true, verificationStatus: 'VERIFIED' }; localStorage.setItem('techbridge_token', 'synthetic-session-token'); let submitted: unknown;
    server.use(http.get(apiUrl('/auth/me'), () => HttpResponse.json({ data: { user: provider } })),
      http.put(apiUrl('/provider/profile'), async ({ request }) => { submitted = await request.json(); return HttpResponse.json({ data: { user: { ...provider, providerProfile: { ...provider.providerProfile, organizationName: 'Updated Organization', verified: false, verificationStatus: 'NEEDS_INFO' } } } }); }));
    const user = userEvent.setup(); render(<MemoryRouter initialEntries={['/provider/profile']}><AuthProvider><Routes><Route path="/provider/profile" element={<ProtectedRoute allowedRoles={['provider']}><ProviderProfilePage /></ProtectedRoute>} /><Route path="/provider-verification" element={<ProviderVerificationPage />} /></Routes></AuthProvider></MemoryRouter>);
    const input = await screen.findByLabelText('Organization name'); await user.clear(input); await user.type(input, 'Updated Organization'); await user.click(screen.getByRole('button', { name: 'Save profile and services' }));
    expect(await screen.findByRole('button', { name: 'Open verification status' })).toBeVisible(); expect(submitted).toMatchObject({ organizationName: 'Updated Organization' }); await waitFor(() => expect(localStorage.getItem('techbridge_token')).toBeNull()); expect(localStorage.getItem('techbridge_user')).toBeNull();
  });
});
describe('administrator verification review with real API requests', () => {
  it('gates approval on a download and bounded reason, and reports stale-document conflicts', async () => {
    const provider = providerFixture(); provider.providerProfile = { ...provider.providerProfile!, verificationDocumentId: documentId, verificationDocumentName: 'evidence.png' };
    const download = vi.spyOn(verificationApi, 'downloadVerificationDocument').mockResolvedValue(); let submitted: unknown;
    server.use(http.get(apiUrl('/admin/providers'), () => HttpResponse.json({ data: { providers: [provider], page: 1, pages: 1, total: 1 } })),
      http.get(apiUrl(`/admin/providers/${providerId}/history`), () => HttpResponse.json({ data: emptyHistory })),
      http.patch(apiUrl(`/admin/providers/${providerId}/verify`), async ({ request }) => { submitted = await request.json(); return HttpResponse.json({ message: 'The supporting document changed. Reload and review the current submission.' }, { status: 409 }); }));
    const user = userEvent.setup(); render(<AdminVerificationPanel />); await user.click(await screen.findByRole('button', { name: 'Review Synthetic Organization' }));
    await user.type(screen.getByLabelText('Decision reason'), 'Confirmed affiliation evidence'); expect(screen.getByRole('button', { name: 'Confirm verification decision' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Download current evidence' })); await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm verification decision' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Confirm verification decision' })); expect(await screen.findByRole('alert')).toHaveTextContent('supporting document changed');
    expect(download).toHaveBeenCalledWith(documentId, { providerId }); expect(submitted).toEqual({ reason: 'Confirmed affiliation evidence', documentId });
  });
  it.each(['reject', 'request-info'] as const)('submits a reasoned %s decision for filename-only legacy accounts', async (decision) => {
    let complete = false; let submitted: unknown; server.use(http.get(apiUrl('/admin/providers'), () => HttpResponse.json({ data: { providers: complete ? [] : [providerFixture()], page: 1, pages: 1, total: complete ? 0 : 1 } })),
      http.get(apiUrl(`/admin/providers/${providerId}/history`), () => HttpResponse.json({ data: emptyHistory })),
      http.patch(apiUrl(`/admin/providers/${providerId}/${decision}`), async ({ request }) => { submitted = await request.json(); complete = true; return HttpResponse.json({ success: true }); }));
    const user = userEvent.setup(); render(<AdminVerificationPanel />); await user.click(await screen.findByRole('button', { name: 'Review Synthetic Organization' }));
    await user.selectOptions(screen.getByLabelText('Verification decision'), decision); await user.type(screen.getByLabelText('Decision reason'), 'Provide organization registration evidence'); await user.click(screen.getByRole('button', { name: 'Confirm verification decision' }));
    expect(await screen.findByText('Verification decision recorded. A decision notice is available to the provider.')).toBeVisible(); expect(submitted).toEqual({ reason: 'Provide organization registration evidence', documentId: null });
    expect(await screen.findByText('No providers match this queue.')).toBeVisible();
  });
  it('applies queue status/search filters and server pagination', async () => {
    const queries: URLSearchParams[] = []; server.use(http.get(apiUrl('/admin/providers'), ({ request }) => { const query = new URL(request.url).searchParams; queries.push(query); return HttpResponse.json({ data: { providers: [providerFixture()], page: Number(query.get('page') || 1), pages: 2, total: 21 } }); }));
    const user = userEvent.setup(); render(<AdminVerificationPanel />); await screen.findByText('Synthetic Organization');
    await user.selectOptions(screen.getByLabelText('Verification status'), 'REJECTED'); await user.type(screen.getByLabelText('Search providers'), 'Synthetic'); await user.click(screen.getByRole('button', { name: /^Search providers$/ }));
    await waitFor(() => expect(queries.at(-1)?.get('q')).toBe('Synthetic')); await waitFor(() => expect(screen.getByRole('button', { name: 'Next provider page' })).toBeEnabled()); await user.click(screen.getByRole('button', { name: 'Next provider page' }));
    await waitFor(() => expect(queries.at(-1)?.get('page')).toBe('2')); expect(queries.at(-1)?.get('status')).toBe('REJECTED');
  });
});
