import { ArrowDown, ArrowRight, Check } from 'lucide-react';

const ComparisonSection = () => {
  return (
    <section className="py-24 bg-surface-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-4">
            From scattered opportunities to connected access.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">

          {/* TODAY */}
          <div className="bg-white p-8 rounded-3xl border border-gray-200 relative">
            <div className="absolute top-6 right-6 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold uppercase tracking-wider">
              Today
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-xl">😟</span>
              </div>
              <p className="font-bold text-surface-900 mb-6">Student needs an opportunity</p>

              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Searches:</p>

              <div className="space-y-2 w-full mb-6">
                {['Facebook', 'WhatsApp', 'Google', 'Company websites', 'Friends', 'Notice boards'].map((source, i) => (
                  <div key={i} className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-600 font-medium">
                    {source}
                  </div>
                ))}
              </div>

              <ArrowDown className="w-6 h-6 text-gray-300 mb-4" />

              <div className="px-6 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 font-bold">
                Scattered information.
              </div>
            </div>
          </div>

          {/* TECHBRIDGE */}
          <div className="bg-white p-8 rounded-3xl border-2 border-primary-200 shadow-lg shadow-primary-100/30 relative">
            <div className="absolute top-6 right-6 px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-bold uppercase tracking-wider">
              TechBridge
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-xl">🚀</span>
              </div>
              <p className="font-bold text-surface-900 mb-6">Student</p>

              <ArrowDown className="w-6 h-6 text-primary-300 mb-4" />

              <div className="px-8 py-4 bg-surface-900 text-white rounded-2xl font-bold shadow-lg mb-6">
                One Platform
              </div>

              <ArrowDown className="w-6 h-6 text-primary-300 mb-4" />

              <div className="grid grid-cols-2 gap-3 w-full mb-6">
                {['Earn', 'Learn', 'Experience', 'Access'].map((item, i) => (
                  <div key={i} className="px-4 py-3 bg-primary-50 border border-primary-100 rounded-xl text-primary-700 font-bold text-sm flex items-center gap-2 justify-center">
                    <Check className="w-4 h-4" />
                    {item}
                  </div>
                ))}
              </div>

              <ArrowDown className="w-6 h-6 text-primary-300 mb-4" />

              <div className="px-6 py-3 bg-primary-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-md shadow-primary-500/20">
                Economic opportunity
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;
