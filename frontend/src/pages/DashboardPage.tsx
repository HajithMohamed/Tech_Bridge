import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getMatchedOpportunities } from '../api/opportunityApi';
import { getMyApplications } from '../api/applicationApi';
import { getMyResourceRequests } from '../api/resourceRequestApi';
import { useAuth } from '../hooks/useAuth';
import type { MatchedOpportunity, OpportunityApplication, ResourceRequest } from '../types';

const DashboardPage = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchedOpportunity[]>([]);
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role !== 'student') return;
    void Promise.all([getMatchedOpportunities(), getMyApplications(), getMyResourceRequests()])
      .then(([matchData, applicationData, requestData]) => { setMatches(matchData.opportunities); setApplications(applicationData); setRequests(requestData); })
      .catch(() => setError('Some dashboard data could not be loaded. You can still browse the hubs directly.'))
      .finally(() => setLoading(false));
  }, [user?.role]);

  const accepted = useMemo(() => applications.filter((item) => item.status === 'accepted').length, [applications]);
  const activeRequests = useMemo(() => requests.filter((item) => item.status === 'pending' || item.status === 'accepted').length, [requests]);
  if (user?.role === 'provider') return <Navigate to="/provider" replace />;
  if (!user) return null;

  const profile = user.studentProfile;
  return <div className="min-h-screen bg-surface-50"><AppHeader /><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9"><section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8"><div><p className="text-primary-600 text-sm font-semibold uppercase tracking-wider">Student portal</p><h1 className="text-3xl font-bold text-gray-900 mt-2">Welcome back, {user.fullName.split(' ')[0]}</h1><p className="text-gray-500 mt-2">Your next pathway is built from the skills and goals in your profile.</p></div><Link to="/student-profile" className="w-fit rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50">Update my profile</Link></section>{error && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">{error}</div>}<section className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Metric value={loading ? '—' : matches.length} label="Opportunities matched" /><Metric value={loading ? '—' : applications.length} label="Applications sent" /><Metric value={profile?.skills.length || 0} label="Skills listed" /><Metric value={loading ? '—' : activeRequests} label="Active resource requests" /></section><section className="grid lg:grid-cols-3 gap-5 mt-8"><Link to="/opportunities" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary-200"><p className="text-xl">⌕</p><h2 className="font-bold text-gray-900 mt-3">Discover opportunities</h2><p className="text-sm text-gray-500 mt-1">Jobs, internships, scholarships, courses and paid projects.</p></Link><Link to="/resources" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary-200"><p className="text-xl">▣</p><h2 className="font-bold text-gray-900 mt-3">Access technical resources</h2><p className="text-sm text-gray-500 mt-1">Borrow, rent, sponsor or claim the equipment you need.</p></Link><Link to="/my-applications" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary-200"><p className="text-xl">✓</p><h2 className="font-bold text-gray-900 mt-3">Track your progress</h2><p className="text-sm text-gray-500 mt-1">{accepted} accepted application{accepted === 1 ? '' : 's'} and all current statuses.</p></Link></section><section className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-gray-900">Best matches for you</h2><p className="text-sm text-gray-500 mt-1">Rule-based on your skills, career goal and location—no AI involved.</p></div><Link to="/opportunities" className="text-sm font-semibold text-primary-600">View all matches →</Link></div>{loading ? <p className="py-8 text-gray-400">Finding relevant opportunities…</p> : matches.length === 0 ? <div className="py-8"><p className="font-semibold text-gray-800">Your profile needs a little more detail to create matches.</p><Link to="/student-profile" className="inline-block mt-3 text-primary-600 font-semibold">Add your skills and career goal →</Link></div> : <div className="mt-5 grid md:grid-cols-3 gap-4">{matches.slice(0, 3).map((match) => <Link key={match._id} to={`/opportunities/${match._id}`} className="rounded-xl border border-gray-100 bg-surface-50 p-4 hover:border-primary-200"><div className="flex items-start justify-between gap-2"><p className="font-semibold text-gray-900">{match.title}</p><span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{match.matchPercentage}%</span></div><p className="mt-2 text-sm text-gray-500">{match.type.replace('_', ' ')} · {match.workMode}</p><div className="mt-3 flex flex-wrap gap-1">{match.matchedSkills.slice(0, 3).map((skill) => <span key={skill} className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{skill}</span>)}</div></Link>)}</div>}</section></main></div>;
};

const Metric = ({ value, label }: { value: string | number; label: string }) => <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-sm text-gray-500 mt-1">{label}</p></article>;

export default DashboardPage;
