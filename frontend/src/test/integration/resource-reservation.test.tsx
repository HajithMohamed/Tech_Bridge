import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import ProviderResourceRequestsPage from '../../pages/ProviderResourceRequestsPage';
import type { ResourceRequest } from '../../types';
import { studentFixture } from '../fixtures';
import { apiUrl, server } from '../mocks/server';

const fixture: ResourceRequest = {
  _id: 'synthetic-request', studentId: studentFixture(), providerId: 'synthetic-provider',
  resourceId: {
    _id: 'synthetic-resource', itemName: 'Synthetic Reservation Equipment', category: 'other',
    accessType: 'donation', condition: 'used_good', quantityAvailable: 1, status: 'available',
    listedBy: 'synthetic-provider', providerOrgVerified: true, itemDetails: { other: { description: 'Synthetic fixture' } }, accessDetails: {},
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  requestedAccessType: 'donation', resourceCategory: 'other',
  justification: 'Synthetic need statement for the resource approval journey.', selfDeclaredNeed: 'medium',
  status: 'pending', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

function renderRequests() {
  server.use(http.get(apiUrl('/resource-requests/provider'), () => HttpResponse.json({ success: true, data: { requests: [fixture] } })));
  render(<MemoryRouter><ProviderResourceRequestsPage /></MemoryRouter>);
}

describe('provider reservation decisions with the real API client', () => {
  it('keeps resource and applicant details when the status API returns raw IDs', async () => {
    const user = userEvent.setup();
    server.use(http.patch(apiUrl('/resource-requests/synthetic-request/status'), async ({ request }) => {
      const { status } = await request.json() as { status: string };
      return HttpResponse.json({ success: true, data: { request: { ...fixture, studentId: studentFixture()._id, resourceId: 'synthetic-resource', status } } });
    }));
    renderRequests();
    expect(await screen.findByRole('heading', { name: 'Synthetic Reservation Equipment' })).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox'), 'accepted');
    await user.click(screen.getByRole('button', { name: /^Accepted$/ }));
    expect(await screen.findByRole('combobox')).toHaveValue('accepted');
    expect(screen.getByRole('heading', { name: 'Synthetic Reservation Equipment' })).toBeVisible();
    expect(screen.getByText(/Synthetic Student/)).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox'), 'completed');
    await user.click(screen.getByRole('button', { name: /^Completed$/ }));
    expect(await screen.findByRole('combobox')).toHaveValue('completed');
    expect(screen.getByRole('heading', { name: 'Synthetic Reservation Equipment' })).toBeVisible();
    expect(screen.getByText(/Synthetic Student/)).toBeVisible();
  });

  it('keeps the pending request visible when stock approval conflicts', async () => {
    const user = userEvent.setup();
    server.use(http.patch(apiUrl('/resource-requests/synthetic-request/status'), () => HttpResponse.json({ success: false, message: 'No stock' }, { status: 409 })));
    renderRequests();
    expect(await screen.findByRole('heading', { name: 'Synthetic Reservation Equipment' })).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox'), 'accepted');
    expect(await screen.findByText('Unable to update this request.')).toBeVisible();
    expect(screen.getByRole('combobox')).toHaveValue('pending');
    expect(screen.getByRole('heading', { name: 'Synthetic Reservation Equipment' })).toBeVisible();
  });
});
