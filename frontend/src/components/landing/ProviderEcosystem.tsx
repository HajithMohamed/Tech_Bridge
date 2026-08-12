import { Building2, GraduationCap, BookOpen, UserCheck, Laptop, Store, Users, School } from 'lucide-react';

const providers = [
  { icon: Building2, label: 'Companies', color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { icon: GraduationCap, label: 'Scholarship Providers', color: 'text-primary-500', bg: 'bg-primary-50' },
  { icon: BookOpen, label: 'Training Providers', color: 'text-cyan-500', bg: 'bg-cyan-50' },
  { icon: UserCheck, label: 'Professionals & Mentors', color: 'text-pink-500', bg: 'bg-pink-50' },
  { icon: Laptop, label: 'Resource Providers', color: 'text-amber-500', bg: 'bg-amber-50' },
  { icon: Store, label: 'Local Businesses', color: 'text-orange-500', bg: 'bg-orange-50' },
  { icon: Users, label: 'Alumni', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { icon: School, label: 'Faculty / Academic Community', color: 'text-violet-500', bg: 'bg-violet-50' },
];

const ProviderEcosystem = () => {
  return (
    <section className="py-24 bg-surface-50 border-t border-gray-100" id="providers">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-4">
            Opportunities don't come from one place.
          </h2>
          <p className="text-xl text-gray-500 leading-relaxed">
            TechBridge connects students with the people and organizations that can create opportunities.
          </p>
        </div>

        {/* Ecosystem Visual */}
        <div className="relative max-w-4xl mx-auto">

          {/* Center Hub */}
          <div className="flex justify-center mb-12">
            <div className="relative z-10 bg-surface-900 text-white px-10 py-6 rounded-3xl shadow-2xl shadow-surface-900/20 border border-surface-800">
              <p className="text-2xl font-bold tracking-wide text-center">TECHBRIDGE</p>
              <p className="text-xs text-gray-400 text-center mt-1">Digital Opportunity Bridge</p>
            </div>
          </div>

          {/* Provider Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {providers.map((provider, idx) => {
              const Icon = provider.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center relative group"
                >
                  {/* Connector line */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-px h-4 bg-gray-200 group-hover:bg-primary-300 transition-colors" />

                  <div className={`w-12 h-12 rounded-xl ${provider.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-6 h-6 ${provider.color}`} />
                  </div>
                  <p className="text-sm font-bold text-surface-900 leading-tight">{provider.label}</p>
                </div>
              );
            })}
          </div>

          {/* Disclaimer */}
          <p className="text-center text-sm text-gray-400 mt-10 max-w-lg mx-auto">
            Opportunity providers can connect with students through TechBridge to post jobs, mentorships, resources, and more.
          </p>

        </div>
      </div>
    </section>
  );
};

export default ProviderEcosystem;
