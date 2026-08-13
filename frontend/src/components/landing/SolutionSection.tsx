import { Briefcase, GraduationCap, Laptop, Coins, ArrowRight, ArrowLeft } from 'lucide-react';

const SolutionSection = () => {
  return (
    <section className="py-20 bg-surface-50 relative border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-3">
            One bridge. Multiple opportunities.
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            TechBridge connects students from all technology departments with organizations, professionals, and resource providers in one ecosystem.
          </p>
        </div>

        {/* Visual Flow diagram */}
        <div className="max-w-5xl mx-auto">
          <div className="relative">
            {/* Desktop Connectors */}
            <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none">
              <svg className="absolute w-full h-full" style={{ zIndex: 0 }}>
                <path d="M 250 100 L 750 100" stroke="#d9e6de" strokeWidth="2" strokeDasharray="6 6" fill="none" />
                <path d="M 250 350 L 750 350" stroke="#d9e6de" strokeWidth="2" strokeDasharray="6 6" fill="none" />
                <path d="M 250 100 L 250 350" stroke="#d9e6de" strokeWidth="2" strokeDasharray="6 6" fill="none" />
                <path d="M 750 100 L 750 350" stroke="#d9e6de" strokeWidth="2" strokeDasharray="6 6" fill="none" />
              </svg>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-20 relative z-10">
              
              {/* EARN */}
              <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-5">
                  <Coins className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-surface-900 mb-3">EARN</h3>
                <ul className="space-y-2.5 text-sm text-gray-600 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Jobs (IT, Engineering, etc.)</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Freelance Projects</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Part-time roles</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Remote work</li>
                </ul>
              </div>

              {/* LEARN */}
              <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group md:translate-y-0">
                <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-5">
                  <GraduationCap className="w-6 h-6 text-primary-500" />
                </div>
                <h3 className="text-xl font-bold text-surface-900 mb-3">LEARN</h3>
                <ul className="space-y-2.5 text-sm text-gray-600 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary-400"/> Technical Courses</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary-400"/> Hands-on Training</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary-400"/> Workshops</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary-400"/> Expert Mentors</li>
                </ul>
              </div>

              {/* EXPERIENCE */}
              <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-5">
                  <Briefcase className="w-6 h-6 text-indigo-500" />
                </div>
                <h3 className="text-xl font-bold text-surface-900 mb-3">EXPERIENCE</h3>
                <ul className="space-y-2.5 text-sm text-gray-600 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"/> Industrial Internships</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"/> Lab & Field Projects</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"/> Industry connections</li>
                </ul>
              </div>

              {/* ACCESS */}
              <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-5">
                  <Laptop className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-surface-900 mb-3">ACCESS</h3>
                <ul className="space-y-2.5 text-sm text-gray-600 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"/> Devices & Equipment</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"/> Borrow & Rent</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"/> Installments</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"/> Interest-free options</li>
                </ul>
              </div>

            </div>
            
            {/* Center TechBridge Logo for Desktop Flow */}
            <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 items-center justify-center">
              <div className="bg-surface-900 text-white px-5 py-3 rounded-xl shadow-lg font-bold text-base border-4 border-surface-50 flex flex-col items-center gap-1">
                <span>TECHBRIDGE</span>
              </div>
            </div>
            
            <div className="hidden md:block absolute top-[25%] left-1/2 -translate-x-1/2 z-20">
               <ArrowRight className="w-5 h-5 text-gray-300 -ml-16" />
            </div>
            
            <div className="hidden md:block absolute bottom-[25%] left-1/2 -translate-x-1/2 z-20">
               <ArrowLeft className="w-5 h-5 text-gray-300 ml-16" />
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

export default SolutionSection;
