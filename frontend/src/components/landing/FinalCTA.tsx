import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const FinalCTA = () => {
  return (
    <section className="py-28 md:py-36 bg-surface-900 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary-800/20 via-transparent to-transparent -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
          Your next opportunity could be<br />
          <span className="text-primary-400">closer than you think.</span>
        </h2>

        <p className="text-lg text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
          Discover opportunities, build skills, gain experience and connect with the people who can help you move forward.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Link
            to="/register?role=student"
            className="inline-flex justify-center items-center gap-2 px-8 py-4 rounded-xl bg-primary-500 text-white font-semibold text-lg hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/20 group"
          >
            Join as a Student
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/register?role=provider"
            className="inline-flex justify-center items-center gap-2 px-8 py-4 rounded-xl bg-white/10 text-white border border-white/15 font-semibold text-lg hover:bg-white/15 transition-colors"
          >
            Become a Provider
          </Link>
        </div>

        <p className="text-sm text-gray-500">
          TechBridge — Digital Opportunity Bridge for Students of the Faculty of Technology
        </p>
      </div>
    </section>
  );
};

export default FinalCTA;
