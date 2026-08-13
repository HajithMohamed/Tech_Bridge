import { useMemo, useState } from 'react';
import { ExternalLink, GraduationCap, Mail, Search, UsersRound } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { academicStaff, alumniContacts, officialFacultySources, type ConnectionCategory, type FacultyConnection } from '../data/facultyConnections';

const initials = (name: string) => name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();

const connectionDescription = (connection: FacultyConnection) => {
  if (connection.category === 'academic') return connection.expertise || `${connection.department} department academic staff`;
  return [connection.programme, connection.workplace].filter(Boolean).join(' · ');
};

const FacultyConnectionsPage = () => {
  const [category, setCategory] = useState<ConnectionCategory>('academic');
  const [department, setDepartment] = useState<'all' | 'ICT' | 'ET' | 'BST' | 'MDS'>('all');
  const [query, setQuery] = useState('');

  const connections = useMemo(() => {
    const items = category === 'academic' ? academicStaff : alumniContacts;
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesDepartment = category !== 'academic' || department === 'all' || item.department === department;
      const searchableText = [item.name, item.role, item.department, item.expertise, item.programme, item.workplace].filter(Boolean).join(' ').toLowerCase();
      return matchesDepartment && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [category, department, query]);

  const switchCategory = (nextCategory: ConnectionCategory) => {
    setCategory(nextCategory);
    setDepartment('all');
    setQuery('');
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-9">
        <section className="rounded-3xl bg-gradient-to-br from-surface-900 via-primary-950 to-primary-800 px-6 py-10 sm:px-10 text-white shadow-xl shadow-primary-950/20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-200">Faculty community</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Connect with academic staff and alumni</h1>
          <p className="mt-3 max-w-3xl text-primary-100 leading-7">Find publicly listed Faculty of Technology contacts and the Alumni Association committee. TechBridge only shows official information published by the University of Ruhuna Faculty of Technology.</p>
        </section>

        <section className="mt-7 flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Connection type">
            <button type="button" role="tab" aria-selected={category === 'academic'} onClick={() => switchCategory('academic')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${category === 'academic' ? 'bg-primary-600 text-white' : 'bg-surface-50 text-gray-600 hover:bg-primary-50 hover:text-primary-700'}`}><GraduationCap className="h-4 w-4" />Academic staff</button>
            <button type="button" role="tab" aria-selected={category === 'alumni'} onClick={() => switchCategory('alumni')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${category === 'alumni' ? 'bg-primary-600 text-white' : 'bg-surface-50 text-gray-600 hover:bg-primary-50 hover:text-primary-700'}`}><UsersRound className="h-4 w-4" />Alumni network</button>
          </div>
          <label className="relative block sm:w-80"><span className="sr-only">Search directory</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={category === 'academic' ? 'Search name, subject or department' : 'Search name, role or company'} className="w-full rounded-xl border border-gray-200 bg-surface-50 py-2.5 pl-9 pr-4 text-sm text-gray-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20" /></label>
        </section>

        {category === 'academic' && <div className="mt-5 flex flex-wrap gap-2"><span className="self-center mr-1 text-sm font-semibold text-gray-600">Department:</span>{(['all', 'ICT', 'ET', 'BST', 'MDS'] as const).map((value) => <button key={value} type="button" onClick={() => setDepartment(value)} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${department === value ? 'bg-primary-100 text-primary-800' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{value === 'all' ? 'All listed' : value}</button>)}</div>}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {connections.map((connection) => <ConnectionCard key={connection.id} connection={connection} />)}
        </section>

        {connections.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">No matching public profiles were found. Try a different search.</div>}

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          <p className="font-bold">Public directory notice</p>
          <p className="mt-1">Contact details are shown only when they are publicly available on the Faculty website. Alumni contact is routed through the official Alumni Association unless an alumnus has chosen to publish their own professional contact. Please use these contacts respectfully and only for academic or career-related enquiries.</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-semibold text-amber-800">
            <a className="inline-flex items-center gap-1 hover:underline" href={officialFacultySources.academicStaff} target="_blank" rel="noreferrer">ICT staff source <ExternalLink className="h-3.5 w-3.5" /></a>
            <a className="inline-flex items-center gap-1 hover:underline" href={officialFacultySources.engineeringStaff} target="_blank" rel="noreferrer">ET staff source <ExternalLink className="h-3.5 w-3.5" /></a>
            <a className="inline-flex items-center gap-1 hover:underline" href={officialFacultySources.biosystemsStaff} target="_blank" rel="noreferrer">BST staff source <ExternalLink className="h-3.5 w-3.5" /></a>
            <a className="inline-flex items-center gap-1 hover:underline" href={officialFacultySources.multidisciplinaryStaff} target="_blank" rel="noreferrer">MDS staff source <ExternalLink className="h-3.5 w-3.5" /></a>
            <a className="inline-flex items-center gap-1 hover:underline" href={officialFacultySources.alumni} target="_blank" rel="noreferrer">Alumni Association source <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
        </section>
      </main>
    </div>
  );
};

const ConnectionCard = ({ connection }: { connection: FacultyConnection }) => {
  const isAcademic = connection.category === 'academic';
  const contactEmail = connection.email || officialFacultySources.alumniEmail;
  const contactLabel = connection.email ? 'Email profile' : 'Contact Alumni Association';

  return <article className="flex min-h-64 flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md">
    <div className="flex items-start gap-3">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-bold ${isAcademic ? 'bg-primary-100 text-primary-700' : 'bg-accent-100 text-accent-700'}`}>{initials(connection.name)}</div>
      <div className="min-w-0"><h2 className="font-bold text-gray-900 leading-5">{connection.name}</h2><p className="mt-1 text-sm text-gray-600">{connection.role}</p></div>
    </div>
    <div className="mt-5 space-y-2 text-sm text-gray-600"><p className="inline-flex rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{isAcademic ? `${connection.department} department` : 'Alumni Association committee'}</p><p className="leading-6">{connectionDescription(connection)}</p></div>
    <a href={`mailto:${contactEmail}`} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-100"><Mail className="h-4 w-4" />{contactLabel}</a>
  </article>;
};

export default FacultyConnectionsPage;
