import { useEffect, useState } from 'react';
import { fetchAdminAudit, type AuditPage } from '../../api/adminApi';

export default function AdminAuditPanel({ userId }: { userId?: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPage>({ entries: [], page: 1, pages: 1, total: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => { if (current) { setLoading(true); setError(''); } return fetchAdminAudit(page, userId); })
      .then((result) => { if (current) setData(result); })
      .catch(() => { if (current) setError('Unable to load action history.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [page, userId]);
  return <div className="space-y-4 text-surface-900">
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {loading ? <p role="status">Loading history…</p> : <>{data.entries.map((entry) => <article key={entry._id} className="rounded-xl border border-gray-200 p-4">
      <p className="font-semibold">{entry.action.replaceAll('_', ' ')}</p>
      <p className="text-sm text-gray-600">{typeof entry.adminId === 'string' ? entry.adminId : entry.adminId?.fullName || 'Former administrator'} · <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time></p>
      <p className="mt-1 text-sm">{entry.reason || 'No reason recorded in this legacy entry.'}</p>
      {entry.before?.role && entry.after?.role && <p className="mt-1 text-sm">Role: {entry.before.role} → {entry.after.role} · Status: {entry.before.accountStatus} → {entry.after.accountStatus}</p>}
      <p className="mt-1 break-all text-xs text-gray-500">{entry.targetType}: {entry.targetId}</p>
    </article>)}{!data.entries.length && <p>No actions recorded.</p>}</>}
    <div className="flex items-center gap-4"><button className="text-primary-700 disabled:opacity-40" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Previous history page</button>
      <span>History page {page} of {data.pages} · {data.total} actions</span><button className="text-primary-700 disabled:opacity-40" disabled={loading || page >= data.pages} onClick={() => setPage(page + 1)}>Next history page</button></div>
  </div>;
}
