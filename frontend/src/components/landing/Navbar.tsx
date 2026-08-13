import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed w-full z-50 bg-surface-900/95 backdrop-blur-md border-b border-surface-800 shadow-sm">
      {/* Accent top line */}
      <div className="h-[3px] w-full bg-gradient-to-r from-primary-500 via-primary-400 to-emerald-400" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-2xl font-bold text-white tracking-tight">
              TECH<span className="text-primary-400">BRIDGE</span>
            </Link>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">How It Works</a>
            <a href="#opportunities" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Opportunities</a>
            <Link to="/connections" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Academic & Alumni</Link>
            <a href="#providers" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">For Providers</a>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link to="/login" className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white text-sm font-semibold hover:opacity-90 transition-colors shadow-md shadow-primary-500/20">
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-400 hover:text-white focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-surface-900 border-b border-surface-800 shadow-lg">
          <div className="px-4 pt-2 pb-6 space-y-1 sm:px-3">
            <a href="#how-it-works" className="block px-3 py-3 rounded-md text-base font-medium text-gray-300 hover:bg-surface-800 hover:text-white">How It Works</a>
            <a href="#opportunities" className="block px-3 py-3 rounded-md text-base font-medium text-gray-300 hover:bg-surface-800 hover:text-white">Opportunities</a>
            <Link to="/connections" onClick={() => setIsOpen(false)} className="block px-3 py-3 rounded-md text-base font-medium text-gray-300 hover:bg-surface-800 hover:text-white">Academic & Alumni</Link>
            <a href="#providers" className="block px-3 py-3 rounded-md text-base font-medium text-gray-300 hover:bg-surface-800 hover:text-white">For Providers</a>
            <div className="pt-4 flex flex-col space-y-3">
              <Link to="/login" className="w-full text-center px-4 py-3 rounded-xl border border-surface-700 text-base font-semibold text-gray-300 hover:bg-surface-800">Sign In</Link>
              <Link to="/register" className="w-full text-center px-4 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white text-base font-semibold hover:opacity-90">Get Started</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
