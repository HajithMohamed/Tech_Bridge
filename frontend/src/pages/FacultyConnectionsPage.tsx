import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, GraduationCap, Mail, MessageCircle, Search, UsersRound } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { academicStaff, alumniContacts, officialFacultySources, type ConnectionCategory, type FacultyConnection } from '../data/facultyConnections';
import { getCommunityMembers, type CommunityMember } from '../api/communityApi';
import { useAuth } from '../hooks/useAuth';

const initials = (name: string) => name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();
const description = (connection: FacultyConnection) => connection.category === 'academic' ? connection.expertise || `${connection.department} department academic staff` : [connection.programme, connection.workplace].filter(Boolean).join(' · ');

export default function FacultyConnectionsPage() {
  const { user } = useAuth(); const navigate = useNavigate();
  const [category, setCategory] = useState<ConnectionCategory>('academic');
  const [department, setDepartment] = useState<'all' | 'ICT' | 'ET' | 'BST' | 'MDS'>('all');
  const [query, setQuery] = useState(''); const [people, setPeople] = useState<CommunityMember[]>([]);
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!user) return;
    let live = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getCommunityMembers({ category, ...(category === 'academic' && department !== 'all' ? { department } : {}), q: query, page })
        .then((data) => { if (live) { setPeople(data.people); setPages(data.pages); setError(''); } })
        .catch(() => { if (live) { setPeople([]); setError('Unable to load verified community members. Please try again.'); } })
        .finally(() => { if (live) setLoading(false); });
    }, 200);
    return () => { live = false; window.clearTimeout(timer); };
  }, [user, category, department, query, page]);
  const connections = useMemo(() => (category === 'academic' ? academicStaff : alumniContacts).filter((item) => {
    const text = [item.name, item.role, item.department, item.expertise, item.programme, item.workplace].filter(Boolean).join(' ').toLowerCase();
    return (category !== 'academic' || department === 'all' || item.department === department) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [category, department, query]);
  const chooseCategory = (value: ConnectionCategory) => { setCategory(value); setDepartment('all'); setPage(1); };
  return <div className="min-h-screen bg-surface-50"><AppHeader /><main className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
    <section className="rounded-3xl bg-gradient-to-br from-surface-900 via-primary-950 to-primary-800 px-6 py-10 text-white">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-200">Faculty community</p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Connect with academic staff and alumni</h1>
      <p className="mt-3 max-w-3xl text-primary-100">Explore listed contacts and verified TechBridge members. Members choose whether their profiles and student messaging are available.</p>
      <Link to="/community-verification" className="mt-5 inline-block rounded-xl bg-white px-4 py-2 font-semibold text-primary-800">Claim or manage your community profile</Link>
    </section>
    <section aria-label="Community directory filters" className="mt-7 flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2"><button onClick={() => chooseCategory('academic')} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${category === 'academic' ? 'bg-primary-600 text-white' : 'bg-surface-50 text-gray-600'}`}><GraduationCap className="mr-2 inline h-4 w-4" />Academic staff</button><button onClick={() => chooseCategory('alumni')} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${category === 'alumni' ? 'bg-primary-600 text-white' : 'bg-surface-50 text-gray-600'}`}><UsersRound className="mr-2 inline h-4 w-4" />Alumni network</button></div>
      <label className="relative sm:w-80"><span className="sr-only">Search community directory</span><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={query} maxLength={100} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search the directory" className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm" /></label>
    </section>
    {category === 'academic' && <div className="mt-5 flex flex-wrap gap-2">{(['all', 'ICT', 'ET', 'BST', 'MDS'] as const).map((item) => <button key={item} onClick={() => { setDepartment(item); setPage(1); }} className={`rounded-full px-3 py-1.5 text-sm ${department === item ? 'bg-primary-100 text-primary-800' : 'bg-white text-gray-600'}`}>{item === 'all' ? 'All departments' : item}</button>)}</div>}
    <section aria-label="Verified TechBridge members" className="mt-8 space-y-4"><h2 className="text-2xl font-bold text-surface-900">Verified TechBridge members</h2>
      {!user ? <p className="text-gray-600"><Link to="/login" className="text-primary-700 underline">Sign in</Link> to discover members who have opted into the platform directory.</p> : <>
        {error && <p role="alert" className="text-red-700">{error}</p>}{loading && <p role="status">Loading verified members…</p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{people.map((person) => <article key={person.directoryId} className="space-y-3 rounded-2xl border border-primary-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Verified platform identity</p><h3 className="font-bold text-gray-900">{person.fullName}</h3><p className="text-sm text-gray-600">{person.institution}{person.department ? ` · ${person.department}` : ' · Alumni'}</p>{person.expertise.length > 0 && <p className="text-sm">Expertise: {person.expertise.join(', ')}</p>}{person.bio && <p className="text-sm text-gray-600">{person.bio}</p>}{person.availability && <p className="text-sm">Availability: {person.availability}</p>}{user.role === 'student' && person.acceptsStudentMessages ? <button onClick={() => navigate('/messages', { state: { recipientId: person._id } })} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" />Message {person.fullName}</button> : <p className="text-sm text-gray-500">{person.acceptsStudentMessages ? 'Messaging is available to students.' : 'Student messaging is paused.'}</p>}</article>)}</div>
        {!people.length && !loading && !error && <p className="text-gray-500">No verified members match these filters.</p>}
        <div className="flex items-center gap-4 text-sm"><button disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous members page</button><span>Page {page} of {pages}</span><button disabled={loading || page >= pages} onClick={() => setPage((value) => value + 1)}>Next members page</button></div>
      </>}
    </section>
    <section aria-label="Listed directory contacts" className="mt-9"><h2 className="text-2xl font-bold text-surface-900">Listed directory contacts</h2><p className="mt-2 text-sm text-gray-600">These public directory snapshots are not proof of platform membership or account ownership. Check current details through the official sources.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{connections.map((connection) => <article key={connection.id} className="flex min-h-64 flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-primary-100 text-sm font-bold text-primary-700">{initials(connection.name)}</div><div><h3 className="font-bold text-gray-900">{connection.name}</h3><p className="mt-1 text-sm text-gray-600">{connection.role}</p></div></div><div className="my-5 space-y-2 text-sm text-gray-600"><p className="inline-flex rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold">{connection.category === 'academic' ? `${connection.department} department` : 'Alumni Association contact'}</p><p className="leading-6">{description(connection)}</p></div><a href={`mailto:${connection.email || officialFacultySources.alumniEmail}`} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-700"><Mail className="h-4 w-4" />{connection.email ? 'Email listed contact' : 'Contact Alumni Association'}</a><Link to={`/community-verification?directory=${encodeURIComponent(connection.id)}`} className="mt-3 text-center text-sm text-primary-700 underline">Is this your profile? Submit a claim</Link></article>)}</div>
      {!connections.length && <p className="mt-4 text-gray-500">No listed contacts match these filters.</p>}
    </section>
    <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p className="font-bold">Community directory notice</p><p className="mt-1">In-app messaging requires a current approved claim and the member’s permission. Conversation history stays available to its participants. Administrators do not receive general access to private conversations.</p><div className="mt-3 flex flex-wrap gap-4 font-semibold"><a href={officialFacultySources.academicStaff} target="_blank" rel="noreferrer">ICT source <ExternalLink className="inline h-3.5 w-3.5" /></a><a href={officialFacultySources.alumni} target="_blank" rel="noreferrer">Alumni source <ExternalLink className="inline h-3.5 w-3.5" /></a></div></section>
  </main></div>;
}
