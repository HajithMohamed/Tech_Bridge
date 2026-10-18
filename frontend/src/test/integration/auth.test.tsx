import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../../context/AuthContext';
import { useAuth } from '../../hooks/useAuth';
import LoginPage from '../../pages/LoginPage';
import api from '../../api/axios';
import { providerRegistration, studentFixture, testPassword } from '../fixtures';
import { apiUrl, server } from '../mocks/server';

function SessionProbe() {
  const { user, isAuthenticated, isLoading, register, logout } = useAuth();
  return <><p>{isLoading ? 'Session loading' : isAuthenticated ? user?.email : 'Signed out'}</p>
    <button onClick={() => void register(providerRegistration()).catch(() => {})}>Register provider fixture</button>
    <button onClick={logout}>Log out fixture</button></>;
}
function renderSession(loginPage = false) {
  return render(<MemoryRouter initialEntries={['/login']}><AuthProvider><SessionProbe /><Routes>
    <Route path="/login" element={loginPage ? <LoginPage /> : null} />
    <Route path="/dashboard" element={<p>Dashboard destination</p>} />
  </Routes></AuthProvider></MemoryRouter>);
}

describe('auth provider + Axios + MSW integration', () => {
  it('blocks unmocked network traffic instead of contacting an external service', async () => {
    await expect(api.get('/unmocked-request')).rejects.toMatchObject({
      response: { status: 500, data: { message: 'Unmocked network traffic is forbidden in component tests.' } },
    });
  });
  it('submits the real login page and establishes a session', async () => {
    const user = userEvent.setup();
    let submitted: unknown;
    server.use(http.post(apiUrl('/auth/login'), async ({ request }) => {
      submitted = await request.json();
      return HttpResponse.json({ success: true, data: { user: studentFixture(), token: 'synthetic-session-token' } });
    }));
    renderSession(true);
    await screen.findByText('Signed out');
    await user.type(screen.getByLabelText('Email Address'), 'student@example.test');
    await user.type(screen.getByLabelText('Password'), testPassword);
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText('Dashboard destination')).toBeInTheDocument();
    expect(screen.getByText('student@example.test')).toBeInTheDocument();
    expect(submitted).toEqual({ email: 'student@example.test', password: testPassword });
    expect(localStorage.getItem('techbridge_token')).toBe('synthetic-session-token');
  });
  it('rehydrates a saved session using the bearer header on the real API client', async () => {
    localStorage.setItem('techbridge_token', 'synthetic-session-token');
    renderSession();
    expect(await screen.findByText('student@example.test')).toBeInTheDocument();
  });
  it('clears an invalid stored session after a 401 response', async () => {
    localStorage.setItem('techbridge_token', 'expired-synthetic-token');
    localStorage.setItem('techbridge_user', JSON.stringify(studentFixture()));
    renderSession();
    expect(await screen.findByText('Signed out')).toBeInTheDocument();
    expect(localStorage.getItem('techbridge_token')).toBeNull();
    expect(localStorage.getItem('techbridge_user')).toBeNull();
  });
  it('keeps a newly registered pending provider signed out', async () => {
    const user = userEvent.setup();
    renderSession();
    await screen.findByText('Signed out');
    await user.click(screen.getByRole('button', { name: 'Register provider fixture' }));
    await waitFor(() => expect(screen.getByText('Signed out')).toBeInTheDocument());
    expect(localStorage.getItem('techbridge_token')).toBeNull();
    expect(localStorage.getItem('techbridge_user')).toBeNull();
  });
  it('logs out and removes both persisted session keys', async () => {
    const user = userEvent.setup();
    localStorage.setItem('techbridge_token', 'synthetic-session-token');
    localStorage.setItem('techbridge_user', JSON.stringify(studentFixture()));
    renderSession();
    await screen.findByText('student@example.test');
    await user.click(screen.getByRole('button', { name: 'Log out fixture' }));
    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(localStorage.getItem('techbridge_token')).toBeNull();
    expect(localStorage.getItem('techbridge_user')).toBeNull();
  });
  it('rejects invalid credentials without persisting a session', async () => {
    server.use(http.post(apiUrl('/auth/login'), () => HttpResponse.json({ success: false, message: 'Invalid email or password' }, { status: 401 })));
    const user = userEvent.setup();
    renderSession(true);
    await screen.findByText('Signed out');
    await user.type(screen.getByLabelText('Email Address'), 'student@example.test');
    await user.type(screen.getByLabelText('Password'), 'wrong-synthetic-password');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(localStorage.getItem('techbridge_token')).toBeNull();
  });
});
