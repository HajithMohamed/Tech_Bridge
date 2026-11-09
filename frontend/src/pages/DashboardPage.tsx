import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getMatchedOpportunities } from '../api/opportunityApi';
import { getMyApplications } from '../api/applicationApi';
import { getMyResourceRequests } from '../api/resourceRequestApi';
import { useAuth } from '../hooks/useAuth';
import type { MatchedOpportunity, OpportunityApplication, ResourceRequest } from '../types';
import {
  Compass, Briefcase, Laptop, CheckCircle, Search, TrendingUp,
  Layers, Users, ArrowRight, AlertCircle,
} from 'lucide-react';

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
      .then(([matchData, applicationData, requestData]) => {
        setMatches(matchData.opportunities);
        setApplications(applicationData);
        setRequests(requestData);
      })
      .catch(() => setError('Some dashboard data could not be loaded. You can still browse the hubs directly.'))
      .finally(() => setLoading(false));
  }, [user?.role]);

  const accepted = useMemo(() => applications.filter((a) => a.status === 'accepted').length, [applications]);
  const activeRequests = useMemo(() => requests.filter((r) => r.status === 'pending' || r.status === 'accepted').length, [requests]);

  if (user?.role === 'provider') return <Navigate to="/provider" replace />;
  if (!user) return null;

  const profile = user.studentProfile;
  const firstName = user.fullName.split(' ')[0];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

      {/* Welcome banner */}
      <section className="mb-9">
        <div className="rounded-3xl bg-gradient-to-br from-primary-600 to-primary-700 px-8 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-lg shadow-primary-600/20">
          <div>
            <p className="text-primary-200 text-sm font-semibold mb-1 uppercase tracking-wider">Student Portal</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="text-primary-200 mt-1.5 text-sm">
              Your personalized opportunity pathway based on your skills and goals.
            </p>
          </div>
          <Link
            to="/student-profile"
            className="shrink-0 w-fit rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors backdrop-blur-sm"
          >
            Update Profile
          </Link>
        </div>
      </section>

      {error && (
        <div className="mb-7 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Metrics row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-9" aria-label="Activity summary">
        <Metric
          icon={<Compass className="w-5 h-5" />}
          value={loading ? '—' : matches.length}
          label="Matched"
          accent="green"
        />
        <Metric
          icon={<TrendingUp className="w-5 h-5" />}
          value={loading ? '—' : applications.length}
          label="Applied"
          accent="blue"
        />
        <Metric
          icon={<Layers className="w-5 h-5" />}
          value={profile?.skills.length ?? 0}
          label="Skills"
          accent="purple"
        />
        <Metric
          icon={<Users className="w-5 h-5" />}
          value={loading ? '—' : activeRequests}
          label="Active Requests"
          accent="amber"
        />
      </section>

      {/* Action hub */}
      <section className="grid lg:grid-cols-3 gap-5 mb-9">
        <ActionCard
          to="/opportunities"
          icon={<Search className="w-6 h-6" />}
          iconBg="bg-primary-50 text-primary-600"
          borderHover="hover:border-primary-200"
          title="Discover opportunities"
          desc="Jobs, internships, scholarships, courses and paid projects."
        />
        <ActionCard
          to="/resources"
          icon={<Laptop className="w-6 h-6" />}
          iconBg="bg-amber-50 text-amber-600"
          borderHover="hover:border-amber-200"
          title="Access resources"
          desc="Borrow, rent, sponsor or claim the equipment you need."
        />
        <ActionCard
          to="/my-applications"
          icon={<CheckCircle className="w-6 h-6" />}
          iconBg="bg-emerald-50 text-emerald-600"
          borderHover="hover:border-emerald-200"
          title="Track progress"
          desc={`${accepted} accepted application${accepted === 1 ? '' : 's'} and all current statuses.`}
        />
      </section>

      {/* Best matches */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center border border-primary-100">
              <Compass className="w-5 h-5 text-primary-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Best Matches For You</h2>
              <p className="text-sm text-gray-500">Based on your skills and goals.</p>
            </div>
          </div>
          <Link
            to="/opportunities"
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5 group"
          >
            View All
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Finding relevant opportunities…</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="py-12 text-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
            <p className="font-semibold text-gray-800 mb-3">Your profile needs a little more detail.</p>
            <Link
              to="/student-profile"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
            >
              Add skills and career goal
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {matches.slice(0, 3).map((match) => (
              <MatchCard key={match._id} match={match} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

/* ── Sub-components ─────────────────────────────────────────────── */

type AccentColor = 'green' | 'blue' | 'purple' | 'amber';
const accentMap: Record<AccentColor, { bg: string; text: string; iconBg: string }> = {
  green:  { bg: 'bg-primary-50',  text: 'text-primary-600',  iconBg: 'bg-primary-100' },
  blue:   { bg: 'bg-blue-50',     text: 'text-blue-600',     iconBg: 'bg-blue-100'   },
  purple: { bg: 'bg-violet-50',   text: 'text-violet-600',   iconBg: 'bg-violet-100' },
  amber:  { bg: 'bg-amber-50',    text: 'text-amber-600',    iconBg: 'bg-amber-100'  },
};

const Metric = ({ icon, value, label, accent }: { icon: React.ReactNode; value: string | number; label: string; accent: AccentColor }) => {
  const a = accentMap[accent];
  return (
    <article className={`${a.bg} rounded-2xl p-5 flex items-center gap-4 border border-white/60 shadow-sm`}>
      <div className={`w-10 h-10 rounded-xl ${a.iconBg} ${a.text} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-black ${a.text}`}>{value}</p>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-0.5">{label}</p>
      </div>
    </article>
  );
};

const ActionCard = ({ to, icon, iconBg, borderHover, title, desc }: {
  to: string; icon: React.ReactNode; iconBg: string; borderHover: string; title: string; desc: string;
}) => (
  <Link
    to={to}
    className={`group bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-lg ${borderHover} hover:-translate-y-1 transition-all flex flex-col`}
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconBg} group-hover:scale-105 transition-transform`}>
      {icon}
    </div>
    <h2 className="font-bold text-gray-900 text-lg mb-1.5">{title}</h2>
    <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-primary-600 transition-colors">
      Explore <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
    </div>
  </Link>
);

const MatchCard = ({ match }: { match: MatchedOpportunity }) => (
  <Link
    to={`/opportunities/${match._id}`}
    className="group rounded-2xl border border-gray-100 bg-white p-5 hover:border-primary-200 hover:shadow-md transition-all flex flex-col h-full"
  >
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-primary-50 group-hover:border-primary-100 transition-colors">
        <Briefcase className="w-5 h-5 text-gray-500 group-hover:text-primary-600 transition-colors" aria-hidden="true" />
      </div>
      <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
        {match.matchPercentage}% Match
      </span>
    </div>

    <p className="font-bold text-gray-900 leading-snug mb-1">{match.title}</p>
    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
      {match.type.replace('_', ' ')} · {match.workMode}
    </p>

    <div className="mt-auto flex flex-wrap gap-1.5 pt-4 border-t border-gray-50">
      {match.matchedSkills.slice(0, 3).map((skill) => (
        <span key={skill} className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
          {skill}
        </span>
      ))}
      {match.matchedSkills.length > 3 && (
        <span className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
          +{match.matchedSkills.length - 3}
        </span>
      )}
    </div>
  </Link>
);

export default DashboardPage;
