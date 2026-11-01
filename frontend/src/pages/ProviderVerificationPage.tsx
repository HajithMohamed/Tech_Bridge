import { useContext, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { downloadVerificationDocument, fetchVerificationState, startVerificationSession, submitVerificationFile, verificationError, verificationStatusLabel, type VerificationState } from '../api/verificationApi';
import VerificationHistory from '../components/admin/VerificationHistory';
import { AuthContext } from '../context/AuthContext';

export default function ProviderVerificationPage() {
  const verificationRequired = useLocation().state?.verificationRequired === true;
  const logout = useContext(AuthContext)?.logout;
  // Clear the full session after this public route mounts, so ProtectedRoute
  // cannot race the navigation with its normal signed-out redirect.
  useEffect(() => { if (verificationRequired) logout?.(); }, [verificationRequired, logout]);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [token, setToken] = useState('');
  const [data, setData] = useState<VerificationState | null>(null); const [file, setFile] = useState<File | null>(null); const [note, setNote] = useState('');
  const [revision, setRevision] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(verificationRequired ? 'Organization details changed. Sign in here to submit updated supporting evidence.' : '');
  const expire = () => { setToken(''); setData(null); setFile(null); setPassword(''); setNotice(''); };
  const failed = (failure: unknown) => { if (axios.isAxiosError(failure) && failure.response?.status === 401) expire(); setError(verificationError(failure)); };
  const refresh = async () => {
    setBusy(true); setError('');
    try { setData(await fetchVerificationState(token)); setRevision((value) => value + 1); }
    catch (failure) { failed(failure); }
    finally { setBusy(false); }
  };
  const signIn = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const session = await startVerificationSession(email, password); const state = await fetchVerificationState(session); setPassword(''); setToken(session); setData(state); setRevision(0); }
    catch (failure) { failed(failure); }
    finally { setBusy(false); }
  };
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!file) return; const form = event.currentTarget; setBusy(true); setError(''); setNotice('');
    try { await submitVerificationFile(token, file, note); setData(await fetchVerificationState(token)); setRevision((value) => value + 1); setFile(null); setNote(''); form.reset(); setNotice('Evidence submitted for administrator review.'); }
    catch (failure) { failed(failure); }
    finally { setBusy(false); }
  };
  const download = async () => {
    if (!data?.document) return; setBusy(true); setError('');
    try { await downloadVerificationDocument(data.document._id, { token }); }
    catch (failure) { failed(failure); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-surface-50 px-4 py-10 text-surface-900"><div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
    <Link to="/" className="font-bold text-primary-700">TECHBRIDGE</Link><h1 className="text-3xl font-bold">Provider verification</h1>
    <p className="text-gray-600">Submit supporting evidence, read decisions, and respond to information requests. Verification access lasts 15 minutes. Sign in again after an administrator changes your account.</p>
    <p className="text-sm"><Link to="/community-verification" className="text-primary-700 underline">Faculty or alumni? Claim and manage your community profile</Link>.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}{notice && <p role="status" className="text-primary-700">{notice}</p>}
    {!token || !data ? <form onSubmit={(event) => void signIn(event)} className="space-y-4">
      <label className="block">Provider email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-300 p-3" /></label>
      <label className="block">Verification password<input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-300 p-3" /></label>
      <button disabled={busy} className="rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white disabled:opacity-40">Open verification status</button>
    </form> : <>
      <section aria-label="Organization verification status" className="space-y-3 rounded-xl bg-primary-50 p-5"><h2 className="font-bold">{data.provider.organizationName}</h2><p>Verification status: <strong>{verificationStatusLabel[data.provider.status]}</strong></p><p>{data.unread} unread verification decisions</p>
        {data.provider.reason && <p className="whitespace-pre-wrap">Latest update: {data.provider.reason}</p>}
        <button disabled={busy} onClick={() => void refresh()} className="mr-4 text-primary-700">Refresh verification status</button><button onClick={expire} disabled={busy} className="text-primary-700">Close verification session</button>
      </section>
      {data.document && <section className="space-y-2"><h2 className="font-bold">Current supporting document</h2><p>{data.document.fileName} · {Math.ceil(data.document.size / 1024)} KiB</p><button disabled={busy} onClick={() => void download()} className="text-primary-700">Download my current evidence</button></section>}
      {data.provider.status === 'VERIFIED' ? <p className="text-primary-700">Your organization is verified. <Link to="/login" className="underline">Sign in to the provider portal</Link>.</p> : <form onSubmit={(event) => void upload(event)} className="space-y-4 rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold">Submit supporting evidence</h2><p className="text-sm text-gray-600">Provide organization registration or affiliation evidence requested by the reviewer. PDF, PNG or JPEG; up to 2 MiB. Five submissions per 24 hours. Use a clear image or a PDF without interactive content. If your PDF is unsupported, upload a PNG or JPEG copy. Avoid unrelated personal information.</p>
        <label className="block">Supporting document<input type="file" required accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label className="block">Submission note<textarea maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <button disabled={busy || !file} className="rounded-lg bg-primary-600 px-4 py-2 text-white disabled:opacity-40">Submit evidence</button>
      </form>}
      <VerificationHistory key={token} token={token} revision={revision} onRead={() => void refresh()} onUnauthorized={expire} />
    </>}
    <p className="text-sm text-gray-600"><Link to="/login" className="text-primary-700 underline">Platform sign in</Link> · <Link to="/register" className="text-primary-700 underline">Register an organization</Link></p>
  </div></main>;
}
