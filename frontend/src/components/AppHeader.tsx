import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { canManageResources, enabledOpportunityTypes } from '../utils/providerCapabilities';

const AppHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const active = (path: string) => 
    (path === '/provider' ? location.pathname === path : location.pathname.startsWith(path)) 
      ? 'text-primary-400 font-bold border-b-2 border-primary-400' 
      : 'text-gray-400 font-medium hover:text-white hover:border-white/20 border-b-2 border-transparent';

  const providerHasOpportunities = enabledOpportunityTypes(user?.providerProfile).length > 0;
  const providerHasResources = canManageResources(user?.providerProfile);

  const signOut = () => { 
    logout(); 
    navigate('/login'); 
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <nav className="sticky top-0 z-50 bg-surface-900/95 backdrop-blur-md border-b border-surface-800 shadow-sm">
      {/* Accent top line matching landing page */}
      <div className="h-[3px] w-full bg-gradient-to-r from-primary-500 via-primary-400 to-emerald-400" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/dashboard" className="text-xl font-bold text-white tracking-tight">
              TECH<span className="text-primary-400">BRIDGE</span>
            </Link>
          </div>
          
          {/* Main Navigation (Tabs) */}
          <div className="hidden md:flex h-full space-x-8">
            {user?.role === 'student' && (
              <>
                <Link to="/dashboard" className={`inline-flex items-center px-1 pt-1 ${active('/dashboard')}`}>Dashboard</Link>
                <Link to="/opportunities" className={`inline-flex items-center px-1 pt-1 ${active('/opportunities')}`}>Opportunities</Link>
                <Link to="/resources" className={`inline-flex items-center px-1 pt-1 ${active('/resources')}`}>Resources</Link>
              </>
            )}
            {user?.role === 'provider' && (
              <>
                <Link to="/provider" className={`inline-flex items-center px-1 pt-1 ${active('/provider')}`}>Dashboard</Link>
                {providerHasOpportunities && (
                  <Link to="/provider/opportunities" className={`inline-flex items-center px-1 pt-1 ${active('/provider/opportunities')}`}>Listings</Link>
                )}
                {providerHasResources && (
                  <Link to="/provider/resources" className={`inline-flex items-center px-1 pt-1 ${active('/provider/resources')}`}>Resources</Link>
                )}
              </>
            )}
            <Link to="/impact" className={`inline-flex items-center px-1 pt-1 ${active('/impact')}`}>Impact</Link>
          </div>

          {/* User Profile Dropdown */}
          <div className="flex items-center relative" ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-800 transition-colors border border-transparent hover:border-surface-700"
            >
              <div className="w-9 h-9 rounded-full bg-surface-800 text-primary-400 font-bold flex items-center justify-center border border-surface-700">
                {user?.fullName ? getInitials(user.fullName) : <User className="w-4 h-4" />}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in-up origin-top-right">
                
                <div className="p-4 border-b border-gray-50 bg-surface-50">
                  <p className="font-bold text-surface-900 truncate">{user?.fullName}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${user?.role === 'student' ? 'text-emerald-500' : 'text-primary-500'}`} />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {user?.role === 'student' ? 'Student Account' : 'Provider Account'}
                    </p>
                  </div>
                </div>

                <div className="p-2 space-y-1">
                  {user?.role === 'student' && (
                    <>
                      <Link to="/my-applications" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl">My Applications</Link>
                      <Link to="/my-resource-requests" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl">My Resource Requests</Link>
                      <Link to="/student-profile" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl">Profile Settings</Link>
                    </>
                  )}
                  {user?.role === 'provider' && (
                    <>
                      {providerHasOpportunities && <Link to="/provider/applications" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl">Applications</Link>}
                      {providerHasResources && <Link to="/provider/resource-requests" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl">Resource Requests</Link>}
                      <Link to="/provider/profile" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl">Profile Settings</Link>
                    </>
                  )}
                </div>

                <div className="p-2 border-t border-gray-50">
                  <button 
                    onClick={signOut}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

export default AppHeader;
