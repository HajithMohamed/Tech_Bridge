import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Opportunities', href: '/opportunities' },
  { label: 'Resources', href: '/resources' },
  { label: 'Community', href: '/connections' },
  { label: 'Events', href: '/events' },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed w-full z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-[72px]">

          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <GraduationCap className="w-8 h-8 text-primary-600" aria-hidden="true" />
            <span className="text-xl font-bold tracking-tight text-gray-900">
              TECH<span className="text-primary-600">BRIDGE</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                to={href}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-primary-600 transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-md shadow-primary-600/20"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="px-4 py-4 space-y-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                to={href}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
              >
                {label}
              </Link>
            ))}
            <div className="pt-4 border-t border-gray-100 mt-2 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="w-full text-center px-4 py-3 rounded-xl border border-gray-200 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="w-full text-center px-4 py-3 rounded-xl bg-primary-600 text-white text-base font-semibold hover:bg-primary-700 transition-colors shadow-md shadow-primary-600/20"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
