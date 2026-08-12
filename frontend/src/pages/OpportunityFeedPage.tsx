import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getOpportunities, getScholarships, getMatchedOpportunities } from '../api/opportunityApi';
import { useAuth } from '../hooks/useAuth';
import type { Opportunity, MatchedOpportunity, OpportunityType, WorkMode } from '../types';
import { Search, Filter, Briefcase, GraduationCap, BookOpen, Code, Wrench, Lightbulb, Target, ArrowRight, Sparkles, Users } from 'lucide-react';

const typeLabels: Record<OpportunityType, string> = {
  job: 'Job', internship: 'Internship', scholarship: 'Scholarship', course: 'Course', freelance: 'Freelance', workshop: 'Workshop', mentorship: 'Mentorship',
};
const typeIcons: Record<OpportunityType, typeof Briefcase> = {
  job: Briefcase, internship: GraduationCap, scholarship: BookOpen, course: Lightbulb, freelance: Code, workshop: Wrench, mentorship: Target,
};
const coverageLabels: Record<string, string> = {
  full: 'Full coverage', partial: 'Partial coverage', tuition_only: 'Tuition only', equipment_only: 'Equipment only', stipend: 'Stipend',
};

const providerName = (opportunity: Opportunity) =>
  typeof opportunity.providerId === 'string'
    ? 'Verified provider'
    : opportunity.providerId.providerProfile?.organizationName || opportunity.providerId.fullName;

const formatAmount = (opportunity: Opportunity) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: opportunity.currency || 'LKR', maximumFractionDigits: 0 }).format(opportunity.amount || 0);

const date = (value: string) =>
  new Date(value).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });

/** Return Tailwind colour class based on match percentage */
const matchColor = (pct: number) => {
  if (pct >= 80) return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-500/20' };
  if (pct >= 60) return { bg: 'bg-primary-100', text: 'text-primary-700', border: 'border-primary-200', ring: 'ring-primary-500/20' };
  if (pct >= 40) return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-500/20' };
  return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', ring: 'ring-gray-400/20' };
};

const isMatched = (opp: Opportunity | MatchedOpportunity): opp is MatchedOpportunity =>
  'matchPercentage' in opp;

const OpportunityFeedPage = () => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const [opportunities, setOpportunities] = useState<(Opportunity | MatchedOpportunity)[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'earn' | 'learn' | 'experience' | 'financial' | 'matched'>('all');
  const [type, setType] = useState<OpportunityType | ''>('');
  const [skill, setSkill] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (activeTab === 'matched' && isStudent) {
          const result = await getMatchedOpportunities();
          setOpportunities(result.opportunities);
        } else if (activeTab === 'financial' && !skill.trim() && !workMode) {
          setOpportunities(await getScholarships());
        } else {
          let typeQuery = type ? type : undefined;
          
          if (!type) {
            if (activeTab === 'financial') typeQuery = 'scholarship';
            // We can't query multiple types simultaneously with the current `type` filter. 
            // The backend /api/opportunities?type=job etc. supports only one.
            // But wait, if activeTab is earn/learn/experience we can fetch all and filter in frontend,
            // OR update backend to support multiple types? 
            // For now, let's fetch all and filter in frontend if no specific `type` is chosen!
          }

          const filters = {
            ...(typeQuery ? { type: typeQuery } : {}),
            ...(skill.trim() ? { skill: skill.trim() } : {}),
            ...(workMode ? { workMode } : {}),
          };
          
          let results = await getOpportunities(filters);
          
          if (!typeQuery) {
            if (activeTab === 'earn') results = results.filter(o => ['job', 'freelance'].includes(o.type));
            if (activeTab === 'learn') results = results.filter(o => ['course', 'workshop', 'mentorship'].includes(o.type));
            if (activeTab === 'experience') results = results.filter(o => o.type === 'internship');
          }
          
          setOpportunities(results);
        }
      } catch {
        setError('We could not load opportunities right now. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [activeTab, type, skill, workMode, isStudent]);

  const switchTab = (tab: 'all' | 'earn' | 'learn' | 'experience' | 'financial' | 'matched') => {
    setActiveTab(tab);
    setType('');
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-9">
        {/* Hero Section */}
        <section className="mb-8">
          <p className="text-primary-600 text-sm font-semibold mb-2 uppercase tracking-wider">Opportunity Hub</p>
          <h1 className="text-3xl font-bold text-gray-900">Find your next practical pathway</h1>
          <p className="text-gray-500 mt-2">
            Jobs, internships, learning and dedicated scholarship support in one place.
          </p>
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-6">
          <button onClick={() => switchTab('all')} className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'all' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            All opportunities
          </button>
          <button onClick={() => switchTab('earn')} className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'earn' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            EARN <span className="text-xs font-normal opacity-70 ml-1">(Jobs)</span>
          </button>
          <button onClick={() => switchTab('experience')} className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'experience' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            EXPERIENCE <span className="text-xs font-normal opacity-70 ml-1">(Internships)</span>
          </button>
          <button onClick={() => switchTab('learn')} className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'learn' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            LEARN <span className="text-xs font-normal opacity-70 ml-1">(Mentorships, Courses)</span>
          </button>
          <button onClick={() => switchTab('financial')} className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'financial' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            FINANCIAL <span className="text-xs font-normal opacity-70 ml-1">(Scholarships)</span>
          </button>
          {isStudent && (
            <button onClick={() => switchTab('matched')} className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${activeTab === 'matched' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <Target className="w-4 h-4" />
              Matched for you
            </button>
          )}
          
          <div className="flex-1"></div>
          <Link to="/resources" className="px-4 py-3 text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-2">
            ACCESS <span className="text-xs font-normal opacity-80">(Resources)</span> <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Filters (hidden in matched tab) */}
        {activeTab !== 'matched' && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={activeTab === 'financial' ? 'scholarship' : type}
                disabled={activeTab === 'financial'}
                onChange={(e) => setType(e.target.value as OpportunityType | '')}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 text-sm text-gray-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60 appearance-none cursor-pointer"
              >
                <option value="">All types</option>
                {(Object.entries(typeLabels) as [OpportunityType, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 text-sm text-gray-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                placeholder="Filter by skill, e.g. React"
              />
            </div>
            <select
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value as WorkMode | '')}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-50 border border-gray-200 text-sm text-gray-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 appearance-none cursor-pointer"
            >
              <option value="">All work modes</option>
              <option value="remote">Remote</option>
              <option value="on-site">On-site</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </section>
        )}

        {/* Matched tab info banner */}
        {activeTab === 'matched' && !loading && (
          <div className="mb-6 p-4 bg-primary-50 border border-primary-100 rounded-2xl flex items-start gap-3 animate-fade-in">
            <Sparkles className="w-5 h-5 text-primary-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-primary-800">Opportunities matched to your profile</p>
              <p className="text-sm text-primary-600 mt-0.5">
                Sorted by relevance based on your skills, career goals, and location preferences.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-xl p-4 text-red-700 bg-red-50 border border-red-100">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <p className="text-gray-400 py-12 text-center">Loading opportunities...</p>
        ) : opportunities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-14 text-center">
            <p className="text-gray-800 font-semibold">No opportunities match these filters.</p>
            <p className="text-gray-400 text-sm mt-2">Try removing a filter or check again soon.</p>
          </div>
        ) : (
          /* Opportunity Cards Grid */
          <div className="grid lg:grid-cols-2 gap-5">
            {opportunities.map((opportunity) => {
              const TypeIcon = typeIcons[opportunity.type] || Briefcase;
              const matched = isMatched(opportunity);
              const mc = matched ? matchColor(opportunity.matchPercentage) : null;

              return (
                <article
                  key={opportunity._id}
                  className={`bg-white rounded-2xl border shadow-sm p-6 flex flex-col transition-all duration-200 hover:shadow-md hover:border-gray-200 ${
                    opportunity.type === 'scholarship' ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100'
                  }`}
                >
                  {/* Header Row */}
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        opportunity.type === 'scholarship' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {typeLabels[opportunity.type]}
                      </span>
                      <span className="text-xs text-gray-400">{opportunity.workMode.replace('-', ' ')}</span>
                    </div>

                    {/* Match Badge */}
                    {matched && mc && (
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ${mc.bg} ${mc.text} ${mc.ring}`}>
                        <Target className="w-3.5 h-3.5" />
                        {opportunity.matchPercentage}% Match
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-bold text-gray-900">{opportunity.title}</h2>
                  <p className="text-sm text-primary-600 mt-1">{providerName(opportunity)}</p>

                  {/* Scholarship specifics */}
                  {opportunity.type === 'scholarship' ? (
                    <div className="my-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-primary-50 border border-primary-100 p-3">
                        <p className="text-xs text-gray-500">Award amount</p>
                        <p className="text-lg font-bold text-gray-900">{formatAmount(opportunity)}</p>
                      </div>
                      <div className="rounded-xl bg-primary-50 border border-primary-100 p-3">
                        <p className="text-xs text-gray-500">Coverage</p>
                        <p className="text-sm font-bold text-gray-900 mt-1">
                          {coverageLabels[opportunity.coverageType || '']}
                        </p>
                      </div>
                      <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Deadline: <strong>{date(opportunity.applicationDeadline)}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-4 line-clamp-3">{opportunity.description}</p>
                  )}

                  {/* Matched Skills Preview */}
                  {matched && opportunity.matchedSkills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {opportunity.matchedSkills.slice(0, 5).map((s) => (
                        <span key={s} className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                          ✓ {s}
                        </span>
                      ))}
                      {opportunity.missingSkills.slice(0, 2).map((s) => (
                        <span key={s} className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 border border-red-100 font-medium">
                          ✗ {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-auto pt-5 flex flex-wrap items-center justify-between gap-3">
                    {!matched && (
                      <div className="flex flex-wrap gap-1.5">
                        {opportunity.requiredSkills.slice(0, 4).map((skillName) => (
                          <span key={skillName} className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600">
                            {skillName}
                          </span>
                        ))}
                      </div>
                    )}
                    <Link
                      to={`/opportunities/${opportunity._id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors group ml-auto"
                    >
                      View details
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default OpportunityFeedPage;
