import { useEffect, useState, type FormEvent } from 'react';
import { decideVerification, downloadVerificationDocument, fetchVerificationQueue, verificationError, verificationStatusLabel, type VerificationStatus, type VerificationQueue } from '../../api/verificationApi';
import type { User } from '../../types';
import VerificationHistory from './VerificationHistory';

export default function AdminVerificationPanel() {
  const [q, setQ] = useState(''); const [filters, setFilters] = useState({ status: 'PENDING', q: '' }); const [page, setPage] = useState(1); const [revision, setRevision] = useState(0);
  const [data, setData] = useState<VerificationQueue>({ providers: [], page: 1, pages: 1, total: 0 });
  const [selected, setSelected] = useState<User | null>(null); const [decision, setDecision] = useState<'verify' | 'reject' | 'request-info'>('verify');
  const [reason, setReason] = useState(''); const [reviewed, setReviewed] = useState<string | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => { if (current) { setLoading(true); setError(''); } return fetchVerificationQueue({ ...filters, page }); })
      .then((result) => { if (current) { if (!result.providers.length && page > 1) setPage(page - 1); else setData(result); } })
      .catch((failure) => { if (current) setError(verificationError(failure)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filters, page, revision]);
  const open = (provider: User) => { setSelected(provider); setReviewed(null); setReason(''); setDecision(provider.providerProfile?.verificationDocumentId ? 'verify' : 'request-info'); setError(''); setNotice(''); };
  const reload = () => { setSelected(null); setReviewed(null); setRevision((value) => value + 1); };
  const download = async () => {
    const id = selected?.providerProfile?.verificationDocumentId; if (!selected || !id) return;
    setBusy(true); setError('');
    try { await downloadVerificationDocument(id, { providerId: selected._id }); setReviewed(id); setHistoryRevision((value) => value + 1); }
    catch (failure) { setError(verificationError(failure)); }
    finally { setBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return; setBusy(true); setError('');
    try { await decideVerification(selected._id, decision, reason, selected.providerProfile?.verificationDocumentId || null); reload(); setNotice('Verification decision recorded. A decision notice is available to the provider.'); }
    catch (failure) { setError(verificationError(failure)); }
    finally { setBusy(false); }
  };
  const profile = selected?.providerProfile; const currentId = profile?.verificationDocumentId;
  return <div className="space-y-5 text-surface-900">
    <form onSubmit={(event) => { event.preventDefault(); setFilters({ ...filters, q }); setPage(1); setSelected(null); }} className="flex flex-wrap items-end gap-3">
      <label className="flex-1">Search providers<input maxLength={100} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Organization, name or email" className="mt-1 w-full rounded-lg border p-2" /></label>
      <label>Verification status<select value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); setSelected(null); }} className="ml-2 rounded-lg border p-2">{['PENDING', 'NEEDS_INFO', 'REJECTED', 'VERIFIED', 'ALL'].map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All statuses' : verificationStatusLabel[value as VerificationStatus]}</option>)}</select></label>
      <button className="rounded-lg bg-primary-600 px-4 py-2 text-white">Search providers</button><button type="button" onClick={reload} className="text-primary-700">Refresh verification queue</button>
    </form>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}{notice && <p role="status" className="text-primary-700">{notice}</p>}
    {loading ? <p role="status">Loading providers...</p> : <div className="space-y-3">{data.providers.map((provider) => <article key={provider._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><h2 className="font-bold">{provider.providerProfile?.organizationName || provider.fullName}</h2><p className="text-sm text-gray-600">{provider.email} · {verificationStatusLabel[provider.providerProfile?.verificationStatus || 'PENDING']} · {provider.accountStatus || 'active'}</p></div><button onClick={() => open(provider)} className="text-primary-700">Review {provider.providerProfile?.organizationName || provider.fullName}</button></article>)}{!data.providers.length && <p>No providers match this queue.</p>}</div>}
    <div className="flex flex-wrap items-center gap-4"><button disabled={loading || page <= 1} onClick={() => { setPage(page - 1); setSelected(null); }} className="text-primary-700 disabled:opacity-40">Previous provider page</button><span>Page {page} of {data.pages} · {data.total} providers</span><button disabled={loading || page >= data.pages} onClick={() => { setPage(page + 1); setSelected(null); }} className="text-primary-700 disabled:opacity-40">Next provider page</button></div>
    {selected && <section aria-label="Provider review" className="space-y-5 rounded-xl border border-primary-200 bg-primary-50 p-5"><h2 className="font-bold">Review {profile?.organizationName}</h2>
      <p>{profile?.description}</p><p className="text-sm">{profile?.contactPerson} · {profile?.contactEmail} · {profile?.phone} · {profile?.location}</p>
      <p className="text-sm">{currentId ? `Current evidence: ${profile?.verificationDocumentName}` : 'No stored evidence. Legacy filenames do not count as a submission.'}</p>
      {currentId && <button disabled={busy} onClick={() => void download()} className="text-primary-700">Download current evidence</button>}
      <p className="text-sm text-gray-600">Inspect the downloaded evidence and confirm the organization’s identity and affiliation before approving.</p>
      <form onSubmit={(event) => void submit(event)} className="space-y-3"><label className="block">Verification decision<select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)} className="ml-2 rounded-lg border p-2"><option value="verify">Approve</option><option value="reject">Reject</option><option value="request-info">Request more information</option></select></label>
        <label className="block">Decision reason<textarea required minLength={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
        {decision === 'verify' && (!currentId || reviewed !== currentId) && <p className="text-sm">Download the current evidence before approval.</p>}
        <button disabled={busy || reason.trim().length < 3 || (decision === 'verify' && (!currentId || reviewed !== currentId))} className="rounded-lg bg-primary-600 px-4 py-2 text-white disabled:opacity-40">Confirm verification decision</button>
      </form>
      <VerificationHistory key={selected._id} providerId={selected._id} revision={historyRevision} />
    </section>}
  </div>;
}
