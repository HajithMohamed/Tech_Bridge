import { Briefcase, GraduationCap, Laptop, Coins, ArrowRight, ArrowLeft } from 'lucide-react';

const SolutionSection = () => {
  return (
    <section className="py-24 bg-surface-50 relative border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-4">
            One bridge. Multiple opportunities.
          </h2>
          <p className="text-xl text-gray-500 leading-relaxed">
            TechBridge brings students, organizations, professionals and resource providers into one connected opportunity ecosystem.
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-24 relative z-10">
              
              {/* EARN */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
                  <Coins className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold text-surface-900 mb-4">EARN</h3>
                <ul className="space-y-3 text-gray-600 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Jobs</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Freelance</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Part-time</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/> Remote work</li>
                </ul>
              </div>

              {/* LEARN */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group md:translate-y-0">
                <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-6">
                  <GraduationCap className="w-7 h-7 text-primary-500" />
                </div>
                <h3 className="text-2xl font-bold text-surface-900 mb-4">LEARN</h3>
                <ul className="space-y-3 text-gray-600 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary-400"/> Courses</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary-400"/> Training</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary-400"/> Workshops</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary-400"/> Mentors</li>
                </ul>
              </div>

              {/* EXPERIENCE */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                  <Briefcase className="w-7 h-7 text-indigo-500" />
                </div>
                <h3 className="text-2xl font-bold text-surface-900 mb-4">EXPERIENCE</h3>
                <ul className="space-y-3 text-gray-600 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"/> Internships</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"/> Projects</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"/> Industry connections</li>
                </ul>
              </div>

              {/* ACCESS */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
                  <Laptop className="w-7 h-7 text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-surface-900 mb-4">ACCESS</h3>
                <ul className="space-y-3 text-gray-600 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"/> Resources</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"/> Borrow & Rent</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"/> Installments</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"/> Interest-free options</li>
                </ul>
              </div>

            </div>
            
            {/* Center TechBridge Logo for Desktop Flow */}
            <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 items-center justify-center">
              <div className="bg-surface-900 text-white px-6 py-4 rounded-2xl shadow-xl font-bold text-lg border-4 border-surface-50 flex flex-col items-center gap-1">
                <span>TECHBRIDGE</span>
              </div>
            </div>
            
            <div className="hidden md:block absolute top-[25%] left-1/2 -translate-x-1/2 z-20">
               <ArrowRight className="w-6 h-6 text-gray-300 -ml-16" />
            </div>
            
            <div className="hidden md:block absolute bottom-[25%] left-1/2 -translate-x-1/2 z-20">
               <ArrowLeft className="w-6 h-6 text-gray-300 ml-16" />
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

export default SolutionSection;
