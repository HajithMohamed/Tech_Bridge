import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import MyApplicationsPage from '../../pages/MyApplicationsPage';
import MyResourceRequestsPage from '../../pages/MyResourceRequestsPage';
import type { OpportunityApplication, ResourceListing, ResourceRequest } from '../../types';
import { providerFixture, studentFixture } from '../fixtures';
import { apiUrl, server } from '../mocks/server';

const opportunityId = '000000000000000000000010';
const resourceId = '000000000000000000000011';
const providerId = '000000000000000000000002';
const provider = { ...providerFixture(), providerProfile: { ...providerFixture().providerProfile!, verified: true, verificationStatus: 'VERIFIED' as const } };
const application = (overrides: Partial<OpportunityApplication> = {}): OpportunityApplication => ({
  _id: '000000000000000000000020', studentId: studentFixture()._id, providerId,
  opportunityId: { _id: opportunityId, title: 'Synthetic engineering internship', type: 'internship', location: 'Test Campus', workMode: 'on-site', applicationDeadline: '2026-12-31T00:00:00Z', status: 'open', providerId },
  justification: 'Synthetic application for student workspace checks.', selfDeclaredNeed: 'medium', status: 'reviewed', appliedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...overrides,
});
const resource: ResourceListing = {
  _id: resourceId, itemName: 'Synthetic engineering kit', category: 'other', accessType: 'borrow', quantityAvailable: 1, status: 'available', listedBy: provider, providerOrgVerified: true,
  itemDetails: { other: { description: 'Synthetic equipment' } }, accessDetails: {}, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const resourceRequest = (overrides: Partial<ResourceRequest> = {}): ResourceRequest => ({
  _id: '000000000000000000000030', studentId: studentFixture(), providerId: provider, resourceId: resource, requestedAccessType: 'borrow', status: 'accepted', justification: 'Synthetic request for a student equipment project.', selfDeclaredNeed: 'medium', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...overrides,
});
function Destination() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output aria-label="Destination">{location.pathname}</output><output aria-label="Recipient">{(location.state as { recipientId?: string } | null)?.recipientId || ''}</output><button onClick={() => navigate(-1)}>Back to requests</button></>;
}
function renderWorkspace(path: '/my-applications' | '/my-resource-requests') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/my-applications" element={<MyApplicationsPage />} /><Route path="/my-resource-requests" element={<MyResourceRequestsPage />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter>);
}
function mockApplications(items: OpportunityApplication[]) {
  server.use(http.get(apiUrl('/applications/mine'), () => HttpResponse.json({ success: true, data: { applications: items } })));
}
function mockRequests(outgoing: ResourceRequest[], incoming: ResourceRequest[] = []) {
  server.use(http.get(apiUrl('/resource-requests/mine'), () => HttpResponse.json({ success: true, data: { requests: outgoing } })), http.get(apiUrl('/resource-requests/received'), () => HttpResponse.json({ success: true, data: { requests: incoming } })));
}

describe('student follow-up links with the real API client', () => {
  it('opens an applied opportunity and passes its provider identity to messaging', async () => {
    const user = userEvent.setup(); mockApplications([application()]); renderWorkspace('/my-applications');
    await user.click(await screen.findByRole('link', { name: 'View opportunity' }));
    expect(screen.getByLabelText('Destination')).toHaveTextContent(`/opportunities/${opportunityId}`);
    await user.click(screen.getByRole('button', { name: 'Back to requests' }));
    await user.click(await screen.findByRole('link', { name: 'Message provider' }));
    expect(screen.getByLabelText('Destination')).toHaveTextContent('/messages'); expect(screen.getByLabelText('Recipient')).toHaveTextContent(providerId);
  });

  it('retains raw opportunity IDs and suppresses rejected, deleted or malformed peers', async () => {
    const rejected = application({ _id: 'rejected', status: 'rejected' });
    const raw = application({ _id: 'raw', opportunityId, status: 'applied' });
    const missing = application({ _id: 'missing', opportunityId: null, providerId: null });
    const invalid = application({ _id: 'invalid', opportunityId: null, providerId: 'not-a-member-id' });
    mockApplications([rejected, raw, missing, invalid]); renderWorkspace('/my-applications');
    const rejectedRow = (await screen.findByRole('heading', { name: 'Synthetic engineering internship' })).closest('article')!;
    expect(within(rejectedRow).getByText('Rejected')).toBeVisible(); expect(within(rejectedRow).queryByRole('link', { name: 'Message provider' })).not.toBeInTheDocument();
    const rawRow = screen.getByRole('heading', { name: 'Opportunity application' }).closest('article')!;
    expect(within(rawRow).getByRole('link', { name: 'View opportunity' })).toHaveAttribute('href', `/opportunities/${opportunityId}`);
    expect(within(rawRow).getByRole('link', { name: 'Message provider' })).toBeVisible();
    for (const title of screen.getAllByRole('heading', { name: 'Opportunity no longer available' })) expect(within(title.closest('article')!).queryByRole('link')).not.toBeInTheDocument();
  });

  it('opens a resource provider and starts follow-up without returning to the request form', async () => {
    const user = userEvent.setup(); mockRequests([resourceRequest()]); renderWorkspace('/my-resource-requests');
    await user.click(await screen.findByRole('link', { name: 'View provider' }));
    expect(screen.getByLabelText('Destination')).toHaveTextContent(`/providers/${providerId}`);
    await user.click(screen.getByRole('button', { name: 'Back to requests' }));
    const row = (await screen.findByRole('heading', { name: 'Synthetic engineering kit' })).closest('article')!;
    expect(within(row).queryByRole('link', { name: 'View resource' })).not.toBeInTheDocument();
    expect(within(row).getAllByRole('link').every((link) => !link.getAttribute('href')?.endsWith('/request'))).toBe(true);
    await user.click(within(row).getByRole('link', { name: 'Message provider' }));
    expect(screen.getByLabelText('Destination')).toHaveTextContent('/messages'); expect(screen.getByLabelText('Recipient')).toHaveTextContent(providerId);
  });

  it('handles raw IDs and missing populated resource data while hiding unavailable follow-up', async () => {
    mockRequests([
      resourceRequest({ _id: 'rejected', status: 'rejected' }),
      resourceRequest({ _id: 'raw', resourceId, providerId }),
      resourceRequest({ _id: 'deleted', resourceId: null, providerId: null }),
      resourceRequest({ _id: 'student-owner', resourceId: null, providerId: studentFixture() }),
    ], [resourceRequest({ _id: 'deleted-received', resourceId: null, studentId: null })]);
    renderWorkspace('/my-resource-requests');
    const rejected = (await screen.findByRole('heading', { name: 'Synthetic engineering kit' })).closest('article')!;
    expect(within(rejected).getByText('Rejected')).toBeVisible(); expect(within(rejected).queryByRole('link', { name: 'Message provider' })).not.toBeInTheDocument();
    const raw = screen.getAllByRole('heading', { name: 'Resource listing' })[0].closest('article')!;
    expect(within(raw).getByRole('link', { name: 'View provider' })).toHaveAttribute('href', `/providers/${providerId}`); expect(within(raw).getByRole('link', { name: 'Message provider' })).toBeVisible();
    for (const heading of screen.getAllByRole('heading', { name: 'Resource no longer available' })) expect(within(heading.closest('article')!).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Requested by Student no longer available/)).toBeVisible();
  });

  it('uses the listing owner when a request response omits providerId', async () => {
    const user = userEvent.setup(); mockRequests([resourceRequest({ providerId: undefined })]); renderWorkspace('/my-resource-requests');
    await user.click(await screen.findByRole('link', { name: 'Message provider' }));
    expect(screen.getByLabelText('Recipient')).toHaveTextContent(providerId);
  });

  it('does not offer provider actions for a populated student owner without a role or provider profile', async () => {
    // The resource-request owner projection omits role and providerProfile for
    // students, even though the shared client type describes a complete User.
    const studentOwner = { _id: '000000000000000000000099', fullName: 'Synthetic Student Owner', email: 'student-owner@example.test' } as ResourceRequest['providerId'];
    mockRequests([resourceRequest({ providerId: studentOwner })]); renderWorkspace('/my-resource-requests');
    const row = (await screen.findByRole('heading', { name: 'Synthetic engineering kit' })).closest('article')!;
    expect(within(row).getByText(/Synthetic Student Owner/)).toBeVisible();
    expect(within(row).queryByRole('link', { name: 'View provider' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('link', { name: 'Message provider' })).not.toBeInTheDocument();
  });
});
