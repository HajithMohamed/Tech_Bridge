import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

const Hero = () => {
  return (
    <section className="relative pt-28 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      {/* Background styling elements */}
      <div className="absolute inset-0 bg-surface-50 -z-10" />
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-100/40 rounded-full blur-3xl opacity-50 -z-10 translate-x-1/3 -translate-y-1/3" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          {/* LEFT COLUMN: Copy */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm mb-6">
              <Sparkles className="w-4 h-4 text-primary-500" />
              <span className="text-xs font-semibold text-gray-700 tracking-wide uppercase">Digital Opportunity Bridge</span>
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-bold text-surface-900 leading-[1.1] tracking-tight mb-6">
              Bring <span className="text-primary-600 relative">
                Opportunities
                <span className="absolute bottom-1 left-0 w-full h-3 bg-primary-200/50 -z-10 rounded-full"></span>
              </span><br />
              to Students.
            </h1>
            
            <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-xl">
              One platform connecting students with jobs, internships, scholarships, mentors, and technical resources.
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
          
          {/* RIGHT COLUMN: Hero Image */}
          <div className="relative w-full flex items-center justify-center">
            <div className="relative w-full max-w-lg">
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary-200/30 via-emerald-100/20 to-amber-100/20 rounded-[2.5rem] blur-2xl -z-10" />
              <img 
                src="/hero-illustration.png" 
                alt="Students from various technology departments collaborating on projects" 
                className="w-full h-auto rounded-3xl shadow-2xl shadow-primary-900/10 border border-white/50"
              />
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
};

export default Hero;
