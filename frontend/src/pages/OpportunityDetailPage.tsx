import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import AppHeader from '../components/AppHeader';
import { getOpportunity } from '../api/opportunityApi';
import { applyToOpportunity, getMyApplications } from '../api/applicationApi';
import { useAuth } from '../hooks/useAuth';
import type { Opportunity, SkillResource } from '../types';
import { ArrowLeft, CheckCircle, XCircle, ExternalLink, Target, BookOpen, Send } from 'lucide-react';

const coverageLabels: Record<string, string> = {
  full: 'Full coverage', partial: 'Partial coverage', tuition_only: 'Tuition only', equipment_only: 'Equipment only', stipend: 'Stipend',
};
const typeLabels: Record<string, string> = {
  job: 'Job', internship: 'Internship', scholarship: 'Scholarship', course: 'Course', freelance: 'Freelance project', workshop: 'Workshop', mentorship: 'Mentorship',
};

const providerName = (opportunity: Opportunity) =>
  typeof opportunity.providerId === 'string'
    ? 'Verified provider'
    : opportunity.providerId.providerProfile?.organizationName || opportunity.providerId.fullName;

const deadlineCountdown = (deadline: string, now: number) => {
  const milliseconds = new Date(deadline).getTime() - now;
  if (milliseconds <= 0) return 'Deadline passed';
  const days = Math.floor(milliseconds / 86_400_000);
  const hours = Math.floor((milliseconds % 86_400_000) / 3_600_000);
  return days > 0 ? `${days} day${days === 1 ? '' : 's'} left` : `${hours} hour${hours === 1 ? '' : 's'} left`;
};

/* ── Static skill → resource mapping (mirrors backend matchEngine) ── */
const SKILL_RESOURCES: Record<string, { label: string; url: string }> = {
  react: { label: 'Free React Course — freeCodeCamp', url: 'https://www.freecodecamp.org/learn/front-end-development-libraries/#react' },
  javascript: { label: 'JavaScript — MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript' },
  typescript: { label: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook/' },
  python: { label: 'Python for Everybody — Coursera', url: 'https://www.coursera.org/specializations/python' },
  nodejs: { label: 'Node.js — freeCodeCamp', url: 'https://www.freecodecamp.org/learn/back-end-development-and-apis/' },
  html: { label: 'HTML Basics — MDN', url: 'https://developer.mozilla.org/en-US/docs/Learn/HTML' },
  css: { label: 'CSS — MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn/CSS' },
  java: { label: 'Java Programming — Codecademy', url: 'https://www.codecademy.com/learn/learn-java' },
  sql: { label: 'SQL Tutorial — W3Schools', url: 'https://www.w3schools.com/sql/' },
  git: { label: 'Git & GitHub — freeCodeCamp', url: 'https://www.freecodecamp.org/news/git-and-github-for-beginners/' },
  docker: { label: 'Docker Getting Started', url: 'https://docs.docker.com/get-started/' },
  mongodb: { label: 'MongoDB University (Free)', url: 'https://university.mongodb.com/' },
  figma: { label: 'Figma for Beginners — YouTube', url: 'https://www.youtube.com/results?search_query=figma+for+beginners' },
  angular: { label: 'Angular — Official Tutorial', url: 'https://angular.io/tutorial' },
  vue: { label: 'Vue.js — Official Guide', url: 'https://vuejs.org/guide/introduction.html' },
  flutter: { label: 'Flutter — Get Started', url: 'https://flutter.dev/docs/get-started' },
  tailwind: { label: 'Tailwind CSS — Docs', url: 'https://tailwindcss.com/docs' },
  express: { label: 'Express.js — MDN Guide', url: 'https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs' },
};

const normalise = (s: string) => s.toLowerCase().replace(/[.\-_]/g, '').replace(/\s+/g, ' ').trim();

const fuzzyMatch = (a: string, b: string): boolean => {
  const na = normalise(a);
  const nb = normalise(b);
  return na === nb || na.includes(nb) || nb.includes(na);
};

const getResourceForSkill = (skill: string): SkillResource => {
  const key = normalise(skill);
  for (const [mapKey, resource] of Object.entries(SKILL_RESOURCES)) {
    if (key === normalise(mapKey) || key.includes(normalise(mapKey)) || normalise(mapKey).includes(key)) {
      return { skill, ...resource };
    }
  }
  return { skill, label: `Search free ${skill} courses`, url: `https://www.google.com/search?q=free+${encodeURIComponent(skill)}+course` };
};

const OpportunityDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const studentSkills = user?.studentProfile?.skills ?? [];

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!id) return;
    void getOpportunity(id).then(setOpportunity).catch(() => setError('This opportunity is unavailable or has closed.'));
    if (isStudent) {
      void getMyApplications()
        .then((applications) => setHasApplied(applications.some((application) => {
          const appliedOpportunityId = typeof application.opportunityId === 'string'
            ? application.opportunityId
            : application.opportunityId._id;
          return appliedOpportunityId === id;
        })))
        .catch(() => undefined);
    }
  }, [id, isStudent]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); };
  }, []);

  if (error) return (
    <Page>
      <p className="text-red-600">{error}</p>
      <Link className="inline-block mt-5 text-primary-600 font-semibold" to="/opportunities">← Back to opportunities</Link>
    </Page>
  );
  if (!opportunity) return <Page><p className="text-center text-gray-400 py-20">Loading opportunity...</p></Page>;

  const scholarship = opportunity.type === 'scholarship';
  const deadline = new Date(opportunity.applicationDeadline).toLocaleDateString('en-LK', { dateStyle: 'long' });
  const amount = new Intl.NumberFormat('en-LK', { style: 'currency', currency: opportunity.currency || 'LKR', maximumFractionDigits: 0 }).format(opportunity.amount || 0);

  // Compute skill match for the logged-in student
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  if (isStudent) {
    for (const req of opportunity.requiredSkills) {
      if (studentSkills.some((s) => fuzzyMatch(s, req))) {
        matchedSkills.push(req);
      } else {
        missingSkills.push(req);
      }
    }
  }
  const matchPct = opportunity.requiredSkills.length > 0
    ? Math.round((matchedSkills.length / opportunity.requiredSkills.length) * 100)
    : 100;

  const missingResources = missingSkills.map(getResourceForSkill);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setError('');
    try {
      await applyToOpportunity(id, message);
      setNotice('Application submitted. The provider can now review it in their portal.');
      setHasApplied(true);
      setMessage('');
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || 'Unable to submit application.' : 'Unable to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-9">
        <Link to="/opportunities" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-semibold transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to opportunities
        </Link>

        <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 mt-5">
          {/* Top Row */}
          <div className="flex flex-wrap justify-between gap-3">
            <span className={`text-sm px-3 py-1 rounded-full font-semibold ${scholarship ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
              {typeLabels[opportunity.type]}
            </span>
            <span className="text-sm text-gray-400">
              {opportunity.workMode.replace('-', ' ')} · {opportunity.location}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mt-5">{opportunity.title}</h1>
          <p className="text-primary-600 mt-2">Provided by {providerName(opportunity)}</p>

          {/* ── STUDENT SKILL MATCH SECTION ──────────────────── */}
          {isStudent && opportunity.requiredSkills.length > 0 && (
            <section className="mt-8 p-5 rounded-2xl border border-gray-100 bg-surface-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary-500" />
                  Your Skill Match
                </h3>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  matchPct >= 80 ? 'bg-emerald-100 text-emerald-700' :
                  matchPct >= 60 ? 'bg-primary-100 text-primary-700' :
                  matchPct >= 40 ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {matchPct}% Match
                </span>
              </div>

              {/* Skill Checklist */}
              <div className="space-y-2.5">
                {matchedSkills.map((skill) => (
                  <div key={skill} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-emerald-800">{skill}</span>
                    <span className="ml-auto text-xs text-emerald-600 font-medium">You have this</span>
                  </div>
                ))}
                {missingSkills.map((skill) => (
                  <div key={skill} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    <span className="text-sm font-medium text-red-800">{skill}</span>
                    <span className="ml-auto text-xs text-red-500 font-medium">Missing</span>
                  </div>
                ))}
              </div>

              {/* ── RECOMMENDED RESOURCES for missing skills ── */}
              {missingResources.length > 0 && (
                <div className="mt-6 pt-5 border-t border-gray-200">
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-primary-500" />
                    Recommended Resources to Bridge the Gap
                  </h4>
                  <div className="space-y-2">
                    {missingResources.map((res) => (
                      <a
                        key={res.skill}
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-colors group"
                      >
                        <span className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center shrink-0 text-sm font-bold">
                          {res.skill.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            Learn {res.skill}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{res.label}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary-500 shrink-0 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Scholarship details */}
          {scholarship ? (
            <section className="mt-8 space-y-6">
              <div className="grid sm:grid-cols-3 gap-3">
                <Stat label="Award amount" value={amount} />
                <Stat label="Coverage" value={coverageLabels[opportunity.coverageType || '']} />
                <Stat label="Awards available" value={String(opportunity.numberOfAwards || 0)} />
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-800">Application deadline: {deadline}</p>
                <p className="text-amber-700 text-sm mt-1">
                  {deadlineCountdown(opportunity.applicationDeadline, now)} · {opportunity.renewable ? 'Renewable award' : 'One-time award'}
                </p>
              </div>
              <section>
                <h2 className="text-lg font-bold text-gray-900">Eligibility checklist</h2>
                <ul className="mt-3 space-y-3">
                  {opportunity.eligibilityCriteria?.map((criteria) => (
                    <li key={criteria} className="flex items-start gap-3 text-gray-700">
                      <span className="shrink-0 w-5 h-5 rounded-full border border-primary-300 text-primary-500 text-xs grid place-items-center">✓</span>
                      {criteria}
                    </li>
                  ))}
                </ul>
              </section>
              <Description title="About this scholarship" value={opportunity.description} />
            </section>
          ) : (
            <section className="mt-8 space-y-6">
              
              {opportunity.type === 'internship' && (
                <div className="grid sm:grid-cols-3 gap-3 mb-6">
                  <Stat label="Duration" value={opportunity.duration || '—'} />
                  <Stat label="Compensation" value={opportunity.isPaid ? 'Paid' : 'Unpaid'} />
                  <Stat label="Preferred background" value={opportunity.preferredAcademicBackground || 'Any'} />
                </div>
              )}
              
              {(opportunity.type === 'course' || opportunity.type === 'workshop') && (
                <div className="grid sm:grid-cols-3 gap-3 mb-6">
                  <Stat label="Duration" value={opportunity.duration || '—'} />
                  <Stat label="Dates" value={`${opportunity.startDate ? new Date(opportunity.startDate).toLocaleDateString('en-LK') : '—'} to ${opportunity.endDate ? new Date(opportunity.endDate).toLocaleDateString('en-LK') : '—'}`} />
                  <Stat label="Fee" value={opportunity.isFree ? 'Free for students' : opportunity.fee ? `LKR ${opportunity.fee}` : '—'} />
                </div>
              )}

              {opportunity.type === 'mentorship' && (
                <div className="grid sm:grid-cols-2 gap-3 mb-6">
                  <Stat label="Mentor" value={opportunity.mentorName || '—'} />
                  <Stat label="Focus area" value={opportunity.mentorshipType || 'Guidance'} />
                  <Stat label="Professional field" value={opportunity.professionalField || '—'} />
                  <Stat label="Availability" value={opportunity.availability || '—'} />
                </div>
              )}
              
              {(opportunity.type === 'job' || opportunity.type === 'freelance') && opportunity.paymentInfo && (
                <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-sm text-gray-500 font-semibold mb-1">Payment Information</p>
                  <p className="text-gray-900">{opportunity.paymentInfo}</p>
                </div>
              )}

              <Description title="About this opportunity" value={opportunity.description} />
              <ServiceDetails opportunity={opportunity} />
              {!isStudent && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Required skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {opportunity.requiredSkills.map((skill) => (
                      <span key={skill} className="text-xs px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 font-medium">{skill}</span>
                    ))}
                  </div>
                </div>
              )}
              {opportunity.contactMethod && <div className="mt-6 rounded-xl border border-primary-100 bg-primary-50 p-4"><p className="text-sm font-semibold text-primary-800">Application instructions</p><p className="mt-1 text-sm text-primary-700">{opportunity.contactMethod}</p></div>}
              <p className="text-sm text-gray-400 mt-7">Application deadline: {deadline}</p>
            </section>
          )}

          {/* Application Form */}
          {isStudent && (
            <form onSubmit={submit} className="mt-8 pt-6 border-t border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Message to provider <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                className="w-full px-4 py-3 rounded-xl bg-surface-50 border border-gray-200 text-sm text-gray-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 min-h-24 resize-y"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={1000}
                placeholder="Introduce yourself and explain your interest."
              />
              <button
                disabled={submitting || hasApplied}
                className="mt-3 px-6 py-3 rounded-xl font-semibold text-sm text-white bg-primary-600 hover:bg-secondary-500 shadow-lg shadow-primary-600/20 disabled:opacity-50 cursor-pointer transition-all duration-300 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : hasApplied ? 'Applied' : 'Apply / express interest'}
              </button>
              {notice && <p className="mt-3 text-sm text-emerald-600 font-medium">{notice}</p>}
            </form>
          )}
        </article>
      </main>
    </div>
  );
};

const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-surface-50">
    <AppHeader />
    <main className="max-w-3xl mx-auto px-4 py-12 text-center">{children}</main>
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-primary-50 border border-primary-100 p-4">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="font-bold text-gray-900 mt-1">{value}</p>
  </div>
);

const ServiceDetails = ({ opportunity }: { opportunity: Opportunity }) => {
  const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString('en-LK', { dateStyle: 'medium' }) : '';
  const fee = opportunity.fee !== undefined ? new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(opportunity.fee) : '';
  if (opportunity.type === 'job' || opportunity.type === 'freelance') return opportunity.paymentInfo ? <Details title="Compensation" entries={[['Payment information', opportunity.paymentInfo]]} /> : null;
  if (opportunity.type === 'internship') return <Details title="Internship details" entries={[["Duration", opportunity.duration], ["Start date", formatDate(opportunity.startDate)], ["Paid", opportunity.isPaid === undefined ? undefined : opportunity.isPaid ? 'Yes' : 'No'], ["Preferred background", opportunity.preferredAcademicBackground]]} />;
  if (opportunity.type === 'course' || opportunity.type === 'workshop') return <Details title={`${typeLabels[opportunity.type]} details`} entries={[["Duration", opportunity.duration], ["Start date", formatDate(opportunity.startDate)], ["End date", formatDate(opportunity.endDate)], ["Fee", opportunity.isFree === true ? 'Free for students' : fee]]} />;
  if (opportunity.type === 'mentorship') return <Details title="Mentorship details" entries={[["Mentor", opportunity.mentorName], ["Field", opportunity.professionalField], ["Experience", opportunity.experience], ["Focus", opportunity.mentorshipType], ["Availability", opportunity.availability]]} />;
  return null;
};

const Details = ({ title, entries }: { title: string; entries: Array<[string, string | undefined]> }) => {
  const available = entries.filter(([, value]) => Boolean(value));
  if (!available.length) return null;
  return <section className="mt-6"><h2 className="text-lg font-bold text-gray-900">{title}</h2><dl className="mt-3 grid sm:grid-cols-2 gap-3">{available.map(([label, value]) => <div key={label} className="rounded-xl border border-gray-100 bg-surface-50 p-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-gray-800">{value}</dd></div>)}</dl></section>;
};

const Description = ({ title, value }: { title: string; value: string }) => (
  <div>
    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
    <p className="text-gray-600 leading-7 mt-2 whitespace-pre-wrap">{value}</p>
  </div>
);

export default OpportunityDetailPage;
