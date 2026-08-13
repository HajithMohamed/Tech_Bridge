import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { canManageResources, enabledOpportunityTypes } from '../utils/providerCapabilities';

const AppHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = (path: string) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)) ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white';
  const signOut = () => { logout(); navigate('/'); };

  if (!user) return <nav className="sticky top-0 z-30 border-b border-white/10 bg-surface-900/95 backdrop-blur"><div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6"><Link to="/" className="font-bold text-white">TECH<span className="text-primary-400">BRIDGE</span></Link><div className="flex flex-wrap gap-1"><Link to="/opportunities" className={`rounded-lg px-3 py-2 text-sm ${active('/opportunities')}`}>Opportunities</Link><Link to="/resources" className={`rounded-lg px-3 py-2 text-sm ${active('/resources')}`}>Resources</Link><Link to="/connections" className={`rounded-lg px-3 py-2 text-sm ${active('/connections')}`}>Academic & Alumni</Link><Link to="/login" className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:text-white">Sign in</Link><Link to="/register" className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white">Get started</Link></div></div></nav>;

  const providerOpportunities = enabledOpportunityTypes(user.providerProfile).length > 0;
  const providerResources = canManageResources(user.providerProfile);
  return <nav className="sticky top-0 z-30 border-b border-white/10 bg-surface-900/95 backdrop-blur"><div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6"><Link to="/dashboard" className="font-bold text-white">TECH<span className="text-primary-400">BRIDGE</span></Link><div className="flex flex-wrap gap-1">{user.role === 'student' ? <><Link to="/dashboard" className={`rounded-lg px-3 py-2 text-sm ${active('/dashboard')}`}>Dashboard</Link><Link to="/opportunities" className={`rounded-lg px-3 py-2 text-sm ${active('/opportunities')}`}>Opportunities</Link><Link to="/resources" className={`rounded-lg px-3 py-2 text-sm ${active('/resources')}`}>Resources</Link><Link to="/my-activity" className={`rounded-lg px-3 py-2 text-sm ${active('/my-activity')}`}>My activity</Link></> : <><Link to="/provider" className={`rounded-lg px-3 py-2 text-sm ${active('/provider')}`}>Dashboard</Link>{providerOpportunities && <Link to="/provider/opportunities" className={`rounded-lg px-3 py-2 text-sm ${active('/provider/opportunities')}`}>Listings</Link>}{providerResources && <Link to="/provider/resources" className={`rounded-lg px-3 py-2 text-sm ${active('/provider/resources')}`}>Resources</Link>}<Link to="/provider/profile" className={`rounded-lg px-3 py-2 text-sm ${active('/provider/profile')}`}>Profile</Link></>}<Link to="/connections" className={`rounded-lg px-3 py-2 text-sm ${active('/connections')}`}>Community</Link><button onClick={signOut} className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white">Sign out</button></div></div></nav>;
};

export default AppHeader;
