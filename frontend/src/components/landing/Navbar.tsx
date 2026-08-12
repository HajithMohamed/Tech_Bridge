import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed w-full z-50 bg-surface-50/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-2xl font-bold text-surface-900 tracking-tight">
              TECH<span className="text-primary-500">BRIDGE</span>
            </Link>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">How It Works</a>
            <a href="#opportunities" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">Opportunities</a>
            <a href="#providers" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">For Providers</a>
            <a href="#impact" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">Impact</a>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link to="/login" className="text-sm font-semibold text-gray-700 hover:text-primary-600 transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="px-5 py-2.5 rounded-xl bg-surface-900 text-white text-sm font-semibold hover:bg-surface-800 transition-colors shadow-sm">
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-600 hover:text-surface-900 focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-b border-gray-100">
          <div className="px-4 pt-2 pb-6 space-y-1 sm:px-3">
            <a href="#how-it-works" className="block px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-600">How It Works</a>
            <a href="#opportunities" className="block px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-600">Opportunities</a>
            <a href="#providers" className="block px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-600">For Providers</a>
            <a href="#impact" className="block px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-600">Impact</a>
            <div className="pt-4 flex flex-col space-y-3">
              <Link to="/login" className="w-full text-center px-4 py-3 rounded-xl border border-gray-200 text-base font-semibold text-gray-700 hover:bg-gray-50">Sign In</Link>
              <Link to="/register" className="w-full text-center px-4 py-3 rounded-xl bg-surface-900 text-white text-base font-semibold hover:bg-surface-800">Get Started</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
