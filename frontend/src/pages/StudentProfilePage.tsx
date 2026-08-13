import { useState, type FormEvent } from 'react';
import axios from 'axios';

import { updateStudentProfile } from '../api/authApi';
import { useAuth } from '../hooks/useAuth';
import type { StudentProfile } from '../types';

const splitTags = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const initialForm = (profile?: StudentProfile) => ({
  institution: profile?.institution || '', degree: profile?.degree || 'ICT' as StudentProfile['degree'], studyYear: profile?.studyYear || 1, location: profile?.location || '',
  skills: profile?.skills.join(', ') || '', careerGoal: profile?.careerGoal || '', availabilityHours: profile?.availabilityHours?.toString() || '',
  preferredWorkType: profile?.preferredWorkType || 'flexible' as NonNullable<StudentProfile['preferredWorkType']>, learningGoals: profile?.learningGoals?.join(', ') || '',
  certifications: profile?.certifications?.join(', ') || '', portfolioUrl: profile?.portfolioUrl || '',
});

const StudentProfilePage = () => {
  const { user, updateStoredUser } = useAuth();
  const [form, setForm] = useState(() => initialForm(user?.studentProfile));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const profile: StudentProfile = {
        institution: form.institution, degree: form.degree, studyYear: Number(form.studyYear), location: form.location || undefined,
        skills: splitTags(form.skills), careerGoal: form.careerGoal || undefined,
        availabilityHours: form.availabilityHours ? Number(form.availabilityHours) : undefined,
        preferredWorkType: form.preferredWorkType, learningGoals: splitTags(form.learningGoals), certifications: splitTags(form.certifications), portfolioUrl: form.portfolioUrl || undefined,
      };
      const updated = await updateStudentProfile(profile);
      updateStoredUser(updated); setNotice('Your profile is up to date. Your matches will now use these details.');
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message || 'Unable to save your profile.' : 'Unable to save your profile.');
    } finally { setSaving(false); }
  };

  return <div className="min-h-screen bg-surface-50"><main className="max-w-4xl mx-auto px-4 sm:px-6 py-9">
    <section className="mb-7"><p className="text-primary-600 text-sm font-semibold uppercase tracking-wider">Student profile</p><h1 className="text-3xl font-bold text-gray-900 mt-2">Build the profile that powers your matches</h1><p className="text-gray-500 mt-2">Keep your skills, goals, availability and portfolio current so providers can understand your strengths.</p></section>
    {error && <Message color="red" text={error} />}{notice && <Message color="green" text={notice} />}
    <form className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6" onSubmit={submit}>
      <div className="grid sm:grid-cols-3 gap-4"><Field label="Institution"><input required className="profile-input" value={form.institution} onChange={(e) => update('institution', e.target.value)} /></Field><Field label="Programme"><select className="profile-input" value={form.degree} onChange={(e) => update('degree', e.target.value as StudentProfile['degree'])}><option value="ICT">ICT</option><option value="ET">Engineering Technology</option><option value="BST">Biosystems Technology</option><option value="other">Other</option></select></Field><Field label="Study year"><input required min={1} max={6} type="number" className="profile-input" value={form.studyYear} onChange={(e) => update('studyYear', Number(e.target.value))} /></Field></div>
      <div className="grid sm:grid-cols-2 gap-4"><Field label="Location"><input className="profile-input" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="e.g. Kandy" /></Field><Field label="Career goal"><input className="profile-input" value={form.careerGoal} onChange={(e) => update('careerGoal', e.target.value)} placeholder="e.g. Frontend developer" /></Field></div>
      <Field label="Skills and interests"><input required className="profile-input" value={form.skills} onChange={(e) => update('skills', e.target.value)} placeholder="HTML, CSS, React, Canva" /><p className="help-text">Separate each skill with a comma.</p></Field>
      <div className="grid sm:grid-cols-2 gap-4"><Field label="Available hours each week"><input className="profile-input" min={0} max={168} type="number" value={form.availabilityHours} onChange={(e) => update('availabilityHours', e.target.value)} placeholder="e.g. 10" /></Field><Field label="Preferred work type"><select className="profile-input" value={form.preferredWorkType} onChange={(e) => update('preferredWorkType', e.target.value as NonNullable<StudentProfile['preferredWorkType']>)}><option value="flexible">Flexible</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="on-site">On-site</option></select></Field></div>
      <Field label="Learning goals"><input className="profile-input" value={form.learningGoals} onChange={(e) => update('learningGoals', e.target.value)} placeholder="React, UI/UX, cloud computing" /><p className="help-text">Optional. Add goals separated by commas.</p></Field>
      <Field label="Certifications"><input className="profile-input" value={form.certifications} onChange={(e) => update('certifications', e.target.value)} placeholder="AWS Cloud Practitioner, Google UX Design" /></Field>
      <Field label="Portfolio URL"><input className="profile-input" type="url" value={form.portfolioUrl} onChange={(e) => update('portfolioUrl', e.target.value)} placeholder="https://github.com/your-name" /></Field>
      <button disabled={saving} className="rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 px-5 py-3 font-semibold text-white shadow-lg shadow-primary-500/20 hover:opacity-90 transition-opacity disabled:opacity-50">{saving ? 'Saving profile...' : 'Save profile'}</button>
    </form>
  </main></div>;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block text-sm font-semibold text-gray-700">{label}<div className="mt-1.5">{children}</div></label>;
const Message = ({ color, text }: { color: 'red' | 'green'; text: string }) => <div className={`mb-5 rounded-xl border p-4 text-sm ${color === 'red' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{text}</div>;

export default StudentProfilePage;

