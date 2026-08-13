import { useState } from 'react';
import { ArrowRight, Briefcase, GraduationCap, Banknote, Lightbulb, Users, Laptop, Wrench, Globe, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const categories = [
  {
    icon: Briefcase,
    title: 'Jobs & Freelance',
    desc: 'Part-time, remote & skill-based earning.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200'
  },
  {
    icon: GraduationCap,
    title: 'Internships',
    desc: 'Real-world industry experience.',
    color: 'text-indigo-500',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200'
  },
  {
    icon: Banknote,
    title: 'Scholarships',
    desc: 'Financial support for education.',
    color: 'text-primary-500',
    bg: 'bg-primary-50',
    border: 'border-primary-200'
  },
  {
    icon: Lightbulb,
    title: 'Training & Workshops',
    desc: 'Learn directly from professionals.',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200'
  },
  {
    icon: Users,
    title: 'Mentorship',
    desc: 'Guidance from experienced mentors.',
    color: 'text-pink-500',
    bg: 'bg-pink-50',
    border: 'border-pink-200'
  },
  {
    icon: Laptop,
    title: 'Technical Resources',
    desc: 'Borrow, rent or access equipment.',
    color: 'text-cyan-500',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200'
  },
  {
    icon: Wrench,
    title: 'Student Projects',
    desc: 'Build portfolio with real projects.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200'
  },
  {
    icon: Globe,
    title: 'Remote Opportunities',
    desc: 'Work & learn from anywhere.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    border: 'border-violet-200'
  }
];

const OpportunityCategories = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  const handleExplore = (title: string) => {
    setSelectedCategory(title);
    setShowPopup(true);
  };

  return (
    <section className="py-20 bg-white" id="opportunities">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-3">
            Whatever your next step is, start here.
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Opportunities designed for students across all departments.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((category, idx) => {
            const Icon = category.icon;
            return (
              <div 
                key={idx}
                onClick={() => handleExplore(category.title)}
                className={`group relative p-5 bg-white border ${category.border} rounded-2xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center text-center`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${category.bg} group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-7 h-7 ${category.color}`} />
                </div>
                
                <h3 className="text-sm font-bold text-surface-900 mb-1.5">
                  {category.title}
                </h3>
                
                <p className="text-xs text-gray-400 flex-grow mb-3">
                  {category.desc}
                </p>
                
                <div className="flex items-center gap-1 text-xs font-semibold text-primary-600 group-hover:text-primary-700 transition-colors">
                  Explore <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Popup Modal */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowPopup(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div 
            className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowPopup(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl">🚧</span>
            </div>
            
            <h3 className="text-xl font-bold text-surface-900 mb-2">
              Coming Soon!
            </h3>
            <p className="text-gray-500 mb-2">
              <strong className="text-surface-900">{selectedCategory}</strong> data is not yet available in the system.
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Register now to get notified when opportunities are added.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link 
                to="/register?role=student" 
                className="px-6 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors shadow-md shadow-primary-500/20 text-sm"
              >
                Register Now
              </Link>
              <button 
                onClick={() => setShowPopup(false)} 
                className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default OpportunityCategories;
