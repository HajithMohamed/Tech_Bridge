import AdminCommunityPanel from '../components/admin/AdminCommunityPanel';
import AdminUsersPanel from '../components/admin/AdminUsersPanel';
import AdminAuditPanel from '../components/admin/AdminAuditPanel';
import AdminVerificationPanel from '../components/admin/AdminVerificationPanel';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useState } from 'react';
import { getReports, resolveReport, type Report } from '../api/adminApi';
import { getImpactStats } from '../api/dashboardApi';
import type { ImpactStats } from '../types';

type Tab = 'providers' | 'community' | 'users' | 'reports' | 'audit';
const AdminDashboardPage = () => {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('providers'); const [reports, setReports] = useState<Report[]>([]); const [stats, setStats] = useState<ImpactStats | null>(null); const [error, setError] = useState('');
  useEffect(() => { void getImpactStats().then(setStats).catch(() => undefined); }, []);
  useEffect(() => { if (tab === 'reports') void getReports().then(setReports).catch(() => setError('Unable to load reports.')); }, [tab]);
  const resolve = async (report: Report) => { const note = window.prompt('Resolution note (optional):') || ''; const removeTarget = report.targetType === 'opportunity' || report.targetType === 'resource' ? window.confirm('Remove the reported listing as part of this resolution?') : false; try { await resolveReport(report._id, 'reviewed', note, removeTarget); setReports((items) => items.filter((item) => item._id !== report._id)); } catch { setError('Unable to resolve report.'); } };
  return <main className="max-w-7xl mx-auto px-4 py-8"><p className="text-sm font-bold tracking-wider text-primary-600">TRUST & SAFETY</p><h1 className="mt-1 text-3xl font-bold text-surface-900">Admin control center</h1>{stats && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Students', stats.totalStudents], ['Open listings', stats.totalOpenOpportunities], ['Applications', stats.totalApplications], ['Resources', stats.totalResourceListings]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-primary-50 p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold text-primary-800">{value}</p></div>)}</div>}<div className="mt-7 flex flex-wrap gap-2">{(['providers', 'community', 'users', 'reports', 'audit'] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${tab === item ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{item === 'providers' ? 'Verification queue' : item === 'community' ? 'Community claims' : item}</button>)}</div>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}<section className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">{tab === 'providers' && <AdminVerificationPanel />}{tab === 'community' && <AdminCommunityPanel />}{tab === 'users' && <AdminUsersPanel currentUserId={currentUser?._id} />}{tab === 'reports' && <div className="space-y-3">{reports.map((report) => <div key={report._id} className="rounded-xl border border-gray-100 p-4"><p className="font-semibold capitalize">{report.targetType} report</p><p className="mt-1 text-sm text-gray-600">{report.reason}</p><button onClick={() => void resolve(report)} className="mt-3 text-sm font-semibold text-primary-700">Resolve</button></div>)}{!reports.length && <p className="text-gray-500">No open reports.</p>}</div>}{tab === 'audit' && <AdminAuditPanel />}</section></main>;
};
export default AdminDashboardPage;
