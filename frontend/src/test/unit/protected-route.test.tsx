import type { ContextType } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProtectedRoute from '../../components/ProtectedRoute';
import { AuthContext } from '../../context/AuthContext';
import { studentFixture } from '../fixtures';

type AuthValue = NonNullable<ContextType<typeof AuthContext>>;
function renderRoute(overrides: Partial<AuthValue> = {}) {
  const value: AuthValue = {
    user: studentFixture(), token: 'synthetic-token', isAuthenticated: true, isLoading: false, error: null, fieldErrors: null,
    login: vi.fn(async () => studentFixture()), register: vi.fn(async () => {}), logout: vi.fn(), updateStoredUser: vi.fn(), clearError: vi.fn(), ...overrides,
  };
  return render(<AuthContext.Provider value={value}><MemoryRouter initialEntries={['/admin']}><Routes>
    <Route path="/" element={<p>Public landing</p>} />
    <Route path="/dashboard" element={<p>Student dashboard</p>} />
    <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><p>Admin content</p></ProtectedRoute>} />
  </Routes></MemoryRouter></AuthContext.Provider>);
}
describe('existing protected route behavior', () => {
  it('waits for session rehydration', () => {
    renderRoute({ isLoading: true });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });
  it('redirects signed-out visitors to the public entry', () => {
    renderRoute({ user: null, token: null, isAuthenticated: false });
    expect(screen.getByText('Public landing')).toBeInTheDocument();
  });
  it('denies a student an administrative screen', () => {
    renderRoute();
    expect(screen.getByText('Student dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });
  it('renders authorized administrator content', () => {
    renderRoute({ user: studentFixture({ role: 'admin' }) });
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });
});
