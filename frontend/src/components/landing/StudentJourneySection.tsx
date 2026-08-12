import { User, Target, AlertCircle, ArrowRight, CheckCircle2, GraduationCap, Laptop, Users, Briefcase } from 'lucide-react';

const StudentJourneySection = () => {
  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-4">
            Imagine this.
          </h2>
          <p className="text-xl text-gray-500">
            TechBridge helps students move from what they have today toward what they need next.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-8">
            
            {/* Left Side: The Student Profile */}
            <div className="lg:col-span-4 bg-surface-50 p-8 rounded-3xl border border-gray-100 flex flex-col h-full">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-bold text-surface-900">First-year ICT Student</h3>
                  <p className="text-sm text-gray-500">Looking for direction</p>
                </div>
              </div>
              
              <div className="space-y-6 flex-grow">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Current Skills</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700">HTML</span>
                    <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700">CSS</span>
                    <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700">Canva</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Target className="w-4 h-4"/> Goal</p>
                  <p className="text-surface-900 font-semibold bg-white p-3 rounded-xl border border-gray-200">
                    UI/UX + Freelance Income
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/> Problem</p>
                  <p className="text-gray-600 bg-red-50 p-3 rounded-xl border border-red-100 text-sm italic">
                    "I don't know what to learn next or where to find opportunities."
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side: The Journey */}
            <div className="lg:col-span-8 flex flex-col">
              
              <div className="flex-grow bg-white p-8 rounded-3xl border border-gray-200 shadow-xl shadow-gray-200/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full blur-3xl opacity-50 -z-10 translate-x-1/2 -translate-y-1/2"></div>
                
                <h4 className="font-bold text-surface-900 mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                  TechBridge suggests:
                </h4>

                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  <div className="bg-surface-50 p-4 rounded-xl border border-gray-100 flex items-start gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg text-primary-600 mt-0.5"><GraduationCap className="w-4 h-4"/></div>
                    <div>
                      <p className="font-semibold text-sm text-surface-900">UI/UX training</p>
                      <p className="text-xs text-gray-500">Foundational skills course</p>
                    </div>
                  </div>

                  <div className="bg-surface-50 p-4 rounded-xl border border-gray-100 flex items-start gap-3">
                    <div className="p-2 bg-pink-100 rounded-lg text-pink-600 mt-0.5"><Users className="w-4 h-4"/></div>
                    <div>
                      <p className="font-semibold text-sm text-surface-900">Industry Mentor</p>
                      <p className="text-xs text-gray-500">Guidance and feedback</p>
                    </div>
                  </div>

                  <div className="bg-surface-50 p-4 rounded-xl border border-gray-100 flex items-start gap-3">
                    <div className="p-2 bg-cyan-100 rounded-lg text-cyan-600 mt-0.5"><Laptop className="w-4 h-4"/></div>
                    <div>
                      <p className="font-semibold text-sm text-surface-900">Affordable Laptop</p>
                      <p className="text-xs text-gray-500">Access to design software</p>
                    </div>
                  </div>

                  <div className="bg-surface-50 p-4 rounded-xl border border-gray-100 flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600 mt-0.5"><Briefcase className="w-4 h-4"/></div>
                    <div>
                      <p className="font-semibold text-sm text-surface-900">Freelance Gig</p>
                      <p className="text-xs text-gray-500">Design local cafe menu</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap justify-center items-center gap-2">
                      <span className="text-xs font-bold bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg border border-primary-100">NEW SKILLS</span>
                      <span className="text-gray-400 font-bold">+</span>
                      <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">REAL EXPERIENCE</span>
                      <span className="text-gray-400 font-bold">+</span>
                      <span className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-100">PORTFOLIO</span>
                    </div>
                    <div className="hidden sm:block"><ArrowRight className="w-5 h-5 text-gray-300" /></div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-surface-900 text-white rounded-xl font-bold shadow-md">
                      <CheckCircle2 className="w-4 h-4 text-primary-400" />
                      INCOME OPPORTUNITY
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

export default StudentJourneySection;
