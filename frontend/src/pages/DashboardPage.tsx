import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LogOut, User, Building, GraduationCap, 
  Search, Edit3, BookOpen, Rocket, Plus, 
  FileText, Wrench, Inbox, Users, CheckCircle, 
  BarChart, Shield, Target, Send, Briefcase, Package
} from 'lucide-react';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const getRoleBadge = () => {
    const styles: Record<string, string> = {
      student: 'bg-primary-100 text-primary-700 border-primary-200',
      provider: 'bg-secondary-100 text-secondary-700 border-secondary-200',
      admin: 'bg-accent-100 text-accent-700 border-accent-200',
    };
    return styles[user.role] || styles.student;
  };

  const getRoleIcon = () => {
    if (user.role === 'student') return <GraduationCap className="w-5 h-5" />;
    if (user.role === 'provider') return <Building className="w-5 h-5" />;
    return <Shield className="w-5 h-5" />;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getRoleDescription = () => {
    switch (user.role) {
      case 'student':
        return 'Discover opportunities, build skills, and connect with mentors.';
      case 'provider':
        return 'Publish opportunities, connect with talented students, and grow your network.';
      case 'admin':
        return 'Manage the platform, monitor activity, and ensure quality.';
      default:
        return '';
    }
  };

  // Role-specific quick stats
  const getQuickStats = () => {
    if (user.role === 'student') {
      return [
        { label: 'Opportunities Matched', value: '—', icon: Target, color: 'text-primary-600', bg: 'bg-primary-100' },
        { label: 'Applications Sent', value: '0', icon: Send, color: 'text-secondary-600', bg: 'bg-secondary-100' },
        { label: 'Skills Listed', value: '—', icon: Rocket, color: 'text-accent-600', bg: 'bg-accent-100' },
        { label: 'Resources Accessed', value: '0', icon: Package, color: 'text-primary-600', bg: 'bg-primary-100' },
      ];
    }
    if (user.role === 'provider') {
      return [
        { label: 'Opportunities Published', value: '0', icon: Briefcase, color: 'text-secondary-600', bg: 'bg-secondary-100' },
        { label: 'Applications Received', value: '0', icon: Inbox, color: 'text-primary-600', bg: 'bg-primary-100' },
        { label: 'Students Connected', value: '0', icon: Users, color: 'text-accent-600', bg: 'bg-accent-100' },
        { label: 'Resources Listed', value: '0', icon: Wrench, color: 'text-secondary-600', bg: 'bg-secondary-100' },
      ];
    }
    // admin
    return [
      { label: 'Total Users', value: '—', icon: Users, color: 'text-primary-600', bg: 'bg-primary-100' },
      { label: 'Active Opportunities', value: '—', icon: Briefcase, color: 'text-secondary-600', bg: 'bg-secondary-100' },
      { label: 'Applications Today', value: '—', icon: BarChart, color: 'text-accent-600', bg: 'bg-accent-100' },
      { label: 'Resources Shared', value: '—', icon: Package, color: 'text-primary-600', bg: 'bg-primary-100' },
    ];
  };

  // Role-specific quick actions
  const getQuickActions = () => {
    if (user.role === 'student') {
      return [
        { label: 'Browse Opportunities', desc: 'Find jobs, internships & scholarships', icon: Search, color: 'group-hover:text-primary-600' },
        { label: 'Update Profile', desc: 'Add skills, goals & availability', icon: Edit3, color: 'group-hover:text-primary-600' },
        { label: 'Resource Hub', desc: 'Find equipment & learning resources', icon: BookOpen, color: 'group-hover:text-primary-600' },
        { label: 'Skill Development', desc: 'Discover free courses & workshops', icon: Rocket, color: 'group-hover:text-primary-600' },
      ];
    }
    if (user.role === 'provider') {
      return [
        { label: 'Post Opportunity', desc: 'Create a new job, internship or project', icon: Plus, color: 'group-hover:text-secondary-600' },
        { label: 'Manage Listings', desc: 'View and edit your opportunities', icon: FileText, color: 'group-hover:text-secondary-600' },
        { label: 'List Resources', desc: 'Offer equipment for rent/borrow/install', icon: Wrench, color: 'group-hover:text-secondary-600' },
        { label: 'View Applications', desc: 'Review student applications', icon: Inbox, color: 'group-hover:text-secondary-600' },
      ];
    }
    // admin
    return [
      { label: 'Manage Users', desc: 'View and manage all platform users', icon: Users, color: 'group-hover:text-accent-600' },
      { label: 'Review Providers', desc: 'Verify and approve provider accounts', icon: CheckCircle, color: 'group-hover:text-accent-600' },
      { label: 'Platform Analytics', desc: 'View impact dashboard and metrics', icon: BarChart, color: 'group-hover:text-accent-600' },
      { label: 'Content Moderation', desc: 'Review flagged content and reports', icon: Shield, color: 'group-hover:text-accent-600' },
    ];
  };

  return (
    <div className="min-h-screen bg-surface-50 relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50" />
      </div>

      {/* Top Navigation Bar */}
      <nav className="relative z-20 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center shadow-md">
                <span className="text-white font-bold font-heading text-lg">T</span>
              </div>
              <span className="text-xl font-bold text-surface-800 font-heading">TechBridge</span>
            </div>

            {/* User Info + Logout */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-50 border border-primary-200 flex items-center justify-center text-sm font-semibold text-primary-700">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700">{user.fullName}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-10 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {getGreeting()}, {user.fullName.split(' ')[0]}! 👋
              </h1>
              <p className="text-gray-500 text-base">
                {getRoleDescription()}
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border self-start ${getRoleBadge()}`}>
              {getRoleIcon()}
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {getQuickStats().map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${stat.bg}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4 animate-fade-in-up" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {getQuickActions().map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  className="bg-white rounded-2xl p-6 text-left border border-gray-100 transition-all duration-300 hover:shadow-md hover:border-gray-200 cursor-pointer group animate-fade-in-up"
                  style={{ animationDelay: `${(index + 4) * 100}ms`, animationFillMode: 'backwards' }}
                >
                  <Icon className={`w-8 h-8 text-gray-400 mb-4 transition-colors duration-200 ${action.color}`} />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    {action.label}
                  </h3>
                  <p className="text-sm text-gray-500">{action.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Account Info Card */}
        <div
          className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 animate-fade-in-up"
          style={{ animationDelay: '800ms', animationFillMode: 'backwards' }}
        >
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-500" />
            Account Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-surface-50 border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Full Name</p>
              <p className="text-base font-semibold text-gray-900">{user.fullName}</p>
            </div>
            <div className="p-5 rounded-xl bg-surface-50 border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Email Address</p>
              <p className="text-base font-semibold text-gray-900">{user.email}</p>
            </div>
            <div className="p-5 rounded-xl bg-surface-50 border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Member Since</p>
              <p className="text-base font-semibold text-gray-900">
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default DashboardPage;
