import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-surface-900 border-t border-surface-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">

          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="text-2xl font-bold tracking-tight">
              TECH<span className="text-primary-400">BRIDGE</span>
            </Link>
            <p className="mt-4 text-sm text-gray-400 leading-relaxed max-w-xs">
              Bringing opportunities to students — not students to opportunities.
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">Platform</h4>
            <ul className="space-y-3">
              <li><a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#opportunities" className="text-sm text-gray-400 hover:text-white transition-colors">Opportunities</a></li>
              <li><a href="#providers" className="text-sm text-gray-400 hover:text-white transition-colors">For Providers</a></li>
              <li><a href="#impact" className="text-sm text-gray-400 hover:text-white transition-colors">Impact</a></li>
            </ul>
          </div>

          {/* Account Links */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">Account</h4>
            <ul className="space-y-3">
              <li><Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Student Sign In</Link></li>
              <li><Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Provider Sign In</Link></li>
              <li><Link to="/register" className="text-sm text-gray-400 hover:text-white transition-colors">Get Started</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">Contact</h4>
            <ul className="space-y-3">
              <li className="text-sm text-gray-400">techbridge@faculty.edu</li>
              <li className="text-sm text-gray-400">Faculty of Technology</li>
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">&copy; 2026 TechBridge. Faculty of Technology.</p>
          <p className="text-xs text-gray-600">Digital Opportunity Bridge for Students</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
