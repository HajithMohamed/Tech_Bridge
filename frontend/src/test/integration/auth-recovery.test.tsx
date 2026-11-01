import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../../context/AuthContext';
import { useAuth } from '../../hooks/useAuth';
import LoginPage from '../../pages/LoginPage';
import ForgotPasswordPage from '../../pages/ForgotPasswordPage';
import ResetPasswordPage from '../../pages/ResetPasswordPage';
import VerifyEmailPage from '../../pages/VerifyEmailPage';
import { apiUrl, server } from '../mocks/server';
import { providerRegistration, testPassword } from '../fixtures';

const privateToken = 'synthetic-private-link-token-12345678901234567890';
const genericNotice = 'If an eligible account exists, an email will arrive shortly.';
afterEach(() => window.history.replaceState({}, '', '/'));
function SessionProbe() {
  const { isAuthenticated, isLoading, register } = useAuth();
  return <><p>{isLoading ? 'Restoring session' : isAuthenticated ? 'Signed in' : 'Signed out'}</p><button onClick={() => void register(providerRegistration())}>Register fixture</button></>;
}
function mount(path: string) {
  window.history.replaceState({}, '', path);
  render(<StrictMode><MemoryRouter initialEntries={[path]}><AuthProvider><SessionProbe /><Routes>
    <Route path="/login" element={<LoginPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/verify-email" element={<VerifyEmailPage />} />
  </Routes></AuthProvider></MemoryRouter></StrictMode>);
}

describe('account recovery and verification with the real API client', () => {
  it('connects the sign-in recovery link to a generic email request', async () => {
    let submitted: unknown;
    server.use(http.post(apiUrl('/auth/forgot-password'), async ({ request }) => { submitted = await request.json(); return HttpResponse.json({ success: true, message: genericNotice }); }));
    const user = userEvent.setup(); mount('/login');
    await user.click(screen.getByRole('link', { name: 'Forgot Password?' }));
    await user.type(screen.getByLabelText('Email address'), 'someone@example.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent(genericNotice); expect(submitted).toEqual({ email: 'someone@example.test' });
    expect(localStorage.getItem('techbridge_token')).toBeNull();
  });

  it('keeps a registration response without identity or JWT signed out', async () => {
    server.use(http.post(apiUrl('/auth/register'), () => HttpResponse.json({ success: true, message: genericNotice }, { status: 202 })));
    const user = userEvent.setup(); mount('/login'); await screen.findByText('Signed out');
    await user.click(screen.getByRole('button', { name: 'Register fixture' }));
    await waitFor(() => expect(screen.getByText('Signed out')).toBeVisible());
    expect(localStorage.getItem('techbridge_token')).toBeNull(); expect(localStorage.getItem('techbridge_user')).toBeNull();
  });

  it('removes reset tokens from the address, validates confirmation, then clears the prior session', async () => {
    let submitted: unknown; let requestUrl = ''; let requests = 0;
    server.use(http.post(apiUrl('/auth/reset-password'), async ({ request }) => { requests++; requestUrl = request.url; submitted = await request.json(); return HttpResponse.json({ success: true, message: 'Password updated.' }); }));
    localStorage.setItem('techbridge_token', 'synthetic-session-token');
    const user = userEvent.setup(); mount(`/reset-password#token=${privateToken}`);
    await screen.findByText('Signed in'); expect(window.location.hash).toBe(''); expect(window.location.href).not.toContain(privateToken);
    await user.type(screen.getByLabelText('New password'), testPassword);
    await user.type(screen.getByLabelText('Confirm new password'), 'Different-Password-42!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.'); expect(requests).toBe(0);
    await user.clear(screen.getByLabelText('Confirm new password')); await user.type(screen.getByLabelText('Confirm new password'), testPassword);
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been updated.'); expect(submitted).toEqual({ token: privateToken, password: testPassword, confirmPassword: testPassword });
    expect(requestUrl).toBe(apiUrl('/auth/reset-password')); expect(localStorage.getItem('techbridge_token')).toBeNull(); expect(localStorage.getItem('techbridge_user')).toBeNull();
    expect(screen.getByText('Signed out')).toBeVisible();
  });

  it('does not accept reset tokens from query strings', async () => {
    mount(`/reset-password?token=${privateToken}`);
    expect(screen.getByRole('alert')).toHaveTextContent('This reset link is missing or invalid.');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('lets expired reset links request another email without signing in', async () => {
    server.use(http.post(apiUrl('/auth/reset-password'), () => HttpResponse.json({ success: false, message: 'This reset link is invalid or has expired.' }, { status: 400 })));
    const user = userEvent.setup(); mount(`/reset-password#token=${privateToken}`);
    await user.type(screen.getByLabelText('New password'), testPassword); await user.type(screen.getByLabelText('Confirm new password'), testPassword);
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.');
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute('href', '/forgot-password'); expect(localStorage.getItem('techbridge_token')).toBeNull();
  });

  it('verifies a fragment token once after an explicit action under Strict Mode', async () => {
    let calls = 0; let submitted: unknown; let requestUrl = '';
    server.use(http.post(apiUrl('/auth/verify-email'), async ({ request }) => { calls++; requestUrl = request.url; submitted = await request.json(); return HttpResponse.json({ success: true, message: 'Email verified.' }); }));
    const user = userEvent.setup(); mount(`/verify-email#token=${privateToken}`);
    expect(window.location.hash).toBe(''); expect(calls).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Verify email address' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your email has been verified.');
    expect(calls).toBe(1); expect(submitted).toEqual({ token: privateToken }); expect(requestUrl).toBe(apiUrl('/auth/verify-email')); expect(localStorage.getItem('techbridge_token')).toBeNull();
  });

  it('offers verification resend for an unverified login and keeps its response generic', async () => {
    let submitted: unknown;
    server.use(http.post(apiUrl('/auth/login'), () => HttpResponse.json({ success: false, code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Verify your email before signing in.' }, { status: 403 })), http.post(apiUrl('/auth/resend-verification'), async ({ request }) => { submitted = await request.json(); return HttpResponse.json({ success: true, message: genericNotice }); }));
    const user = userEvent.setup(); mount('/login'); await screen.findByText('Signed out');
    await user.type(screen.getByLabelText('Email Address'), 'new-student@example.test'); await user.type(screen.getByLabelText('Password', { exact: true }), testPassword); await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await user.click(await screen.findByRole('button', { name: 'Resend verification email' }));
    expect(await screen.findByRole('status')).toHaveTextContent(genericNotice); expect(submitted).toEqual({ email: 'new-student@example.test' }); expect(localStorage.getItem('techbridge_token')).toBeNull();
  });

  it('shows server retry timing on throttled public email requests', async () => {
    server.use(http.post(apiUrl('/auth/resend-verification'), () => HttpResponse.json({ success: false }, { status: 429, headers: { 'Retry-After': '45' } })));
    const user = userEvent.setup(); mount('/verify-email');
    await user.type(screen.getByLabelText('Email address'), 'someone@example.test'); await user.click(screen.getByRole('button', { name: 'Send verification email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 45 seconds.');
  });
});
