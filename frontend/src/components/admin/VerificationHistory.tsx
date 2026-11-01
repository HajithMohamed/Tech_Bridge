import { useEffect, useState } from 'react';
import axios from 'axios';
import { downloadVerificationDocument, fetchAdminVerificationHistory, fetchOwnVerificationHistory, markVerificationRead, verificationError, verificationActionLabel, verificationStatusLabel, type VerificationHistoryPage } from '../../api/verificationApi';

export default function VerificationHistory({ providerId, token, revision = 0, onRead, onUnauthorized }: { providerId?: string; token?: string; revision?: number; onRead?: () => void; onUnauthorized?: () => void }) {
  const [page, setPage] = useState(1); const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<VerificationHistoryPage>({ entries: [], page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => { if (current) { setLoading(true); setError(''); } return token ? fetchOwnVerificationHistory(token, page) : fetchAdminVerificationHistory(providerId!, page); })
      .then((result) => { if (current) setData(result); }).catch((failure) => { if (current) setError(verificationError(failure)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [providerId, token, page, revision, refresh]);
  const read = async (id: string) => {
    if (!token) return; setBusy(true); setError('');
    try { await markVerificationRead(token, id); setRefresh((value) => value + 1); onRead?.(); }
    catch (failure) { setError(verificationError(failure)); if (axios.isAxiosError(failure) && failure.response?.status === 401) onUnauthorized?.(); }
    finally { setBusy(false); }
  };
  const download = async (id: string) => {
    setBusy(true); setError('');
    try { await downloadVerificationDocument(id, token ? { token } : { providerId: providerId! }); }
    catch (failure) { setError(verificationError(failure)); }
    finally { setBusy(false); }
  };
  return <section aria-label="Verification history" className="space-y-3"><h2 className="font-bold">Verification history</h2>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {loading ? <p role="status">Loading verification history...</p> : <>{data.entries.map((entry) => <article key={entry._id} className="rounded-xl border border-gray-200 p-4">
      <p className="font-semibold">{verificationActionLabel[entry.action]}{token && ['verified', 'rejected', 'more_info'].includes(entry.action) && !entry.readAt && <span className="ml-2 text-sm text-primary-700">New decision</span>}</p>
      <p className="text-sm text-gray-600">{typeof entry.actorId === 'object' ? entry.actorId?.fullName || 'Former account' : 'Account holder'} · <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time> · {verificationStatusLabel[entry.fromStatus]} → {verificationStatusLabel[entry.toStatus]}</p>
      <p className="mt-2 whitespace-pre-wrap">{entry.reason}</p>
      {entry.documentId && <button disabled={busy} onClick={() => void download(entry.documentId!)} className="mr-4 mt-2 text-sm text-primary-700 disabled:opacity-40">Download associated evidence</button>}
      {token && ['verified', 'rejected', 'more_info'].includes(entry.action) && !entry.readAt && <button disabled={busy} onClick={() => void read(entry._id)} className="mt-2 text-sm text-primary-700">Mark decision as read</button>}
    </article>)}{!data.entries.length && <p>No verification activity yet.</p>}</>}
    <div className="flex flex-wrap items-center gap-4"><button disabled={loading || page <= 1} onClick={() => setPage(page - 1)} className="text-primary-700 disabled:opacity-40">Previous verification history page</button><span>History page {page} of {data.pages} · {data.total} entries</span><button disabled={loading || page >= data.pages} onClick={() => setPage(page + 1)} className="text-primary-700 disabled:opacity-40">Next verification history page</button></div>
  </section>;
}
