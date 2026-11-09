import { useState, type FormEvent } from 'react';
import { ArrowRight, Bookmark } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Dialog from '../components/ui/Dialog';
import Field from '../components/ui/Field';
import { EmptyState, Notice, Skeleton, StatusBadge } from '../components/ui/Feedback';

// Development-only gallery; sample choices never write to an account or API.
export default function DesignSystemPage() {
  const [saved, setSaved] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true); if (displayName.trim()) setNotice('Preview updated. No account data was saved.'); };
  return <main className="tb-gallery">
    <header><h1>The TechBridge foundation</h1><p>Shared controls and campus profile choices. Synthetic design examples.</p></header>
    <Card className="tb-gallery-wide"><h2>Buttons and interactions</h2><div className="tb-gallery-row">
      <Button onClick={() => setDialogOpen(true)}>Get started <ArrowRight size={18} aria-hidden="true" /></Button>
      <Button variant="secondary" onClick={() => setNotice('Explore interaction shown in this preview.')}>Explore opportunities</Button>
      <Button variant="outline" onClick={() => setNotice('Preference action shown in this preview.')}>Save preference</Button>
      <Button variant="danger" onClick={() => setDialogOpen(true)}>Remove saved item</Button>
      <Button disabled>Unavailable</Button><Button loading>Saving…</Button>
    </div><p className="tb-help">Clear focus, loading, disabled and pressed states, with reduced-motion support.</p></Card>
    <Card><h2>Opportunity card</h2><article className="tb-gallery-example"><div className="tb-gallery-row"><div style={{ flex: 1 }}><h3>Campus media contributor</h3><p>Synthetic campus team · Sample content</p></div><Button variant="secondary" aria-label={saved ? 'Unsave sample opportunity' : 'Save sample opportunity'} aria-pressed={saved} onClick={() => setSaved(value => !value)}><Bookmark size={20} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /></Button></div>
      <div className="tb-gallery-row"><StatusBadge tone="success">Photography</StatusBadge><StatusBadge>Part-time</StatusBadge><StatusBadge>TechBridge</StatusBadge></div>
      <p>Selected activity: photography. Eligibility is checked separately.</p><Button variant="quiet" onClick={() => setDialogOpen(true)}>Why this appears</Button>
    </article><p className="tb-help" role="status">{saved ? 'Saved in this preview.' : 'No sample saved.'}</p>
      <p className="tb-help">Photography, writing and video editing can sit alongside academic interests when discovering opportunities.</p>
      <EmptyState title="Your saved opportunities" action={<Button variant="outline" onClick={() => setNotice('The sample card demonstrates saving an opportunity.')}>Explore sample card</Button>}>Save an opportunity to return to it later.</EmptyState>
    </Card>
    <Card><h2>Profile choices</h2><form className="tb-gallery-form" onSubmit={submit} noValidate>
      <Field id="preview-name" label="Profile display name" hint="Use a synthetic name for this preview." error={submitted && !displayName.trim() ? 'Add a display name before continuing.' : undefined}><input value={displayName} onChange={event => setDisplayName(event.target.value)} required /></Field>
      <Field id="preview-department" label="Academic department"><select defaultValue="ICT"><option>ICT</option><option>Engineering Technology</option><option>Biosystems Technology</option></select></Field>
      <fieldset className="tb-choice-group"><legend>Interests and extracurricular activities</legend><div className="tb-choice-grid">{['Content writing', 'Video editing', 'Photography', 'Programming'].map(activity => <label className="tb-choice" key={activity}><input type="checkbox" defaultChecked={activity === 'Photography'} />{activity}</label>)}</div></fieldset>
      <fieldset className="tb-choice-group"><legend>Work arrangement</legend><div className="tb-gallery-row">{['Remote', 'Hybrid', 'On-site'].map(work => <label className="tb-choice" key={work}><input type="radio" name="preview-work" defaultChecked={work === 'Remote'} />{work}</label>)}</div></fieldset>
      <Button type="submit">Preview preferences <ArrowRight size={18} aria-hidden="true" /></Button>
    </form></Card>
    {notice ? <div className="tb-gallery-wide"><Notice>{notice}</Notice></div> : null}
    <Card className="tb-gallery-wide tb-gallery-feedback"><h2>Feedback states</h2><Notice tone="success">Preferences updated</Notice><Notice tone="error">This section could not load. Your other information is still available.</Notice><Skeleton label="Loading example suggestions" /></Card>
    <Dialog open={dialogOpen} title="Preview details" onClose={() => setDialogOpen(false)}><p>This is synthetic sample content. Recommendations do not guarantee eligibility or acceptance.</p><Button variant="secondary" onClick={() => setDialogOpen(false)}>Close preview</Button></Dialog>
  </main>;
}
