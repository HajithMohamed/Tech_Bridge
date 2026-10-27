import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import ProviderApplicationsPage from '../../pages/ProviderApplicationsPage';
import ProviderResourceRequestsPage from '../../pages/ProviderResourceRequestsPage';
import * as applicationApi from '../../api/applicationApi';
import type { Opportunity, OpportunityApplication, ResourceRequest } from '../../types';
import { studentFixture } from '../fixtures';
import { apiUrl, server } from '../mocks/server';

const opportunity: Opportunity = {
  _id: '000000000000000000000011', providerId: '000000000000000000000002', title: 'Synthetic Internship',
  description: 'Synthetic opportunity for provider workspace tests.', type: 'internship', requiredSkills: ['React'],
  location: 'Test Campus', workMode: 'remote', status: 'open', views: 0,
  applicationDeadline: '2099-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const application: OpportunityApplication = {
  _id: '000000000000000000000012', studentId: studentFixture(), opportunityId: opportunity,
  status: 'applied', justification: 'Synthetic applicant need statement for an independent human decision.',
  selfDeclaredNeed: 'medium', appliedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const resourceRequest = (overrides: Partial<ResourceRequest> = {}): ResourceRequest => ({
  _id: '000000000000000000000013', studentId: studentFixture(), providerId: '000000000000000000000002',
  resourceId: {
    _id: '000000000000000000000014', itemName: 'Synthetic Laptop', category: 'other', accessType: 'donation',
    condition: 'used_good', quantityAvailable: 1, status: 'available', listedBy: '000000000000000000000002',
    providerOrgVerified: true, itemDetails: { other: { description: 'Synthetic device' } }, accessDetails: {},
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  requestedAccessType: 'donation', resourceCategory: 'other', status: 'pending',
  justification: 'Synthetic resource request for the provider follow-up journey.', selfDeclaredNeed: 'medium',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...overrides,
});

function MessageDestination() {
  const location = useLocation();
  return <p>Message recipient: {(location.state as { recipientId?: string } | null)?.recipientId}</p>;
}
function mount(page: React.ReactNode) {
  return render(<MemoryRouter><Routes><Route path="/" element={page} /><Route path="/messages" element={<MessageDestination />} /></Routes></MemoryRouter>);
}
function opportunities(items = [opportunity]) {
  server.use(http.get(apiUrl('/opportunities/mine'), () => HttpResponse.json({ data: { opportunities: items } })));
}

describe('provider application workspace', () => {
  it('finishes loading for a new provider and links to their first opportunity', async () => {
    opportunities([]); mount(<ProviderApplicationsPage />);
    expect(await screen.findByRole('heading', { name: 'No opportunities to review yet' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Create an opportunity' })).toHaveAttribute('href', '/provider/opportunities');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers a retry after the opportunity list fails instead of remaining in a loading state', async () => {
    let failed = true;
    server.use(http.get(apiUrl('/opportunities/mine'), () => failed
      ? HttpResponse.json({ message: 'Synthetic outage' }, { status: 503 })
      : HttpResponse.json({ data: { opportunities: [] } })));
    const user = userEvent.setup(); mount(<ProviderApplicationsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your opportunities.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    failed = false; await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'No opportunities to review yet' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('distinguishes a failed applicant request from an empty applicant list', async () => {
    opportunities(); server.use(http.get(apiUrl(`/applications/opportunity/${opportunity._id}`), () => HttpResponse.json({}, { status: 503 })));
    mount(<ProviderApplicationsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load applicants.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('No applications for this opportunity.')).not.toBeInTheDocument();
  });

  it('ignores a late applicant response after selecting another opportunity', async () => {
    const secondOpportunity = { ...opportunity, _id: '000000000000000000000015', title: 'Another Internship' };
    const current = { ...application, _id: '000000000000000000000016', opportunityId: secondOpportunity, studentId: studentFixture({ fullName: 'Current Applicant' }) };
    let release!: (items: OpportunityApplication[]) => void;
    const oldResponse = new Promise<OpportunityApplication[]>((resolve) => { release = resolve; });
    const fetchApplicants = vi.spyOn(applicationApi, 'getOpportunityApplicants').mockImplementation((id) => id === opportunity._id ? oldResponse : Promise.resolve([current]));
    opportunities([opportunity, secondOpportunity]); const user = userEvent.setup(); mount(<ProviderApplicationsPage />);
    await waitFor(() => expect(fetchApplicants).toHaveBeenCalledWith(opportunity._id));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Opportunity to review' }), secondOpportunity._id);
    await screen.findByRole('heading', { name: 'Current Applicant' });
    await act(async () => { release([application]); await oldResponse; });
    expect(screen.getByRole('heading', { name: 'Current Applicant' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Synthetic Student' })).not.toBeInTheDocument();
  });

  it('omits messaging for malformed recipient IDs in both review tabs', async () => {
    opportunities();
    server.use(
      http.get(apiUrl(`/applications/opportunity/${opportunity._id}`), () => HttpResponse.json({ data: { applications: [{ ...application, studentId: 'invalid-id' }] } })),
      http.get(apiUrl('/resource-requests/provider'), () => HttpResponse.json({ data: { requests: [resourceRequest({ studentId: 'invalid-id' })] } })),
    );
    const user = userEvent.setup(); mount(<ProviderApplicationsPage />);
    await screen.findByRole('heading', { name: 'Student applicant' });
    expect(screen.queryByRole('button', { name: 'Message student' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resource requests' }));
    await screen.findByText('Synthetic resource request for the provider follow-up journey.');
    expect(screen.queryByRole('button', { name: 'Message student' })).not.toBeInTheDocument();
  });

  it('retains the applicant identity and message destination after a status response returns raw IDs', async () => {
    opportunities();
    server.use(
      http.get(apiUrl(`/applications/opportunity/${opportunity._id}`), () => HttpResponse.json({ data: { applications: [application] } })),
      http.patch(apiUrl(`/applications/${application._id}/status`), () => HttpResponse.json({ data: { application: { ...application, studentId: studentFixture()._id, opportunityId: opportunity._id, status: 'accepted' } } })),
    );
    const user = userEvent.setup(); mount(<ProviderApplicationsPage />);
    await screen.findByRole('heading', { name: 'Synthetic Student' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Application status for Synthetic Student' }), 'accepted');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Application status for Synthetic Student' })).toHaveValue('accepted'));
    expect(screen.getByText(/student@example.test/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Message student' }));
    expect(await screen.findByText(`Message recipient: ${studentFixture()._id}`)).toBeVisible();
  });
});

describe('provider resource follow-up', () => {
  it('opens messaging for an eligible request whose student is a raw ID', async () => {
    server.use(http.get(apiUrl('/resource-requests/provider'), () => HttpResponse.json({ data: { requests: [resourceRequest({ studentId: studentFixture()._id })] } })));
    const user = userEvent.setup(); mount(<ProviderResourceRequestsPage />);
    await user.click(await screen.findByRole('button', { name: 'Message student' }));
    expect(await screen.findByText(`Message recipient: ${studentFixture()._id}`)).toBeVisible();
  });

  it('omits messaging for rejected requests and missing or malformed student IDs', async () => {
    const fixtures = [resourceRequest({ status: 'rejected' }), resourceRequest({ _id: 'missing-student', studentId: null }), resourceRequest({ _id: 'malformed-student', studentId: 'invalid-id' })];
    server.use(http.get(apiUrl('/resource-requests/provider'), () => HttpResponse.json({ data: { requests: fixtures } })));
    const user = userEvent.setup(); mount(<ProviderResourceRequestsPage />);
    await user.click(screen.getByRole('button', { name: /^All$/ }));
    await screen.findAllByRole('heading', { name: 'Synthetic Laptop' });
    expect(screen.getAllByRole('article')).toHaveLength(3);
    for (const row of screen.getAllByRole('article')) expect(within(row).queryByRole('button', { name: 'Message student' })).not.toBeInTheDocument();
  });

  it('retries a failed resource queue without presenting the failure as an empty queue', async () => {
    let failed = true;
    server.use(http.get(apiUrl('/resource-requests/provider'), () => failed ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json({ data: { requests: [] } })));
    const user = userEvent.setup(); mount(<ProviderResourceRequestsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load resource requests.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('No matching requests.')).not.toBeInTheDocument();
    failed = false; await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No matching requests.')).toBeVisible();
  });
});
