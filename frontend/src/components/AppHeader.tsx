import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { canManageResources, enabledOpportunityTypes } from '../utils/providerCapabilities';

const AppHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const active = (path: string) => (path === '/provider' ? location.pathname === path : location.pathname.startsWith(path)) ? 'bg-primary-500/15 text-primary-200' : 'text-gray-400 hover:text-white';
  const providerHasOpportunities = enabledOpportunityTypes(user?.providerProfile).length > 0;
  const providerHasResources = canManageResources(user?.providerProfile);
  const signOut = () => { logout(); navigate('/login'); };
  const services = user?.providerProfile?.opportunityCategories || [];
  const offersOpportunities = services.some((service) => ['jobs', 'internships', 'scholarships', 'training', 'mentorship'].includes(service));
  const offersResources = services.includes('technical_resources');

  return <nav className="border-b border-white/10 bg-surface-900/80 backdrop-blur-xl sticky top-0 z-30"><div className="max-w-7xl mx-auto min-h-16 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3"><Link to="/dashboard" className="flex items-center gap-2.5 text-white font-bold"><span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 grid place-items-center">⚡</span>TechBridge</Link><div className="flex flex-wrap items-center gap-1"><Link to="/impact" className={`px-3 py-2 text-sm rounded-lg ${active('/impact')}`}>Impact</Link>{user?.role === 'student' && <><Link to="/dashboard" className={`px-3 py-2 text-sm rounded-lg ${active('/dashboard')}`}>Dashboard</Link><Link to="/opportunities" className={`px-3 py-2 text-sm rounded-lg ${active('/opportunities')}`}>Opportunities</Link><Link to="/my-applications" className={`px-3 py-2 text-sm rounded-lg ${active('/my-applications')}`}>Applications</Link><Link to="/resources" className={`px-3 py-2 text-sm rounded-lg ${active('/resources')}`}>Resource Hub</Link><Link to="/my-resource-requests" className={`px-3 py-2 text-sm rounded-lg ${active('/my-resource-requests')}`}>Requests</Link><Link to="/student-profile" className={`px-3 py-2 text-sm rounded-lg ${active('/student-profile')}`}>Profile</Link></>}{user?.role === 'provider' && <><Link to="/provider" className={`px-3 py-2 text-sm rounded-lg ${active('/provider')}`}>Dashboard</Link>{providerHasOpportunities && <><Link to="/provider/opportunities" className={`px-3 py-2 text-sm rounded-lg ${active('/provider/opportunities')}`}>Listings</Link><Link to="/provider/applications" className={`px-3 py-2 text-sm rounded-lg ${active('/provider/applications')}`}>Applications</Link></>}{providerHasResources && <><Link to="/provider/resources" className={`px-3 py-2 text-sm rounded-lg ${active('/provider/resources')}`}>Resources</Link><Link to="/provider/resource-requests" className={`px-3 py-2 text-sm rounded-lg ${active('/provider/resource-requests')}`}>Requests</Link></>}<Link to="/provider/profile" className={`px-3 py-2 text-sm rounded-lg ${active('/provider/profile')}`}>Profile</Link></>}<span className="hidden lg:block text-sm text-gray-400 px-2">{user?.fullName}</span><button onClick={signOut} className="px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5">Sign out</button></div></div></nav>;
};

export default AppHeader;
