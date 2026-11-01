import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { changeAdminRole, fetchAdminUsers, reinstateUser, suspendUser, type UserPage } from '../../api/adminApi';
import type { User } from '../../types';
import AdminAuditPanel from './AdminAuditPanel';

export default function AdminUsersPanel({ currentUserId }: { currentUserId?: string }) {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<UserPage>({ users: [], page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<User | null>(null);
  const [action, setAction] = useState<{ user: User; kind: 'status' | 'role' } | null>(null);
  const [role, setRole] = useState<User['role']>('admin');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => { if (current) { setLoading(true); setError(''); } return fetchAdminUsers({ q: filters.q, role: filters.role || undefined, status: filters.status || undefined, page }); })
      .then((result) => { if (current) { if (!result.users.length && page > 1) setPage(page - 1); else setData(result); } })
      .catch(() => { if (current) setError('Unable to load users.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filters, page, revision]);
  const open = (user: User, kind: 'status' | 'role') => { setAction({ user, kind }); setRole(user.role === 'admin' ? user.adminBaseRole || 'admin' : 'admin'); setReason(''); setError(''); setNotice(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!action) return;
    setSaving(true); setError('');
    try {
      if (action.kind === 'role') await changeAdminRole(action.user._id, role, reason);
      else if (action.user.accountStatus === 'suspended') await reinstateUser(action.user._id, reason);
      else await suspendUser(action.user._id, reason);
      setAction(null); setHistory(null); setRevision((value) => value + 1); setNotice('Account updated and action recorded. The user must sign in again.');
    } catch (failure) { setError(axios.isAxiosError(failure) ? failure.response?.data?.message || 'Unable to update the account.' : 'Unable to update the account.'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-5 text-surface-900">
    <form onSubmit={(event) => { event.preventDefault(); setFilters({ ...filters, q }); setPage(1); }} className="flex flex-wrap items-end gap-3">
      <label className="flex-1">Search users<input maxLength={100} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Name or email" className="mt-1 w-full rounded-lg border border-gray-300 p-2" /></label>
      <label>Role<select value={filters.role} onChange={(event) => { setFilters({ ...filters, role: event.target.value }); setPage(1); }} className="ml-2 rounded-lg border p-2"><option value="">All roles</option>{['student', 'provider', 'admin'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Account status<select value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); }} className="ml-2 rounded-lg border p-2"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
      <button className="rounded-lg bg-primary-600 px-4 py-2 text-white">Search</button>
    </form>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}{notice && <p role="status" className="text-emerald-700">{notice}</p>}
    {loading ? <p role="status">Loading users…</p> : <div className="space-y-3">{data.users.map((user) => <article key={user._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4">
      <div><h2 className="font-semibold">{user.fullName}</h2><p className="text-sm text-gray-600">{user.email} · {user.role} · {user.accountStatus || 'active'}</p></div>
      <div className="flex flex-wrap gap-3"><button className="text-primary-700" onClick={() => setHistory(user)}>History for {user.fullName}</button>
        <button disabled={saving || user._id === currentUserId} className="text-primary-700 disabled:opacity-40" onClick={() => open(user, 'status')}>{user.accountStatus === 'suspended' ? 'Reinstate' : 'Suspend'} {user.fullName}</button>
        <button disabled={saving || user._id === currentUserId || user.accountStatus === 'suspended' || (user.role === 'admin' && !user.adminBaseRole)} className="text-primary-700 disabled:opacity-40" onClick={() => open(user, 'role')}>Change role for {user.fullName}</button></div>
    </article>)}{!data.users.length && <p>No matching users.</p>}</div>}
    <div className="flex items-center gap-4"><button disabled={loading || page <= 1} onClick={() => setPage(page - 1)} className="text-primary-700 disabled:opacity-40">Previous user page</button><span>Page {page} of {data.pages} · {data.total} users</span><button disabled={loading || page >= data.pages} onClick={() => setPage(page + 1)} className="text-primary-700 disabled:opacity-40">Next user page</button></div>
    {action && <section aria-label="Account action" className="rounded-xl border border-primary-200 bg-primary-50 p-5"><h2 className="font-bold">Update {action.user.fullName}</h2><form onSubmit={(event) => void submit(event)} className="mt-3 space-y-3">
      {action.kind === 'role' && <label>New role<select value={role} onChange={(event) => setRole(event.target.value as User['role'])} className="ml-3 rounded border p-2"><option value="admin">admin</option>{action.user.adminBaseRole && <option value={action.user.adminBaseRole}>{action.user.adminBaseRole}</option>}</select></label>}
      <label className="block">Action reason<textarea required minLength={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2" /></label>
      <button disabled={saving || reason.trim().length < 3} className="rounded-lg bg-primary-600 px-4 py-2 text-white disabled:opacity-40">{saving ? 'Saving…' : 'Confirm account change'}</button><button type="button" disabled={saving} onClick={() => setAction(null)} className="ml-3 text-primary-700">Cancel</button>
    </form></section>}
    {history && <section className="rounded-xl border border-gray-200 p-4"><div className="mb-4 flex justify-between"><h2 className="font-bold">History for {history.fullName}</h2><button onClick={() => setHistory(null)}>Close history</button></div><AdminAuditPanel key={history._id} userId={history._id} /></section>}
  </div>;
}
