import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getMatchedOpportunities } from '../api/opportunityApi';
import { getMyApplications } from '../api/applicationApi';
import { getMyResourceRequests } from '../api/resourceRequestApi';
import { useAuth } from '../hooks/useAuth';
import type { MatchedOpportunity, OpportunityApplication, ResourceRequest } from '../types';
import { Compass, Briefcase, Laptop, CheckCircle, Search, LayoutDashboard } from 'lucide-react';

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

  const accepted = useMemo(() => applications.filter((item) => item.status === 'accepted').length, [applications]);
  const activeRequests = useMemo(() => requests.filter((item) => item.status === 'pending' || item.status === 'accepted').length, [requests]);
  
  if (user?.role === 'provider') return <Navigate to="/provider" replace />;
  if (!user) return null;

  const profile = user.studentProfile;
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      
      {/* Header Section */}
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm mb-4">
            <LayoutDashboard className="w-4 h-4 text-primary-500" />
            <span className="text-xs font-semibold text-gray-700 tracking-wide uppercase">Student Portal</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight">
            Welcome back, {user.fullName.split(' ')[0]}
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Your personalized opportunity pathway based on your skills and goals.
          </p>
        </div>
        <Link 
          to="/student-profile" 
          className="w-fit rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-surface-900 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center gap-2"
        >
          Update Profile
        </Link>
      </section>

      {error && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 flex items-start gap-3 shadow-sm">
          <p>{error}</p>
        </div>
      )}

      {/* Metrics Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Metric value={loading ? '—' : matches.length} label="Opportunities Matched" />
        <Metric value={loading ? '—' : applications.length} label="Applications Sent" />
        <Metric value={profile?.skills.length || 0} label="Skills Listed" />
        <Metric value={loading ? '—' : activeRequests} label="Active Requests" />
      </section>

      {/* Main Actions Hub */}
      <section className="grid lg:grid-cols-3 gap-5 mb-12">
        <Link to="/opportunities" className="group bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-lg hover:border-primary-200 hover:-translate-y-1 transition-all">
          <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Search className="w-6 h-6" />
          </div>
          <h2 className="font-bold text-surface-900 text-xl mb-2">Discover opportunities</h2>
          <p className="text-sm text-gray-500">Jobs, internships, scholarships, courses and paid projects.</p>
        </Link>
        <Link to="/resources" className="group bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-lg hover:border-amber-200 hover:-translate-y-1 transition-all">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Laptop className="w-6 h-6" />
          </div>
          <h2 className="font-bold text-surface-900 text-xl mb-2">Access resources</h2>
          <p className="text-sm text-gray-500">Borrow, rent, sponsor or claim the equipment you need.</p>
        </Link>
        <Link to="/my-applications" className="group bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-lg hover:border-emerald-200 hover:-translate-y-1 transition-all">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h2 className="font-bold text-surface-900 text-xl mb-2">Track progress</h2>
          <p className="text-sm text-gray-500">{accepted} accepted application{accepted === 1 ? '' : 's'} and all current statuses.</p>
        </Link>
      </section>

      {/* Best Matches Section */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-50 flex items-center justify-center border border-gray-100">
              <Compass className="w-5 h-5 text-surface-900" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-surface-900">Best Matches For You</h2>
              <p className="text-sm text-gray-500">Based on your skills and goals.</p>
            </div>
          </div>
          <Link to="/opportunities" className="text-sm font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 px-4 py-2 rounded-lg transition-colors">
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 bg-surface-50 rounded-2xl border border-gray-100 border-dashed">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p>Finding relevant opportunities…</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="py-12 text-center bg-surface-50 rounded-2xl border border-gray-100 border-dashed">
            <p className="font-semibold text-gray-800 mb-2">Your profile needs a little more detail.</p>
            <Link to="/student-profile" className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity mt-2">
              Add skills and career goal
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {matches.slice(0, 3).map((match) => (
              <Link 
                key={match._id} 
                to={`/opportunities/${match._id}`} 
                className="group rounded-2xl border border-gray-100 bg-white p-5 hover:border-primary-300 hover:shadow-md transition-all flex flex-col h-full"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-primary-50 group-hover:border-primary-100 transition-colors">
                    <Briefcase className="w-5 h-5 text-gray-500 group-hover:text-primary-600" />
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {match.matchPercentage}% Match
                  </span>
                </div>
                
                <p className="font-bold text-surface-900 leading-snug mb-1">{match.title}</p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
                  {match.type.replace('_', ' ')} • {match.workMode}
                </p>
                
                <div className="mt-auto flex flex-wrap gap-1.5 pt-4 border-t border-gray-50">
                  {match.matchedSkills.slice(0, 3).map((skill) => (
                    <span key={skill} className="rounded-lg bg-surface-50 border border-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                      {skill}
                    </span>
                  ))}
                  {match.matchedSkills.length > 3 && (
                    <span className="rounded-lg bg-surface-50 border border-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                      +{match.matchedSkills.length - 3}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

const Metric = ({ value, label }: { value: string | number; label: string }) => (
  <article className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
    <p className="text-3xl font-black text-primary-500 mb-1">{value}</p>
    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
  </article>
);

export default DashboardPage;

