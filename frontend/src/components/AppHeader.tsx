import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const AppHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = (path: string, exact = false) => (exact ? pathname === path : pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)))
    ? 'bg-white/10 text-white'
    : 'text-gray-300 hover:bg-white/5 hover:text-white';
  const signOut = () => { logout(); navigate('/'); };

  const navClass = (path: string, exact = false) => `rounded-lg px-3 py-2 text-sm ${active(path, exact)}`;

  if (!user) return (
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-surface-900/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link to="/" className="font-bold text-white">TECH<span className="text-primary-400">BRIDGE</span></Link>
        <div className="flex flex-wrap gap-1">
          <Link to="/opportunities" className={navClass('/opportunities')}>Opportunities</Link>
          <Link to="/resources" className={navClass('/resources')}>Resources</Link>
          <Link to="/connections" className={navClass('/connections')}>Academic & Alumni</Link>
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:text-white">Sign in</Link>
          <Link to="/register" className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white">Get started</Link>
        </div>
      </div>
    </nav>
  );

  return (
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-surface-900/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link to="/" className="font-bold text-white">TECH<span className="text-primary-400">BRIDGE</span></Link>
        <div className="flex flex-wrap gap-1">
          <Link to="/" className={navClass('/')}>Home</Link>
          {user.role === 'student' ? (
            <>
              <Link to="/dashboard" className={navClass('/dashboard')}>Dashboard</Link>
              <Link to="/opportunities" className={navClass('/opportunities')}>Opportunities</Link>
              <Link to="/resources" className={navClass('/resources')}>Resources</Link>
              <Link to="/my-activity" className={navClass('/my-activity')}>My activity</Link>
            </>
          ) : (
            <>
              <Link to="/provider" className={navClass('/provider', true)}>Dashboard</Link>
              <Link to="/provider/opportunities" className={navClass('/provider/opportunities')}>Listings</Link>
              <Link to="/provider/applications" className={navClass('/provider/applications')}>Applications</Link>
              <Link to="/provider/resources" className={navClass('/provider/resources')}>Resources</Link>
              <Link to="/provider/resource-requests" className={navClass('/provider/resource-requests')}>Requests</Link>
              <Link to="/provider/profile" className={navClass('/provider/profile')}>Profile</Link>
            </>
          )}
          <Link to="/connections" className={navClass('/connections')}>Community</Link>
          <button onClick={signOut} className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white">Sign out</button>
        </div>
      </div>
    </nav>
  );
};

export default AppHeader;
