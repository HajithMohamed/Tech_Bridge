import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import ResourceHubPage from '../../pages/ResourceHubPage';
import { AuthProvider } from '../../context/AuthContext';
import { useAuth } from '../../hooks/useAuth';
import type { ResourceListing } from '../../types';
import { studentFixture } from '../fixtures';
import { apiUrl, server } from '../mocks/server';

const resource: ResourceListing = {
  _id: '000000000000000000000011', itemName: 'Synthetic Electronics Kit', category: 'other',
  accessType: 'donation', condition: 'used_good', quantityAvailable: 2, status: 'available',
  listedBy: { _id: '000000000000000000000002', fullName: 'Synthetic Provider', role: 'provider', providerProfile: { organizationName: 'Synthetic Equipment Lab', organizationType: 'resource_provider', verified: true } },
  providerOrgVerified: true, itemDetails: { other: { description: 'Synthetic development equipment for isolated UI tests.' } },
  accessDetails: { donation: { itemAgeYears: 1, conditionNotes: 'Test fixture in working condition', pickupOrDeliveryMethod: 'Test campus pickup', claimDeadline: '2099-01-01' } },
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

function SessionResources() {
  const { isLoading } = useAuth();
  return isLoading ? <p>Restoring test session</p> : <ResourceHubPage />;
}
function mount(overrides: Partial<ResourceListing> = {}) {
  localStorage.setItem('techbridge_token', 'synthetic-session-token');
  server.use(http.get(apiUrl('/resources'), () => HttpResponse.json({ success: true, data: { resources: [{ ...resource, ...overrides }] } })));
  render(<MemoryRouter><AuthProvider><SessionResources /></AuthProvider></MemoryRouter>);
}

describe('resource discovery identities and request actions', () => {
  it('identifies the resource and verified provider before requesting', async () => {
    mount();
    const card = await screen.findByRole('article', { name: resource.itemName });
    expect(within(card).getByRole('heading', { name: resource.itemName })).toBeVisible();
    expect(within(card).getByRole('link', { name: 'By Synthetic Equipment Lab' })).toHaveAttribute('href', '/providers/000000000000000000000002');
    expect(within(card).getByText('Verified provider')).toBeVisible();
    expect(within(card).getByText(resource.itemDetails.other!.description)).toBeVisible();
    expect(within(card).getByRole('link', { name: 'Request this resource' })).toHaveAttribute('href', `/resources/${resource._id}/request`);
  });

  it('identifies student-shared equipment without a provider-profile link or verification claim', async () => {
    mount({ listedBy: { _id: '000000000000000000000099', fullName: 'Synthetic Student Owner', role: 'student' }, providerOrgVerified: false });
    const card = await screen.findByRole('article', { name: resource.itemName });
    expect(within(card).getByText('By Synthetic Student Owner')).toBeVisible();
    expect(within(card).getByText('Student shared')).toBeVisible();
    expect(within(card).queryByRole('link', { name: /^By / })).not.toBeInTheDocument();
    expect(within(card).queryByText('Verified provider')).not.toBeInTheDocument();
  });

  it.each([
    { label: 'own raw owner ID', overrides: { listedBy: studentFixture()._id } },
    { label: 'deleted owner', overrides: { listedBy: null } },
    { label: 'zero available units', overrides: { quantityAvailable: 0 } },
    { label: 'unavailable listing', overrides: { status: 'claimed' as const } },
  ])('does not offer a request for $label', async ({ overrides }) => {
    mount(overrides);
    const card = await screen.findByRole('article', { name: resource.itemName });
    expect(within(card).queryByRole('link', { name: 'Request this resource' })).not.toBeInTheDocument();
  });

  it('retries a failed catalogue request without claiming the catalogue is empty', async () => {
    const user = userEvent.setup();
    mount();
    server.use(http.get(apiUrl('/resources'), () => HttpResponse.json({ success: false }, { status: 503 })));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load resource listings right now.');
    await waitFor(() => expect(screen.queryByText('Loading resource listings...')).not.toBeInTheDocument());
    expect(screen.queryByText('No available resources match these filters.')).not.toBeInTheDocument();
    server.use(http.get(apiUrl('/resources'), () => HttpResponse.json({ success: true, data: { resources: [resource] } })));
    await user.click(screen.getByRole('button', { name: 'Retry resources' }));
    expect(await screen.findByRole('article', { name: resource.itemName })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
