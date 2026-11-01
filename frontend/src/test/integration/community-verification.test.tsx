import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import CommunityVerificationPage from '../../pages/CommunityVerificationPage';
import FacultyConnectionsPage from '../../pages/FacultyConnectionsPage';
import AdminCommunityPanel from '../../components/admin/AdminCommunityPanel';
import { AuthProvider } from '../../context/AuthContext';
import type { CommunityClaim } from '../../api/communityApi';
import * as verificationApi from '../../api/verificationApi';
import { apiUrl, server } from '../mocks/server';
import { studentFixture, testPassword } from '../fixtures';

const documentId = '000000000000000000000020'; const providerId = '000000000000000000000004';
const history = { entries: [], page: 1, pages: 1, total: 0 };
const makeClaim = (): CommunityClaim => ({ _id: '000000000000000000000030', providerId, directoryId: 'ict-chandana', documentId, institution: 'University of Ruhuna', justification: 'Synthetic identity and affiliation evidence for a local test.', status: 'PENDING', revision: 1, profile: { visibility: 'hidden', acceptsStudentMessages: false, expertise: [], availability: '', bio: '' }, updatedAt: '2026-01-01T12:00:00.000Z' });
function portal(getClaim: () => CommunityClaim | null = () => null) {
  server.use(http.post(apiUrl('/provider-verification/session'), () => HttpResponse.json({ data: { token: 'restricted-community-token' } })),
    http.get(apiUrl('/provider-verification/'), () => HttpResponse.json({ data: { provider: { _id: providerId, fullName: 'Synthetic Faculty', organizationName: 'Synthetic Faculty', status: 'PENDING' }, document: { _id: documentId, fileName: 'affiliation.png', size: 100 }, unread: 0 } })),
    http.get(apiUrl('/community/claim'), () => HttpResponse.json({ data: { claim: getClaim(), active: false, kind: 'faculty' } })),
    http.get(apiUrl('/community/claim/history'), () => HttpResponse.json({ data: history })));
}
async function signIn() {
  const user = userEvent.setup(); render(<MemoryRouter><CommunityVerificationPage /></MemoryRouter>);
  await user.type(screen.getByLabelText('Community account email'), 'faculty@example.test'); await user.type(screen.getByLabelText('Community password'), testPassword);
  await user.click(screen.getByRole('button', { name: 'Open community claim' })); await screen.findByRole('heading', { name: 'Your identity claim' });
  return user;
}
describe('owner identity claims and privacy with actual HTTP requests', () => {
  it('submits a stable directory ID/current evidence without modifying an unrelated full session', async () => {
    let claim: CommunityClaim | null = null; let payload: unknown;
    localStorage.setItem('techbridge_token', 'unrelated-admin-session'); portal(() => claim);
    server.use(http.post(apiUrl('/community/claim'), async ({ request }) => { payload = await request.json(); claim = makeClaim(); return HttpResponse.json({ data: { claim } }, { status: 201 }); }));
    const user = await signIn(); await user.selectOptions(screen.getByLabelText('Listed identity'), 'ict-chandana');
    await user.type(screen.getByLabelText('Identity and affiliation explanation'), 'Synthetic identity evidence independently checked by the institution.');
    await user.click(screen.getByRole('button', { name: 'Submit identity claim' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Identity claim submitted');
    expect(payload).toMatchObject({ directoryId: 'ict-chandana', documentId, institution: 'University of Ruhuna', revision: 0 });
    expect(localStorage.getItem('techbridge_token')).toBe('unrelated-admin-session');
    expect(screen.getByLabelText('Profile visibility')).toHaveValue('hidden'); expect(screen.getByLabelText('Allow student messages')).not.toBeChecked();
  });
  it('saves explicit visibility, expertise and student-message consent against the current revision', async () => {
    let claim = makeClaim(); let payload: unknown; portal(() => claim);
    server.use(http.put(apiUrl('/community/claim/profile'), async ({ request }) => { payload = await request.json(); claim = { ...claim, revision: 2 }; return HttpResponse.json({ data: { claim } }); }));
    const user = await signIn(); await user.selectOptions(screen.getByLabelText('Profile visibility'), 'members');
    await user.click(screen.getByLabelText('Allow student messages')); await user.type(screen.getByLabelText('Expertise topics (comma separated)'), 'React, TypeScript');
    await user.type(screen.getByLabelText('Availability preferences'), 'Weekday afternoons'); await user.click(screen.getByRole('button', { name: 'Save community preferences' }));
    expect(await screen.findByRole('status')).toHaveTextContent('preferences saved');
    expect(payload).toMatchObject({ revision: 1, profile: { visibility: 'members', acceptsStudentMessages: true, expertise: ['React', 'TypeScript'] } });
  });
  it('clears the restricted portal on session revocation while preserving the administrator session', async () => {
    let expired = false; portal(); localStorage.setItem('techbridge_token', 'admin-session');
    server.use(http.get(apiUrl('/community/claim'), () => expired ? HttpResponse.json({ message: 'Your session changed. Please sign in again.' }, { status: 401 }) : HttpResponse.json({ data: { claim: null, active: false, kind: 'faculty' } })));
    const user = await signIn(); expired = true; await user.click(screen.getByRole('button', { name: 'Refresh community claim' }));
    expect(await screen.findByRole('button', { name: 'Open community claim' })).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent('session changed or expired'); expect(localStorage.getItem('techbridge_token')).toBe('admin-session');
  });
});

describe('admin independent identity review', () => {
  it('requires download and both attestations before approving, with the exact revision and private reference', async () => {
    const claim = makeClaim(); claim.providerId = { _id: providerId, fullName: 'Synthetic Claimant', email: 'faculty@example.test', accountStatus: 'active' };
    let complete = false; let payload: unknown;
    vi.spyOn(verificationApi, 'downloadVerificationDocument').mockResolvedValue();
    server.use(http.get(apiUrl('/admin/community-claims'), () => HttpResponse.json({ data: { claims: complete ? [] : [claim], page: 1, pages: 1, total: complete ? 0 : 1 } })),
      http.get(apiUrl(`/admin/community-claims/${claim._id}/history`), () => HttpResponse.json({ data: history })),
      http.patch(apiUrl(`/admin/community-claims/${claim._id}/approve`), async ({ request }) => { payload = await request.json(); complete = true; return HttpResponse.json({ success: true }); }));
    const user = userEvent.setup(); render(<AdminCommunityPanel />);
    await user.click(await screen.findByRole('button', { name: /Review claim for Dr. H.M./ }));
    await user.type(screen.getByLabelText('Community decision reason'), 'Identity and affiliation checked independently.');
    await user.type(screen.getByLabelText('Independent check reference'), 'Synthetic institution confirmation reference.');
    await user.click(screen.getByLabelText('I independently confirmed this claimant owns the listed identity'));
    await user.click(screen.getByLabelText('I independently confirmed the university or alumni affiliation'));
    expect(screen.getByRole('button', { name: 'Confirm community decision' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Download claim evidence' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm community decision' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Confirm community decision' }));
    expect(await screen.findByRole('status')).toHaveTextContent('decision recorded');
    expect(payload).toMatchObject({ revision: 1, documentId, identityConfirmed: true, affiliationConfirmed: true, affiliationMethod: 'institution_confirmation' });
  });
  it('shows stale-review failures and keeps the decision available for a refreshed review', async () => {
    const claim = makeClaim(); server.use(http.get(apiUrl('/admin/community-claims'), () => HttpResponse.json({ data: { claims: [claim], page: 1, pages: 1, total: 1 } })),
      http.get(apiUrl(`/admin/community-claims/${claim._id}/history`), () => HttpResponse.json({ data: history })),
      http.patch(apiUrl(`/admin/community-claims/${claim._id}/reject`), () => HttpResponse.json({ message: 'The claim or evidence changed. Reload the current submission.' }, { status: 409 })));
    const user = userEvent.setup(); render(<AdminCommunityPanel />); await user.click(await screen.findByRole('button', { name: /Review claim for Dr. H.M./ }));
    await user.selectOptions(screen.getByLabelText('Community decision'), 'reject'); await user.type(screen.getByLabelText('Community decision reason'), 'Insufficient affiliation evidence.');
    await user.click(screen.getByRole('button', { name: 'Confirm community decision' })); expect(await screen.findByRole('alert')).toHaveTextContent('claim or evidence changed');
    expect(screen.getByRole('button', { name: 'Reload claims queue' })).toBeVisible();
  });
});

describe('public contacts remain separate from verified platform members', () => {
  it('keeps listed contacts available without falsely claiming signed-out membership', () => {
    render(<MemoryRouter><AuthProvider><FacultyConnectionsPage /></AuthProvider></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Listed directory contacts' })).toHaveTextContent('not proof of platform membership');
    expect(screen.queryByRole('button', { name: /^Message / })).not.toBeInTheDocument();
  });
  it('uses only server-approved member IDs for messages, preserves paused messaging and applies filters', async () => {
    localStorage.setItem('techbridge_token', 'student-session'); const queries: URLSearchParams[] = [];
    server.use(http.get(apiUrl('/auth/me'), () => HttpResponse.json({ data: { user: studentFixture() } })),
      http.get(apiUrl('/community/people'), ({ request }) => { queries.push(new URL(request.url).searchParams); return HttpResponse.json({ data: { people: [{ _id: providerId, directoryId: 'ict-chandana', fullName: 'Canonical claimed identity', category: 'academic', department: 'ICT', institution: 'University of Ruhuna', expertise: ['React'], bio: '', availability: '', acceptsStudentMessages: false }], page: 1, pages: 1, total: 1 } }); }));
    const user = userEvent.setup(); render(<MemoryRouter><AuthProvider><FacultyConnectionsPage /></AuthProvider></MemoryRouter>);
    const verified = screen.getByRole('region', { name: 'Verified TechBridge members' });
    expect(await within(verified).findByText('Canonical claimed identity')).toBeVisible();
    expect(within(verified).getByText('Student messaging is paused.')).toBeVisible(); expect(within(verified).queryByRole('button', { name: /^Message / })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ET' })); await waitFor(() => expect(queries.at(-1)?.get('department')).toBe('ET'));
  });
});
