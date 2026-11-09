import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, GraduationCap, Users, Laptop } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: Briefcase,     label: 'Jobs & Internships' },
  { icon: GraduationCap, label: 'Scholarships' },
  { icon: Users,         label: 'Mentorship' },
  { icon: Laptop,        label: 'Resources' },
];

const FEATURES = [
  {
    title: 'Multidisciplinary Opportunities',
    desc: 'Jobs, internships and training across ICT, ET and BST.',
  },
  {
    title: 'Personalized for You',
    desc: 'Discover opportunities based on your department and interests.',
  },
  {
    title: 'Grow Beyond the Classroom',
    desc: 'Mentorship, projects, events and a vibrant student community.',
  },
];

const Hero = () => (
  <section className="relative pt-28 pb-0 overflow-hidden bg-white">
    {/* Soft green background blob */}
    <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full bg-primary-50 -z-10 translate-x-1/3 -translate-y-1/4" />

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-6 items-end">

        {/* ── Left column ── */}
        <div className="pb-16">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs font-semibold mb-6">
            For ICT, Engineering Technology &amp; Biosystems Technology Students
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-bold leading-[1.1] tracking-tight text-gray-900 mb-5">
            Bridge Your Skills<br />
            to{' '}
            <span className="text-primary-600">Real Opportunities</span>
          </h1>

          {/* Sub-copy */}
          <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-lg">
            A unified platform for opportunities, learning, collaboration and career growth — built for TechBridge students.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25 group"
            >
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </Link>
            <Link
              to="/opportunities"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-semibold text-sm hover:border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
            >
              Explore Opportunities
            </Link>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-gray-100 shadow-sm text-sm font-medium text-gray-700"
              >
                <Icon className="w-4 h-4 text-primary-600" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right column: hero image ── */}
        <div className="relative flex items-end justify-center">
          <div className="relative w-full max-w-md lg:max-w-full">
            {/* Decorative circle behind students */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-primary-100/60 -z-10" />
            <img
              src="/hero-students.png"
              alt="Three TechBridge students from ICT, ET and BST departments"
              className="relative z-10 w-full h-auto max-h-[500px] object-contain object-bottom drop-shadow-xl"
              onError={(e) => {
                /* Fallback gradient if image missing */
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            {/* Stats badge floating top-left */}
            <div className="absolute top-8 left-0 bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3 border border-gray-100 z-20">
              <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Active Opportunities</p>
                <p className="text-lg font-bold text-gray-900">120+</p>
              </div>
            </div>
            {/* Match badge floating bottom-right */}
            <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3 border border-gray-100 z-20">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <span className="text-emerald-600 text-sm font-black">96%</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Avg. Match Score</p>
                <p className="text-sm font-bold text-gray-900">Your Profile</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ── Feature strip ── */}
    <div className="bg-white border-t border-gray-100 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        {FEATURES.map(({ title, desc }) => (
          <div key={title} className="flex items-center gap-4 py-6 px-6 group cursor-default">
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 mb-1">{title}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-primary-500 transition-colors" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Hero;
