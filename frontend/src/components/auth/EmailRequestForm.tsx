import { useState, type FormEvent } from 'react';
import type { AuthActionResponse } from '../../api/authApi';
import { authErrorMessage } from '../../utils/authForms';

export default function EmailRequestForm({ submit, label }: { submit: (email: string) => Promise<AuthActionResponse>; label: string }) {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const request = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setNotice(''); setError('');
    try { const result = await submit(email.trim()); setNotice(result.message); }
    catch (failure) { setError(authErrorMessage(failure, 'Unable to send the email. Please try again.')); }
    finally { setBusy(false); }
  };
  return <form onSubmit={request} className="space-y-4">
    <label className="block text-sm font-semibold text-gray-800">Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-3 text-gray-900 focus:border-primary-700 focus:outline-primary-700" /></label>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}{notice && <p role="status" className="text-sm leading-6 text-primary-800">{notice}</p>}
    <button disabled={busy} className="min-h-11 w-full rounded-lg bg-primary-700 px-4 py-3 font-semibold text-white hover:bg-primary-800 disabled:opacity-50">{busy ? 'Sending email...' : label}</button>
  </form>;
}
