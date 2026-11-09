import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../../context/AuthContext';
import PortalLayout from '../../components/PortalLayout';
import ProtectedRoute from '../../components/ProtectedRoute';
import ProviderProfilePage from '../../pages/ProviderProfilePage';
import { providerFixture, studentFixture } from '../fixtures';
import { apiUrl, server } from '../mocks/server';
import type { User } from '../../types';

function renderWorkspace(actor: User, initial = '/dashboard') {
  localStorage.setItem('techbridge_token', 'synthetic-session-token');
  server.use(http.get(apiUrl('/auth/me'), ({ request }) => {
    expect(request.headers.get('authorization')).toBe('Bearer synthetic-session-token');
    return HttpResponse.json({ success: true, data: { user: actor } });
  }));
  render(<MemoryRouter initialEntries={[initial]}><AuthProvider><Routes>
    <Route path="/" element={<p>Public entry</p>} />
    <Route element={<PortalLayout />}>
      <Route path="/dashboard" element={<ProtectedRoute><main><h1>Student test workspace</h1></main></ProtectedRoute>} />
      <Route path="/provider" element={<ProtectedRoute allowedRoles={['provider']}><main><h1>Provider test workspace</h1></main></ProtectedRoute>} />
      <Route path="/provider/profile" element={<ProtectedRoute allowedRoles={['provider']}><ProviderProfilePage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><main><h1>Admin test workspace</h1></main></ProtectedRoute>} />
    </Route>
  </Routes></AuthProvider></MemoryRouter>);
}

describe('real session provider + navigation + API integration', () => {
  it('rehydrates a student session, exposes its routes and clears the session on logout', async () => {
    renderWorkspace(studentFixture());
    await screen.findByRole('heading', { name: 'Student test workspace' });
    const nav = within(screen.getByRole('navigation', { name: 'Workspace' }));
    expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/student-profile');
    expect(nav.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);
    expect(await screen.findByText('Public entry')).toBeInTheDocument();
    expect(localStorage.getItem('techbridge_token')).toBeNull();
  });
  it('preserves provider destinations and renders only one shared header on the profile page', async () => {
    const provider = providerFixture(); provider.providerProfile!.verified = true;
    renderWorkspace(provider, '/provider/profile');
    await screen.findByRole('heading', { name: 'Organization details and services' });
    const nav = within(screen.getByRole('navigation', { name: 'Workspace' }));
    expect(nav.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Applications' })).toHaveAttribute('href', '/provider/applications');
    expect(nav.queryByRole('link', { name: 'Creator profile' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
  });
  it('shows admin navigation after a real session rehydration without student actions', async () => {
    renderWorkspace(studentFixture({ role: 'admin' }), '/admin');
    await screen.findByRole('heading', { name: 'Admin test workspace' });
    const nav = within(screen.getByRole('navigation', { name: 'Workspace' }));
    expect(nav.getByRole('link', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
    expect(nav.queryByRole('link', { name: 'Share a resource' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#workspace-content');
  });
  it('denies an unauthorized administrative page through the existing guard', async () => {
    renderWorkspace(studentFixture(), '/admin');
    expect(await screen.findByRole('heading', { name: 'Student test workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Admin test workspace' })).not.toBeInTheDocument();
  });
});
