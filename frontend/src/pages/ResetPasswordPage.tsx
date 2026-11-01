import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '../api/authApi';
import AuthFlowShell from '../components/auth/AuthFlowShell';
import useAuthLinkToken from '../hooks/useAuthLinkToken';
import { useAuth } from '../hooks/useAuth';
import { authErrorMessage, passwordError } from '../utils/authForms';

export default function ResetPasswordPage() {
  const token = useAuthLinkToken(); const { logout } = useAuth();
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !token) return;
    const validation = passwordError(password, confirmation); if (validation) { setError(validation); return; }
    setBusy(true); setError('');
    try { await resetPassword(token, password, confirmation); setPassword(''); setConfirmation(''); logout(); setDone(true); }
    catch (failure) { setError(authErrorMessage(failure, 'This reset link could not be used. Request a new link.')); }
    finally { setBusy(false); }
  };
  return <AuthFlowShell title="Choose a new password" description="Use a unique password with at least 12 characters. Updating it signs out your existing sessions.">
    {done ? <div><p role="status" className="leading-6 text-primary-800">Your password has been updated. Sign in with your new password.</p><Link to="/login" className="mt-5 inline-block rounded-lg bg-primary-700 px-4 py-3 font-semibold text-white">Sign in</Link></div> : !token ? <div><p role="alert" className="text-sm text-red-800">This reset link is missing or invalid.</p><Link to="/forgot-password" className="mt-4 inline-block font-semibold text-primary-800 underline">Request a new reset link</Link></div> : <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-semibold text-gray-800">New password<input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:outline-primary-700" /></label>
      <label className="block text-sm font-semibold text-gray-800">Confirm new password<input type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:outline-primary-700" /></label>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <button disabled={busy} className="min-h-11 w-full rounded-lg bg-primary-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Updating password...' : 'Update password'}</button>
      <Link to="/forgot-password" className="inline-block text-sm font-semibold text-primary-800 underline">Request a new reset link</Link>
    </form>}
  </AuthFlowShell>;
}
