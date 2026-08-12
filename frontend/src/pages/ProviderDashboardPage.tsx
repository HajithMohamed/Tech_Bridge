import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getProviderDashboard } from '../api/providerApi';
import { getProviderResourceRequests } from '../api/resourceRequestApi';
import { useAuth } from '../hooks/useAuth';
import type { ProviderDashboard } from '../types';
import { allowedProviderOfferings, canManageResources, enabledOpportunityTypes, providerConfigFor } from '../utils/providerCapabilities';

const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const ProviderDashboardPage = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ProviderDashboard | null>(null);
  const [pendingResourceRequests, setPendingResourceRequests] = useState<number | null>(null);
  const [error, setError] = useState('');
  const profile = user?.providerProfile;
  const config = providerConfigFor(profile);
  const enabledTypes = enabledOpportunityTypes(profile);
  const resourceEnabled = canManageResources(profile);
  const selectedServices = useMemo(() => allowedProviderOfferings(profile).filter((offering) => profile?.opportunityCategories?.includes(offering.id)), [profile]);

  useEffect(() => {
    void getProviderDashboard().then(setDashboard).catch(() => setError('Unable to load dashboard data.'));
    if (resourceEnabled) void getProviderResourceRequests().then((items) => setPendingResourceRequests(items.filter((item) => item.status === 'pending').length)).catch(() => undefined);
  }, [resourceEnabled]);

  const stats = dashboard?.stats;
  const relevantStats = getRelevantStats(profile?.organizationType, stats, pendingResourceRequests);
  const canPublishOpportunity = enabledTypes.length > 0;

  const categories = user?.providerProfile?.opportunityCategories || [];
  const offersJobs = categories.includes('jobs');
  const offersInternships = categories.includes('internships');
  const offersScholarships = categories.includes('scholarships');
  const offersTraining = categories.includes('training');
  const offersMentorship = categories.includes('mentorship');
  const offersResources = categories.includes('technical_resources');

  return <div className="min-h-screen"><AppHeader /><main className="max-w-7xl mx-auto px-4 sm:px-6 py-9"><section className="flex flex-col lg:flex-row justify-between gap-5 mb-8"><div><p className="text-accent-400 text-sm font-semibold mb-2">{config.shortLabel.toUpperCase()}</p><h1 className="text-3xl font-bold text-white">Welcome, {profile?.organizationName || user?.fullName}</h1><p className="text-gray-400 mt-2 max-w-3xl">{config.description}</p></div><div className={`self-start px-4 py-2 rounded-full text-sm border ${profile?.verified ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'}`}>{profile?.verified ? '✓ Verified provider' : 'Pending verification'}</div></section>{error && <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-100">{error}</div>}<section><div className="mb-4"><h2 className="text-xl font-bold text-white">Your impact</h2><p className="text-sm text-gray-400 mt-1">Outcomes created through your {config.label.toLowerCase()} activity on TechBridge.</p></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{relevantStats.map((card) => <MetricCard key={card.label} {...card} />)}</div></section><section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3 mb-4"><div><h2 className="text-xl font-bold text-white">Quick actions</h2><p className="text-sm text-gray-400 mt-1">Only actions relevant to your provider type and enabled services appear here.</p></div><Link to="/provider/profile" className="text-sm text-primary-300 hover:text-white">Manage services →</Link></div>{selectedServices.length === 0 ? <div className="glass-card p-6"><p className="font-semibold text-white">Choose the services you provide to students.</p><p className="mt-2 text-sm text-gray-400">Your portal will then activate its relevant listing, application and impact tools.</p><Link to="/provider/profile" className="inline-block mt-4 text-primary-300 font-semibold">Set up my provider services →</Link></div> : <><div className="mb-4 flex flex-wrap gap-2">{selectedServices.map((service) => <span key={service.id} className="tag">{service.label}</span>)}</div><div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">{offersJobs && <ModuleCard to="/provider/opportunities" icon="💼" title="Jobs / Freelance" description="Post roles and projects." />}{offersInternships && <ModuleCard to="/provider/opportunities" icon="🎓" title="Internships" description="Hire student interns." />}{offersTraining && <ModuleCard to="/provider/opportunities" icon="🏫" title="Training / Workshops" description="Publish courses and workshops." />}{offersMentorship && <ModuleCard to="/provider/opportunities" icon="💡" title="Mentorship" description="Offer professional guidance." />}{offersScholarships && <ModuleCard to="/provider/opportunities" icon="💰" title="Scholarships" description="Publish financial aid." />}{offersResources && <ModuleCard to="/provider/resources" icon="▣" title="Manage resources" description="List laptops, Arduino and access options." tone="emerald" />}{offersResources && <ModuleCard to="/provider/resource-requests" icon="↳" title="Resource requests" description="Accept or reject access requests." tone="emerald" />}{canPublishOpportunity && <ModuleCard to="/provider/applications" icon="✓" title={applicationActionLabel(profile?.organizationType)} description="Review only the student responses for your active opportunity listings." tone="amber" />}</div></>}</section><section className="glass-card mt-8 p-6"><div className="flex justify-between gap-4 items-center"><div><h2 className="text-lg font-bold text-white">Recent {config.shortLabel.toLowerCase()} activity</h2><p className="text-sm text-gray-400 mt-1">Your latest listings and their student reach.</p></div>{(stats?.expiringSoon ?? 0) > 0 && <span className="text-sm text-amber-200">{stats?.expiringSoon} listing(s) expire within 7 days</span>}</div>{!dashboard ? <p className="text-gray-400 mt-5">Loading your recent activity...</p> : dashboard.recentActivity.length === 0 ? <p className="text-gray-400 mt-5">Publish your first opportunity or resource to start building impact.</p> : <div className="mt-4 divide-y divide-white/10">{dashboard.recentActivity.map((activity) => <div key={`${activity.kind}-${activity.id}`} className="py-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">{activity.title}</p><p className="text-xs text-gray-500">{activity.detail} · {new Date(activity.occurredAt).toLocaleDateString('en-LK')}</p></div><span className="text-xs rounded-full bg-white/8 px-2 py-1 text-gray-300">{humanize(activity.status)}</span></div>)}</div>}</section></main></div>;
};

const getRelevantStats = (type: string | undefined, stats: ProviderDashboard['stats'] | undefined, pendingResourceRequests: number | null) => {
  const value = (key: keyof ProviderDashboard['stats']) => stats?.[key] ?? '—';
  const base = [{ label: 'Active listings', value: value('activeListings'), description: 'Currently available to students' }];
  switch (type) {
    case 'scholarship_org': return [...base, { label: 'Funding listings', value: value('scholarships'), description: 'Scholarships and assistance' }, { label: 'Applications received', value: value('applicationsReceived'), description: 'Student funding requests' }, { label: 'Students supported', value: value('studentsConnected'), description: 'Accepted funding applications' }];
    case 'training_org': return [...base, { label: 'Training programs', value: value('trainingPrograms'), description: 'Courses and workshops' }, { label: 'Student responses', value: value('applicationsReceived'), description: 'Interest in your programs' }, { label: 'Learners connected', value: value('studentsConnected'), description: 'Accepted students' }];
    case 'individual': return [...base, { label: 'Mentorship listings', value: value('mentorshipListings'), description: 'Guidance opportunities shared' }, { label: 'Guidance requests', value: value('applicationsReceived'), description: 'Student interest received' }, { label: 'Students guided', value: value('studentsConnected'), description: 'Accepted mentoring requests' }];
    case 'resource_provider': return [{ label: 'Resources listed', value: value('resourceCount'), description: 'Equipment access options' }, { label: 'Pending requests', value: pendingResourceRequests ?? '—', description: 'Students awaiting a reply' }, { label: 'Resources accessed', value: value('resourceRequestsAccepted'), description: 'Accepted or completed requests' }, { label: 'Students supported', value: value('resourceStudentsConnected'), description: 'Students with accepted access' }];
    case 'local_business': return [...base, { label: 'Paid projects', value: value('paidProjects'), description: 'Student-friendly work created' }, { label: 'Project responses', value: value('applicationsReceived'), description: 'Student proposals received' }, { label: 'Students connected', value: value('studentsConnected'), description: 'Accepted project applicants' }];
    case 'alumni': return [...base, { label: 'Opportunities shared', value: value('totalOpportunities'), description: 'Referrals, internships and guidance' }, { label: 'Mentorship listings', value: value('mentorshipListings'), description: 'Guidance and networking offers' }, { label: 'Students supported', value: value('studentsConnected'), description: 'Accepted student connections' }];
    case 'faculty': return [...base, { label: 'Academic programs', value: value('trainingPrograms'), description: 'Workshops and career programs' }, { label: 'Guidance listings', value: value('mentorshipListings'), description: 'Academic and career support' }, { label: 'Students supported', value: value('studentsConnected'), description: 'Accepted student connections' }];
    case 'ngo': return [...base, { label: 'Support listings', value: value('totalOpportunities'), description: 'Community opportunities shared' }, { label: 'Resources accessible', value: value('resourceCount'), description: 'Technical resource options' }, { label: 'Students supported', value: value('studentsConnected'), description: 'Accepted connections' }];
    default: return [...base, { label: 'Jobs & paid projects', value: value('paidProjects'), description: 'Employment pathways created' }, { label: 'Internships', value: value('internships'), description: 'Industry placements shared' }, { label: 'Students connected', value: value('studentsConnected'), description: 'Accepted industry applications' }];
  }
};

const applicationActionLabel = (type: string | undefined) => type === 'scholarship_org' ? 'Review funding applications' : type === 'training_org' ? 'Review learner responses' : type === 'individual' ? 'Review guidance requests' : type === 'local_business' ? 'Review project proposals' : type === 'alumni' ? 'Review student connections' : type === 'faculty' ? 'Review student interest' : 'Review student applications';
const MetricCard = ({ label, value, description }: { label: string; value: string | number; description: string }) => <article className="glass-card p-5"><p className="text-2xl font-bold text-white">{value}</p><p className="text-sm font-semibold text-gray-200 mt-2">{label}</p><p className="text-xs text-gray-500 mt-1">{description}</p></article>;
const ModuleCard = ({ to, icon, title, description, tone = 'primary' }: { to: string; icon: string; title: string; description: string; tone?: 'primary' | 'emerald' | 'amber' }) => <Link className={`glass-card p-5 hover:border-${tone}-400/50`} to={to}><p className={`text-lg text-${tone}-400`}>{icon}</p><h2 className="font-semibold text-white mt-2">{title}</h2><p className="text-sm text-gray-400 mt-1">{description}</p></Link>;

export default ProviderDashboardPage;
