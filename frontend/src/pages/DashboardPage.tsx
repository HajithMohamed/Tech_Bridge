import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
      student: 'bg-primary-500/20 text-primary-300 border-primary-500/30',
      provider: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
      admin: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    };
    return styles[user.role] || styles.student;
  };

  const getRoleIcon = () => {
    if (user.role === 'student') {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    }
    if (user.role === 'provider') {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    );
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
        { label: 'Opportunities Matched', value: '—', icon: '🎯', color: 'primary' },
        { label: 'Applications Sent', value: '0', icon: '📤', color: 'accent' },
        { label: 'Skills Listed', value: '—', icon: '💡', color: 'primary' },
        { label: 'Resources Accessed', value: '0', icon: '📦', color: 'accent' },
      ];
    }
    if (user.role === 'provider') {
      return [
        { label: 'Opportunities Published', value: '0', icon: '📋', color: 'accent' },
        { label: 'Applications Received', value: '0', icon: '📥', color: 'primary' },
        { label: 'Students Connected', value: '0', icon: '🤝', color: 'accent' },
        { label: 'Resources Listed', value: '0', icon: '🛠️', color: 'primary' },
      ];
    }
    // admin
    return [
      { label: 'Total Users', value: '—', icon: '👥', color: 'primary' },
      { label: 'Active Opportunities', value: '—', icon: '📋', color: 'accent' },
      { label: 'Applications Today', value: '—', icon: '📊', color: 'primary' },
      { label: 'Resources Shared', value: '—', icon: '📦', color: 'accent' },
    ];
  };

  // Role-specific quick actions
  const getQuickActions = () => {
    if (user.role === 'student') {
      return [
        { label: 'Browse Opportunities', desc: 'Find jobs, internships & scholarships', icon: '🔍' },
        { label: 'Update Profile', desc: 'Add skills, goals & availability', icon: '✏️' },
        { label: 'Resource Hub', desc: 'Find equipment & learning resources', icon: '📚' },
        { label: 'Skill Development', desc: 'Discover free courses & workshops', icon: '🚀' },
      ];
    }
    if (user.role === 'provider') {
      return [
        { label: 'Post Opportunity', desc: 'Create a new job, internship or project', icon: '➕' },
        { label: 'Manage Listings', desc: 'View and edit your opportunities', icon: '📝' },
        { label: 'List Resources', desc: 'Offer equipment for rent/borrow/install', icon: '🛠️' },
        { label: 'View Applications', desc: 'Review student applications', icon: '📩' },
      ];
    }
    // admin
    return [
      { label: 'Manage Users', desc: 'View and manage all platform users', icon: '👥' },
      { label: 'Review Providers', desc: 'Verify and approve provider accounts', icon: '✅' },
      { label: 'Platform Analytics', desc: 'View impact dashboard and metrics', icon: '📊' },
      { label: 'Content Moderation', desc: 'Review flagged content and reports', icon: '🛡️' },
    ];
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-500/8 rounded-full blur-3xl" />
      </div>

      {/* Top Navigation Bar */}
      <nav className="relative z-20 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white">TechBridge</span>
            </div>

            {/* User Info + Logout */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 border border-white/10 flex items-center justify-center text-sm font-semibold text-white">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-300">{user.fullName}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all duration-200 cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {getGreeting()}, {user.fullName.split(' ')[0]}! 👋
              </h1>
              <p className="text-gray-400 text-sm sm:text-base">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {getQuickStats().map((stat, index) => (
            <div
              key={stat.label}
              className="glass-card p-5 animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{stat.icon}</span>
                <div className={`w-2 h-2 rounded-full ${stat.color === 'primary' ? 'bg-primary-500' : 'bg-accent-500'}`} />
              </div>
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 animate-fade-in-up" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {getQuickActions().map((action, index) => (
              <button
                key={action.label}
                className="glass-card p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary-500/5 cursor-pointer group animate-fade-in-up"
                style={{ animationDelay: `${(index + 4) * 100}ms`, animationFillMode: 'backwards' }}
              >
                <span className="text-2xl block mb-3 group-hover:scale-110 transition-transform duration-300 inline-block">{action.icon}</span>
                <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-primary-300 transition-colors duration-200">
                  {action.label}
                </h3>
                <p className="text-xs text-gray-500">{action.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Account Info Card */}
        <div
          className="glass-card p-6 animate-fade-in-up"
          style={{ animationDelay: '800ms', animationFillMode: 'backwards' }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Account Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <p className="text-xs text-gray-500 mb-1">Full Name</p>
              <p className="text-sm font-medium text-white">{user.fullName}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <p className="text-xs text-gray-500 mb-1">Email</p>
              <p className="text-sm font-medium text-white">{user.email}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <p className="text-xs text-gray-500 mb-1">Member Since</p>
              <p className="text-sm font-medium text-white">
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <div
          className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-primary-500/10 to-accent-500/10 border border-primary-500/20 text-center animate-fade-in-up"
          style={{ animationDelay: '900ms', animationFillMode: 'backwards' }}
        >
          <h3 className="text-lg font-semibold text-white mb-2">
            🚀 More Features Coming Soon
          </h3>
          <p className="text-sm text-gray-400 max-w-2xl mx-auto">
            Opportunity matching, resource hub, skill-to-income connections, career guidance, and the full TechBridge experience are being built. Stay tuned!
          </p>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
