import { UserPlus, Compass, Crosshair, MessageSquare, TrendingUp, ArrowRight } from 'lucide-react';

const steps = [
  {
    num: '01',
    title: 'CREATE',
    desc: 'Build your student profile.',
    icon: UserPlus
  },
  {
    num: '02',
    title: 'DISCOVER',
    desc: 'Explore relevant opportunities.',
    icon: Compass
  },
  {
    num: '03',
    title: 'MATCH',
    desc: 'Find opportunities based on your skills, goals and preferences.',
    icon: Crosshair
  },
  {
    num: '04',
    title: 'CONNECT',
    desc: 'Apply, request guidance or contact providers.',
    icon: MessageSquare
  },
  {
    num: '05',
    title: 'GROW',
    desc: 'Gain skills, experience and income opportunities.',
    icon: TrendingUp
  }
];

const HowItWorks = () => {
  return (
    <section className="py-24 bg-surface-50 border-t border-gray-100" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-4">
            From profile to opportunity.
          </h2>
          <p className="text-xl text-gray-500">
            TechBridge uses structured profile and opportunity information to make discovery easier.
          </p>
        </div>

        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -translate-y-1/2 -z-10" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="relative flex flex-col items-center text-center bg-white lg:bg-transparent p-6 lg:p-0 rounded-2xl shadow-sm border border-gray-100 lg:border-none lg:shadow-none">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-6 relative z-10 group-hover:-translate-y-1 transition-transform">
                    <Icon className="w-7 h-7 text-primary-500" />
                  </div>
                  
                  <span className="text-sm font-black text-primary-300 mb-2">{step.num}</span>
                  <h3 className="text-lg font-bold text-surface-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 max-w-[200px] mx-auto">{step.desc}</p>

                  {/* Mobile/Tablet Arrow */}
                  {idx < steps.length - 1 && (
                    <div className="lg:hidden absolute -bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center bg-white rounded-full border border-gray-100 shadow-sm z-20">
                      <ArrowRight className="w-4 h-4 text-gray-300 rotate-90 md:rotate-0" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};

export default HowItWorks;
