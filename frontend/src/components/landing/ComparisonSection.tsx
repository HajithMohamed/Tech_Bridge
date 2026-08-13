import { ArrowRight, Check, Search, MessageCircle, Globe, Smartphone, Users, ClipboardList, Briefcase, GraduationCap, Laptop, Coins } from 'lucide-react';

const scatteredSources = [
  { icon: Smartphone, label: 'WhatsApp', color: 'text-green-500', bg: 'bg-green-50' },
  { icon: Globe, label: 'Google', color: 'text-blue-500', bg: 'bg-blue-50' },
  { icon: MessageCircle, label: 'Facebook', color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { icon: Users, label: 'Friends', color: 'text-pink-500', bg: 'bg-pink-50' },
  { icon: ClipboardList, label: 'Notice Boards', color: 'text-amber-500', bg: 'bg-amber-50' },
  { icon: Search, label: 'Company Sites', color: 'text-gray-500', bg: 'bg-gray-100' },
];

const bridgeOutcomes = [
  { icon: Coins, label: 'Earn', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { icon: GraduationCap, label: 'Learn', color: 'text-primary-600', bg: 'bg-primary-50', border: 'border-primary-200' },
  { icon: Briefcase, label: 'Experience', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { icon: Laptop, label: 'Access', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
];

const ComparisonSection = () => {
  return (
    <section className="py-20 bg-surface-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-3">
            From scattered to connected.
          </h2>
          <p className="text-lg text-gray-500">
            Stop searching everywhere. Find everything in one place.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-center">

            {/* LEFT: Scattered (Today) */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 relative">
              <div className="absolute top-4 right-4 px-3 py-1 bg-red-50 text-red-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Today
              </div>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <span className="text-lg">😟</span>
                </div>
                <div>
                  <p className="font-bold text-surface-900 text-sm">Student searching...</p>
                  <p className="text-xs text-gray-400">Scattered across platforms</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-5">
                {scatteredSources.map((source, i) => {
                  const Icon = source.icon;
                  return (
                    <div key={i} className={`${source.bg} p-3 rounded-xl flex flex-col items-center gap-1.5 border border-gray-50`}>
                      <Icon className={`w-5 h-5 ${source.color}`} />
                      <span className="text-[10px] font-semibold text-gray-600">{source.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-xs font-bold text-red-500">❌ Scattered & confusing</span>
              </div>
            </div>

            {/* CENTER: Bridge Arrow */}
            <div className="flex md:flex-col items-center justify-center gap-2 py-4">
              <div className="hidden md:block w-px h-8 bg-gray-200" />
              <div className="bg-surface-900 text-white px-4 py-3 rounded-2xl shadow-xl font-bold text-sm border-2 border-primary-500/30 flex items-center gap-2">
                <span className="text-primary-400">⚡</span>
                <span>TECH<span className="text-primary-400">BRIDGE</span></span>
              </div>
              <ArrowRight className="w-5 h-5 text-primary-400 rotate-90 md:rotate-0" />
            </div>

            {/* RIGHT: Connected (TechBridge) */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border-2 border-primary-200 shadow-lg shadow-primary-100/30 relative">
              <div className="absolute top-4 right-4 px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                TechBridge
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                  <span className="text-lg">🚀</span>
                </div>
                <div>
                  <p className="font-bold text-surface-900 text-sm">Student connected!</p>
                  <p className="text-xs text-gray-400">Everything in one place</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {bridgeOutcomes.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className={`${item.bg} border ${item.border} p-3 rounded-xl flex items-center gap-2`}>
                      <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm`}>
                        <Icon className={`w-4 h-4 ${item.color}`} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-surface-900">{item.label}</span>
                        <div className="flex items-center gap-0.5">
                          <Check className="w-3 h-3 text-primary-500" />
                          <span className="text-[9px] text-gray-400">Available</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 rounded-xl shadow-md shadow-primary-500/20">
                <span className="text-xs font-bold text-white">✅ Connected & accessible</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

export default ComparisonSection;
