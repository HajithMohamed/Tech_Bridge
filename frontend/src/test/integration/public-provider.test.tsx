import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../../context/AuthContext';
import PublicProviderProfilePage from '../../pages/PublicProviderProfilePage';
import type { PublicProviderResponse } from '../../types';
import { apiUrl, server } from '../mocks/server';

const payload: PublicProviderResponse = {
  provider: {
    _id: 'synthetic-provider', fullName: 'Synthetic Provider', createdAt: '2026-01-01T00:00:00Z',
    providerProfile: { organizationName: 'Synthetic Organization', organizationType: 'ngo', verified: true,
      location: 'Test Campus', website: 'https://organization.example.test', description: 'Public organization description.',
      opportunityCategories: ['scholarships'], resourceAccessMethods: ['donation'] },
  }, opportunities: [], resources: [],
};

function renderProfile() {
  return render(<MemoryRouter initialEntries={['/providers/synthetic-provider']}><AuthProvider><Routes>
    <Route path="/providers/:id" element={<PublicProviderProfilePage />} />
  </Routes></AuthProvider></MemoryRouter>);
}

describe('public provider page with the restricted API contract', () => {
  it('renders organization details without contact fields or a signed-out message action', async () => {
    server.use(http.get(apiUrl('/providers/synthetic-provider'), () => HttpResponse.json({ success: true, data: payload })));
    renderProfile();
    expect(await screen.findByRole('heading', { name: 'Synthetic Organization' })).toBeVisible();
    expect(screen.getByText('Verified provider', { exact: false })).toBeVisible();
    expect(screen.getByText('Public organization description.')).toBeVisible();
    expect(screen.getByRole('link', { name: /Visit website/ })).toHaveAttribute('href', 'https://organization.example.test');
    expect(screen.queryByText(/^Contact:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Phone:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Message$/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('No items available at the moment.')).toHaveLength(2);
  });

  it('retains the student message action without requiring public contact details', async () => {
    localStorage.setItem('techbridge_token', 'synthetic-session-token');
    server.use(http.get(apiUrl('/providers/synthetic-provider'), () => HttpResponse.json({ success: true, data: payload })));
    renderProfile();
    expect(await screen.findByRole('button', { name: /^Message$/ })).toBeVisible();
  });

  it('shows a useful fallback for an unavailable provider', async () => {
    server.use(http.get(apiUrl('/providers/synthetic-provider'), () => HttpResponse.json({ success: false }, { status: 404 })));
    renderProfile();
    expect(await screen.findByText('This provider profile could not be found.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse opportunities' })).toHaveAttribute('href', '/opportunities');
  });
});
