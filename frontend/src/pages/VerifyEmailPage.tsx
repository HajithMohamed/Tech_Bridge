import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resendEmailVerification, verifyEmail } from '../api/authApi';
import AuthFlowShell from '../components/auth/AuthFlowShell';
import EmailRequestForm from '../components/auth/EmailRequestForm';
import useAuthLinkToken from '../hooks/useAuthLinkToken';
import { authErrorMessage } from '../utils/authForms';

export default function VerifyEmailPage() {
  const token = useAuthLinkToken(); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState('');
  const verify = async () => {
    if (busy || !token || done) return; setBusy(true); setError('');
    try { await verifyEmail(token); setDone(true); }
    catch (failure) { setError(authErrorMessage(failure, 'This verification link could not be used. Request a new email.')); }
    finally { setBusy(false); }
  };
  return <AuthFlowShell title="Verify your email" description="Confirm your email address before signing in. Provider organization review is a separate step.">
    {done ? <div><p role="status" className="leading-6 text-primary-800">Your email has been verified. You can now sign in. Providers still need organization approval.</p><Link to="/login" className="mt-5 inline-block rounded-lg bg-primary-700 px-4 py-3 font-semibold text-white">Sign in</Link></div> : <>
      {token && <div className="mb-6">{error && <p role="alert" className="mb-4 text-sm text-red-800">{error}</p>}<button onClick={() => void verify()} disabled={busy} className="min-h-11 w-full rounded-lg bg-primary-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Verifying email...' : 'Verify email address'}</button></div>}
      <h2 className="mb-3 text-base font-semibold text-gray-900">Need a new verification email?</h2><EmailRequestForm submit={resendEmailVerification} label="Send verification email" />
    </>}
  </AuthFlowShell>;
}
