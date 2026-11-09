import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, BookOpen, Wrench, Settings, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { updateStudentProfile } from '../api/authApi';

/* ── Static data ───────────────────────────────────────────────── */
const DEGREES = [
  { value: 'ict', label: 'ICT', desc: 'Information & Communication Technology' },
  { value: 'et',  label: 'ET',  desc: 'Engineering Technology' },
  { value: 'bst', label: 'BST', desc: 'Biosystems Technology' },
  { value: 'other', label: 'Other', desc: 'Interdisciplinary / Other' },
];

const INTEREST_TOPICS = [
  'Web Development', 'Mobile Apps', 'Machine Learning', 'Data Science',
  'Cybersecurity', 'Embedded Systems', 'IoT', 'Robotics',
  'Biotechnology', 'Sustainable Agriculture', 'Circuit Design', 'Cloud Computing',
  'UI/UX Design', 'Networking', 'Research', 'Entrepreneurship',
];

const SKILL_SUGGESTIONS = [
  'Python', 'JavaScript', 'React', 'TypeScript', 'Java', 'C++',
  'SQL', 'MongoDB', 'Node.js', 'TailwindCSS', 'Git', 'Docker',
  'MATLAB', 'AutoCAD', 'Adobe XD', 'Figma', 'Arduino', 'Linux',
];

const STEPS = [
  { label: 'Department', icon: GraduationCap },
  { label: 'Interests',  icon: BookOpen },
  { label: 'Skills',     icon: Wrench },
  { label: 'Preferences', icon: Settings },
];

/* ── Types ──────────────────────────────────────────────────────── */
interface WizardData {
  degree: string;
  institution: string;
  studyYear: number;
  bio: string;
  interests: string[];
  skills: string[];
  skillInput: string;
  careerGoal: string;
  location: string;
  workModePreference: string;
}

const defaultData: WizardData = {
  degree: '',
  institution: 'TechBridge University',
  studyYear: 1,
  bio: '',
  interests: [],
  skills: [],
  skillInput: '',
  careerGoal: '',
  location: '',
  workModePreference: '',
};

/* ── Page component ─────────────────────────────────────────────── */
const StudentProfileSetupPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(defaultData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const toggleInterest = (topic: string) =>
    set('interests', data.interests.includes(topic)
      ? data.interests.filter((i) => i !== topic)
      : [...data.interests, topic]);

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed || data.skills.includes(trimmed)) return;
    set('skills', [...data.skills, trimmed]);
  };

  const removeSkill = (skill: string) =>
    set('skills', data.skills.filter((s) => s !== skill));

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(data.skillInput);
      set('skillInput', '');
    }
  };

  const canAdvance = () => {
    if (step === 0) return Boolean(data.degree && data.institution.trim() && data.studyYear >= 1);
    if (step === 1) return data.interests.length >= 1;
    if (step === 2) return data.skills.length >= 1;
    return Boolean(data.careerGoal.trim());
  };

  const handleSubmit = async () => {
    if (!canAdvance()) return;
    setSubmitting(true);
    setError('');
    try {
      await updateStudentProfile({
        degree: data.degree,
        institution: data.institution.trim(),
        studyYear: data.studyYear,
        bio: data.bio.trim() || undefined,
        skills: data.skills,
        careerGoal: data.careerGoal.trim(),
        location: data.location.trim() || undefined,
        workModePreference: data.workModePreference || undefined,
      });
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Could not save profile. Please try again.';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-white flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <GraduationCap className="w-8 h-8 text-primary-600" aria-hidden="true" />
        <span className="text-xl font-bold text-gray-900">
          TECH<span className="text-primary-600">BRIDGE</span>
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-xl bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">

        {/* Stepper header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">
            Step {step + 1} of {STEPS.length}
          </p>
          <div className="flex items-center gap-0">
            {STEPS.map(({ label, icon: Icon }, i) => (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    i < step
                      ? 'bg-primary-600 text-white'
                      : i === step
                      ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {i < step ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] font-semibold hidden sm:block ${i === step ? 'text-primary-700' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-colors ${i < step ? 'bg-primary-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step body */}
        <div className="px-8 py-7 min-h-[320px]">
          {step === 0 && (
            <StepDepartment data={data} set={set} />
          )}
          {step === 1 && (
            <StepInterests data={data} toggle={toggleInterest} />
          )}
          {step === 2 && (
            <StepSkills
              data={data}
              set={set}
              addSkill={addSkill}
              removeSkill={removeSkill}
              handleSkillKeyDown={handleSkillKeyDown}
            />
          )}
          {step === 3 && (
            <StepPreferences data={data} set={set} />
          )}
        </div>

        {error && (
          <p className="px-8 pb-2 text-sm text-red-600">{error}</p>
        )}

        {/* Navigation footer */}
        <div className="px-8 pb-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => step > 0 && setStep(step - 1)}
            disabled={step === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => canAdvance() && setStep(step + 1)}
              disabled={!canAdvance()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Continue
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canAdvance() || submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? 'Saving…' : 'Complete Setup'}
              {!submitting && <Check className="w-4 h-4" aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm text-gray-400">
        You can update this info anytime from your profile settings.
      </p>
    </div>
  );
};

/* ── Step 1: Department ─────────────────────────────────────────── */
const StepDepartment = ({ data, set }: {
  data: WizardData;
  set: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
}) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-1">What's your department?</h2>
    <p className="text-sm text-gray-500 mb-6">We'll use this to show you the most relevant opportunities.</p>

    <div className="grid grid-cols-2 gap-3 mb-6">
      {DEGREES.map(({ value, label, desc }) => (
        <button
          key={value}
          type="button"
          onClick={() => set('degree', value)}
          className={`text-left p-4 rounded-2xl border-2 transition-all ${
            data.degree === value
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-100 bg-white hover:border-gray-200'
          }`}
        >
          <p className={`text-sm font-bold ${data.degree === value ? 'text-primary-700' : 'text-gray-800'}`}>{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
        </button>
      ))}
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="setup-year">Study year</label>
        <select
          id="setup-year"
          value={data.studyYear}
          onChange={(e) => set('studyYear', Number(e.target.value))}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 bg-white"
        >
          {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="setup-institution">Institution</label>
        <input
          id="setup-institution"
          type="text"
          value={data.institution}
          onChange={(e) => set('institution', e.target.value)}
          placeholder="Your university"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </div>
    </div>
  </div>
);

/* ── Step 2: Interests ──────────────────────────────────────────── */
const StepInterests = ({ data, toggle }: {
  data: WizardData;
  toggle: (topic: string) => void;
}) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-1">What are you interested in?</h2>
    <p className="text-sm text-gray-500 mb-6">Pick at least one topic to personalise your feed.</p>
    <div className="flex flex-wrap gap-2.5">
      {INTEREST_TOPICS.map((topic) => (
        <button
          key={topic}
          type="button"
          onClick={() => toggle(topic)}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
            data.interests.includes(topic)
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
          }`}
        >
          {topic}
        </button>
      ))}
    </div>
  </div>
);

/* ── Step 3: Skills ─────────────────────────────────────────────── */
const StepSkills = ({ data, set, addSkill, removeSkill, handleSkillKeyDown }: {
  data: WizardData;
  set: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
  addSkill: (s: string) => void;
  removeSkill: (s: string) => void;
  handleSkillKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-1">What are your skills?</h2>
    <p className="text-sm text-gray-500 mb-5">Type a skill and press Enter, or tap a suggestion.</p>

    {/* Input */}
    <input
      type="text"
      value={data.skillInput}
      onChange={(e) => set('skillInput', e.target.value)}
      onKeyDown={handleSkillKeyDown}
      placeholder="e.g. React, Python, AutoCAD…"
      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 mb-4"
    />

    {/* Added skills */}
    {data.skills.length > 0 && (
      <div className="flex flex-wrap gap-2 mb-4">
        {data.skills.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(skill)}
              className="hover:text-primary-900 transition-colors"
              aria-label={`Remove ${skill}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    )}

    {/* Suggestions */}
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick add</p>
    <div className="flex flex-wrap gap-2">
      {SKILL_SUGGESTIONS.filter((s) => !data.skills.includes(s)).slice(0, 10).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => addSkill(s)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 border border-gray-200 bg-white hover:border-primary-300 hover:text-primary-600 transition-colors"
        >
          + {s}
        </button>
      ))}
    </div>
  </div>
);

/* ── Step 4: Preferences ────────────────────────────────────────── */
const StepPreferences = ({ data, set }: {
  data: WizardData;
  set: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
}) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-1">Your preferences</h2>
    <p className="text-sm text-gray-500 mb-6">Help us match you with the right opportunities.</p>

    <div className="grid gap-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="setup-career">Career goal *</label>
        <input
          id="setup-career"
          type="text"
          value={data.careerGoal}
          onChange={(e) => set('careerGoal', e.target.value)}
          placeholder="e.g. Full-stack developer, Robotics engineer…"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="setup-location">Location (optional)</label>
        <input
          id="setup-location"
          type="text"
          value={data.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="e.g. Colombo, Sri Lanka"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">Work mode preference</label>
        <div className="grid grid-cols-3 gap-2">
          {(['remote', 'hybrid', 'on-site'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => set('workModePreference', data.workModePreference === mode ? '' : mode)}
              className={`py-2.5 rounded-xl border-2 text-xs font-bold capitalize transition-all ${
                data.workModePreference === mode
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-100 text-gray-600 hover:border-gray-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="setup-bio">Short bio (optional)</label>
        <textarea
          id="setup-bio"
          rows={3}
          value={data.bio}
          onChange={(e) => set('bio', e.target.value)}
          placeholder="Tell providers a little about yourself…"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 resize-none"
        />
      </div>
    </div>
  </div>
);

export default StudentProfileSetupPage;
