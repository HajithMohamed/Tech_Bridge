import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-surface-900 border-t border-surface-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
          
          {/* Brand */}
          <div className="text-center md:text-left">
            <Link to="/" className="text-2xl font-bold tracking-tight inline-block">
              TECH<span className="text-primary-400">BRIDGE</span>
            </Link>
            <p className="mt-3 text-sm text-gray-400 max-w-xs mx-auto md:mx-0">
              Digital Opportunity Bridge for Students.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex gap-8 sm:gap-16 text-center md:text-left">
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Platform</h4>
              <ul className="space-y-2">
                <li><a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#opportunities" className="text-sm text-gray-400 hover:text-white transition-colors">Opportunities</a></li>
                <li><Link to="/connections" className="text-sm text-gray-400 hover:text-white transition-colors">Academic & Alumni</Link></li>
                <li><Link to="/register" className="text-sm text-primary-400 hover:text-primary-300 font-medium transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Contact</h4>
              <ul className="space-y-2">
                <li className="text-sm text-gray-400">techbridge@faculty.edu</li>
                <li className="text-sm text-gray-400">Faculty of Technology</li>
                <li><Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors mt-2 inline-block">Sign In</Link></li>
              </ul>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-surface-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-500">&copy; 2026 TechBridge. Faculty of Technology.</p>
          <p className="text-xs text-gray-600">Connecting students with opportunities.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
