import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Briefcase, GraduationCap, Laptop, CheckCircle2 } from 'lucide-react';

const Hero = () => {
  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden">
      {/* Background styling elements */}
      <div className="absolute inset-0 bg-surface-50 -z-10" />
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-100/40 rounded-full blur-3xl opacity-50 -z-10 translate-x-1/3 -translate-y-1/3" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          {/* LEFT COLUMN: Copy */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm mb-6">
              <Sparkles className="w-4 h-4 text-primary-500" />
              <span className="text-xs font-semibold text-gray-700 tracking-wide uppercase">Digital Opportunity Bridge for Students</span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-bold text-surface-900 leading-[1.1] tracking-tight mb-6">
              Bring <span className="text-primary-600 relative">
                Opportunities
                <span className="absolute bottom-1 left-0 w-full h-3 bg-primary-200/50 -z-10 rounded-full"></span>
              </span><br />
              to Students.<br />
              <span className="text-gray-400 text-4xl lg:text-5xl mt-2 block">Not Students to Opportunities.</span>
            </h1>
            
            <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-xl">
              TechBridge connects Faculty of Technology students with jobs, internships, scholarships, learning opportunities, mentors and affordable access to technical resources — all in one place.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Link to="/register?role=student" className="inline-flex justify-center items-center gap-2 px-6 py-3.5 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-all shadow-md shadow-primary-500/20 group">
                Find Opportunities
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/register?role=provider" className="inline-flex justify-center items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-surface-900 border border-gray-200 font-semibold hover:border-gray-300 hover:bg-gray-50 transition-all shadow-sm">
                Become a Provider
              </Link>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
              <CheckCircle2 className="w-4 h-4 text-primary-500" />
              Built for Faculty of Technology students
            </div>
          </div>
          
          {/* RIGHT COLUMN: Conceptual UI Illustration */}
          <div className="relative w-full h-[500px] lg:h-[600px] perspective-1000">
            {/* Main structural box */}
            <div className="absolute inset-0 right-0 lg:-right-12 xl:-right-24 bg-white/40 backdrop-blur-xl border border-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col p-6 animate-fade-in-up">
              
              {/* Top Navbar mockup */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100/50">
                <div className="flex gap-2 items-center">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="h-4 w-24 bg-gray-100 rounded-full" />
              </div>

              {/* Student Profile block */}
              <div className="self-center flex flex-col items-center mb-8 relative z-10">
                <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center border-4 border-white shadow-sm mb-3">
                  <span className="text-2xl font-bold text-primary-600">ST</span>
                </div>
                <div className="bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm text-center">
                  <p className="text-sm font-bold text-surface-900">Student Profile</p>
                  <p className="text-xs text-primary-600 font-medium">ICT • Web Development</p>
                </div>
              </div>

              {/* Flow Arrows (Conceptual) */}
              <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-0.5 h-16 bg-gradient-to-b from-primary-200 to-transparent" />

              {/* Categories */}
              <div className="grid grid-cols-3 gap-3 mb-8 relative z-10">
                <div className="bg-white/80 p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:-translate-y-1 transition-transform">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-500"><Briefcase className="w-5 h-5" /></div>
                  <span className="text-xs font-bold text-surface-800">Earn</span>
                </div>
                <div className="bg-white/80 p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:-translate-y-1 transition-transform delay-75">
                  <div className="p-2 bg-primary-50 rounded-xl text-primary-500"><GraduationCap className="w-5 h-5" /></div>
                  <span className="text-xs font-bold text-surface-800">Learn</span>
                </div>
                <div className="bg-white/80 p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:-translate-y-1 transition-transform delay-150">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-500"><Laptop className="w-5 h-5" /></div>
                  <span className="text-xs font-bold text-surface-800">Access</span>
                </div>
              </div>

              {/* Bottom results */}
              <div className="flex justify-center gap-4 text-xs font-medium text-gray-500">
                <span className="px-3 py-1 bg-white rounded-lg border border-gray-100 shadow-sm">Internship</span>
                <span className="px-3 py-1 bg-white rounded-lg border border-gray-100 shadow-sm">Course</span>
                <span className="px-3 py-1 bg-white rounded-lg border border-gray-100 shadow-sm">Laptop</span>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -left-6 top-[25%] bg-white px-4 py-2 rounded-xl shadow-lg border border-gray-100 flex items-center gap-2 animate-float">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-bold text-surface-900">89% Match</span>
            </div>

            <div className="absolute -right-4 top-[45%] bg-surface-900 text-white px-4 py-2 rounded-xl shadow-lg border border-surface-800 flex items-center gap-2 animate-float-delayed">
              <span className="text-sm font-semibold">Scholarship</span>
            </div>

            <div className="absolute -left-2 bottom-[15%] bg-white px-4 py-2 rounded-xl shadow-lg border border-gray-100 flex items-center gap-2 animate-float">
              <Laptop className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-bold text-surface-900">Arduino Available</span>
            </div>
            
            <div className="absolute right-8 bottom-[25%] bg-white px-4 py-2 rounded-xl shadow-lg border border-gray-100 flex items-center gap-2 animate-float-delayed">
              <Briefcase className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-surface-900">Remote Project</span>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
};

export default Hero;
