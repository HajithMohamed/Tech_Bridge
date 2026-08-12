import { Laptop, Cpu, Radio, Wrench, HandHeart, RefreshCcw, Landmark, Receipt, Sparkles } from 'lucide-react';

const ResourceAccessSection = () => {
  return (
    <section className="py-24 bg-surface-900 text-white relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-surface-800/50 -skew-x-12 translate-x-1/4 -z-10" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          <div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
              You don't always need to own it.<br />
              <span className="text-primary-400">You just need access to it.</span>
            </h2>
            <p className="text-lg text-gray-300 mb-10 leading-relaxed max-w-xl">
              Technical resources can be expensive. TechBridge helps students discover practical ways to access the equipment they need, when they need it.
            </p>

            <div className="bg-surface-800/80 backdrop-blur border border-surface-700 p-6 rounded-2xl mb-8">
              <p className="text-sm text-gray-400 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Important:</strong> TechBridge connects students with providers. Financial arrangements remain entirely between the student and provider. TechBridge itself does not provide loans or financing.
                </span>
              </p>
            </div>
            
            {/* Visual Equipment Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 aspect-square">
                <Laptop className="w-8 h-8 text-gray-400" />
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Laptop</span>
              </div>
              <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 aspect-square">
                <Cpu className="w-8 h-8 text-gray-400" />
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Arduino</span>
              </div>
              <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 aspect-square">
                <Radio className="w-8 h-8 text-gray-400" />
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Sensors</span>
              </div>
              <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 aspect-square">
                <Wrench className="w-8 h-8 text-gray-400" />
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Equipment</span>
              </div>
            </div>
          </div>

          {/* Access Methods Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="p-6 bg-surface-800 border border-surface-700 rounded-2xl hover:bg-surface-800/80 transition-colors">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <HandHeart className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-bold text-white mb-2">BORROW</h3>
              <p className="text-sm text-gray-400">Use an available resource temporarily for a project or coursework.</p>
            </div>

            <div className="p-6 bg-surface-800 border border-surface-700 rounded-2xl hover:bg-surface-800/80 transition-colors">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <RefreshCcw className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-bold text-white mb-2">SHARE</h3>
              <p className="text-sm text-gray-400">Access and pool resources collaboratively with other students.</p>
            </div>

            <div className="p-6 bg-surface-800 border border-surface-700 rounded-2xl hover:bg-surface-800/80 transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center mb-4">
                <Landmark className="w-5 h-5 text-primary-400" />
              </div>
              <h3 className="font-bold text-white mb-2">RENT</h3>
              <p className="text-sm text-gray-400">Use required equipment temporarily through affordable rental options.</p>
            </div>

            <div className="p-6 bg-surface-800 border border-surface-700 rounded-2xl hover:bg-surface-800/80 transition-colors">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                <Receipt className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-white mb-2">INSTALLMENTS</h3>
              <p className="text-sm text-gray-400">Purchase equipment through verified provider payment arrangements.</p>
            </div>

            <div className="p-6 bg-surface-800 border border-surface-700 rounded-2xl hover:bg-surface-800/80 transition-colors">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-bold text-white mb-2">INTEREST-FREE</h3>
              <p className="text-sm text-gray-400">Connect with providers offering special interest-free arrangements.</p>
            </div>

            <div className="p-6 bg-surface-800 border border-surface-700 rounded-2xl hover:bg-surface-800/80 transition-colors">
              <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center mb-4">
                <HandHeart className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="font-bold text-white mb-2">SPONSOR / DONATE</h3>
              <p className="text-sm text-gray-400">Access equipment donated or fully sponsored by organizations.</p>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

export default ResourceAccessSection;
