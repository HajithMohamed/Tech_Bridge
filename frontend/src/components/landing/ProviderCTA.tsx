import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, GraduationCap, BookOpen, Users, Laptop, Wrench } from 'lucide-react';

const examples = [
  { icon: Briefcase, label: 'Post a Job' },
  { icon: GraduationCap, label: 'Offer an Internship' },
  { icon: BookOpen, label: 'Provide Training' },
  { icon: Users, label: 'Offer Mentorship' },
  { icon: Laptop, label: 'List a Resource' },
  { icon: Wrench, label: 'Publish a Student Project' },
];

const ProviderCTA = () => {
  return (
    <section className="py-24 bg-surface-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-900/30 via-transparent to-transparent -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: Copy */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 leading-tight">
              Have an opportunity<br />for a student?
            </h2>
            <p className="text-lg text-gray-300 mb-10 leading-relaxed max-w-xl">
              Companies, professionals, training providers, local businesses and resource providers can use TechBridge to connect their opportunities with students.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register?role=provider"
                className="inline-flex justify-center items-center gap-2 px-7 py-4 rounded-xl bg-primary-500 text-white font-semibold hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/20 group"
              >
                Become a Provider
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex justify-center items-center gap-2 px-7 py-4 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/15 transition-colors border border-white/10"
              >
                Learn How It Works
              </a>
            </div>
          </div>

          {/* Right: Example Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {examples.map((example, idx) => {
              const Icon = example.icon;
              return (
                <div
                  key={idx}
                  className="bg-surface-800 border border-surface-700 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-center hover:bg-surface-800/80 hover:-translate-y-1 transition-all"
                >
                  <Icon className="w-6 h-6 text-primary-400" />
                  <p className="text-sm font-semibold text-white leading-tight">{example.label}</p>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
};

export default ProviderCTA;
