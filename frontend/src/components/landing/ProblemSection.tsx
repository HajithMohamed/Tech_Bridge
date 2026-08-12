import { ArrowDown } from 'lucide-react';

const ProblemSection = () => {
  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-4">
            The problem isn't a lack of opportunities.
          </h2>
          <p className="text-xl text-gray-500">
            It's the gap between students and those opportunities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-16">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-surface-50 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
            <span className="text-3xl font-black text-primary-200 mb-4 block">01</span>
            <h3 className="font-bold text-surface-900 mb-3 uppercase tracking-wider text-sm">Financial</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Scholarships</li>
              <li>Financial assistance</li>
              <li>Income opportunities</li>
            </ul>
          </div>
          
          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-surface-50 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
            <span className="text-3xl font-black text-primary-200 mb-4 block">02</span>
            <h3 className="font-bold text-surface-900 mb-3 uppercase tracking-wider text-sm">Skills & Learning</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Training</li>
              <li>Courses</li>
              <li>Industry skills</li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-surface-50 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
            <span className="text-3xl font-black text-primary-200 mb-4 block">03</span>
            <h3 className="font-bold text-surface-900 mb-3 uppercase tracking-wider text-sm">Career & Industry</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Internships</li>
              <li>Jobs</li>
              <li>Mentors</li>
            </ul>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl bg-surface-50 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
            <span className="text-3xl font-black text-primary-200 mb-4 block">04</span>
            <h3 className="font-bold text-surface-900 mb-3 uppercase tracking-wider text-sm">Resource Access</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Laptops</li>
              <li>Arduino</li>
              <li>Project equipment</li>
            </ul>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-2xl bg-surface-50 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
            <span className="text-3xl font-black text-primary-200 mb-4 block">05</span>
            <h3 className="font-bold text-surface-900 mb-3 uppercase tracking-wider text-sm">Information & Access</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Scattered information</li>
              <li>Limited networks</li>
              <li>Difficult discovery</li>
            </ul>
          </div>
        </div>

        {/* Synthesis */}
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center p-8 bg-surface-50 rounded-3xl border border-gray-200">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center font-bold text-surface-900 text-lg md:text-xl">
            <span>RURAL LOCATION</span>
            <span className="text-primary-400">+</span>
            <span>SCATTERED INFORMATION</span>
            <span className="text-primary-400">+</span>
            <span>LIMITED CONNECTIONS</span>
          </div>
          
          <ArrowDown className="w-8 h-8 text-gray-300 my-6" />
          
          <div className="px-8 py-4 bg-surface-900 text-white rounded-2xl font-bold text-xl tracking-wide shadow-lg border border-surface-800">
            OPPORTUNITY ACCESS GAP
          </div>
        </div>

      </div>
    </section>
  );
};

export default ProblemSection;
