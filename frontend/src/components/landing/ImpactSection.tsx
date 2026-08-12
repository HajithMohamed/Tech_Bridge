import { Coins, GraduationCap, Briefcase, Laptop, Users } from 'lucide-react';

const categories = [
  {
    icon: Coins,
    title: 'FINANCIAL',
    items: ['Income opportunities', 'Costs avoided', 'Scholarships accessed'],
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    icon: GraduationCap,
    title: 'SKILLS',
    items: ['Training accessed', 'Skills developed'],
    color: 'text-primary-500',
    bg: 'bg-primary-50',
    border: 'border-primary-100',
  },
  {
    icon: Briefcase,
    title: 'CAREER',
    items: ['Internships', 'Projects', 'Industry connections'],
    color: 'text-indigo-500',
    bg: 'bg-indigo-50',
    border: 'border-indigo-100',
  },
  {
    icon: Laptop,
    title: 'RESOURCES',
    items: ['Resources shared', 'Affordable access'],
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  {
    icon: Users,
    title: 'COMMUNITY',
    items: ['Students connected', 'Providers connected'],
    color: 'text-pink-500',
    bg: 'bg-pink-50',
    border: 'border-pink-100',
  },
];

const ImpactSection = () => {
  return (
    <section className="py-24 bg-white" id="impact">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-4">
            Measure what matters.
          </h2>
          <p className="text-xl text-gray-500">
            We measure outcomes — not just users.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {categories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div
                key={idx}
                className={`p-6 rounded-2xl bg-white border ${cat.border} shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col`}
              >
                <div className={`w-12 h-12 rounded-xl ${cat.bg} flex items-center justify-center mb-5`}>
                  <Icon className={`w-6 h-6 ${cat.color}`} />
                </div>
                <h3 className="text-sm font-bold text-surface-900 uppercase tracking-wider mb-4">{cat.title}</h3>
                <ul className="space-y-2 text-sm text-gray-500 flex-grow">
                  {cat.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${cat.bg.replace('bg-', 'bg-').replace('50', '400')} mt-1.5 shrink-0`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default ImpactSection;
