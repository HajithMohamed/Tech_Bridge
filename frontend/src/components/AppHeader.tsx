import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const AppHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const signOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-white/10 bg-surface-900/80 backdrop-blur-xl sticky top-0 z-30">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 text-white font-bold">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 grid place-items-center">⚡</span>
          TechBridge
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {user?.role !== 'provider' && <Link to="/opportunities" className={`px-3 py-2 text-sm rounded-lg ${location.pathname.startsWith('/opportunities') ? 'bg-primary-500/15 text-primary-200' : 'text-gray-400 hover:text-white'}`}>Opportunities</Link>}
          {user?.role === 'provider' && <Link to="/provider" className={`px-3 py-2 text-sm rounded-lg ${location.pathname.startsWith('/provider') ? 'bg-primary-500/15 text-primary-200' : 'text-gray-400 hover:text-white'}`}>Provider Portal</Link>}
          <span className="hidden md:block text-sm text-gray-400 px-2">{user?.fullName}</span>
          <button onClick={signOut} className="px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5">Sign out</button>
        </div>
      </div>
    </nav>
  );
};

export default AppHeader;
