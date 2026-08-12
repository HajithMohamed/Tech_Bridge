import { ArrowRight, Briefcase, GraduationCap, Banknote, Lightbulb, Users, Laptop, Wrench, Globe } from 'lucide-react';

const categories = [
  {
    icon: Briefcase,
    title: 'Jobs & Freelance',
    desc: 'Find part-time, remote and skill-based earning opportunities.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50'
  },
  {
    icon: GraduationCap,
    title: 'Internships',
    desc: 'Gain real-world experience in your chosen field.',
    color: 'text-indigo-500',
    bg: 'bg-indigo-50'
  },
  {
    icon: Banknote,
    title: 'Scholarships',
    desc: 'Access financial support to continue your education.',
    color: 'text-primary-500',
    bg: 'bg-primary-50'
  },
  {
    icon: Lightbulb,
    title: 'Training & Workshops',
    desc: 'Learn new skills directly from industry professionals.',
    color: 'text-amber-500',
    bg: 'bg-amber-50'
  },
  {
    icon: Users,
    title: 'Mentorship',
    desc: 'Connect with experienced professionals for guidance.',
    color: 'text-pink-500',
    bg: 'bg-pink-50'
  },
  {
    icon: Laptop,
    title: 'Technical Resources',
    desc: 'Borrow, rent or access affordable laptops and equipment.',
    color: 'text-cyan-500',
    bg: 'bg-cyan-50'
  },
  {
    icon: Wrench,
    title: 'Student Projects',
    desc: 'Build your portfolio by working on local business problems.',
    color: 'text-orange-500',
    bg: 'bg-orange-50'
  },
  {
    icon: Globe,
    title: 'Remote Opportunities',
    desc: 'Work and learn from anywhere, overcoming geographic limits.',
    color: 'text-violet-500',
    bg: 'bg-violet-50'
  }
];

const OpportunityCategories = () => {
  return (
    <section className="py-24 bg-white" id="opportunities">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-16 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-4">
            Whatever your next step is, start here.
          </h2>
          <p className="text-xl text-gray-500">
            A complete ecosystem of opportunities designed specifically for students.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((category, idx) => {
            const Icon = category.icon;
            return (
              <div 
                key={idx} 
                className="group relative p-6 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${category.bg}`}>
                  <Icon className={`w-6 h-6 ${category.color}`} />
                </div>
                
                <h3 className="text-lg font-bold text-surface-900 mb-2">
                  {category.title}
                </h3>
                
                <p className="text-sm text-gray-500 flex-grow mb-6">
                  {category.desc}
                </p>
                
                <div className="mt-auto flex items-center gap-2 text-sm font-semibold text-primary-600 group-hover:text-primary-700 transition-colors">
                  Explore <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default OpportunityCategories;
