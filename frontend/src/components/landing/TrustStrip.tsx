import { Briefcase, GraduationCap, Coins, Laptop, Users } from 'lucide-react';

const TrustStrip = () => {
  return (
    <div className="bg-surface-900 border-t border-surface-800 py-10 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-primary-400 uppercase tracking-widest mb-2">One Platform</p>
          <p className="text-gray-300 max-w-2xl mx-auto">
            One place to discover opportunities that are usually scattered across different platforms.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-6 md:gap-x-12">
          <div className="flex items-center gap-2 text-white font-medium">
            <Briefcase className="w-5 h-5 text-primary-400" />
            Jobs
          </div>
          <div className="flex items-center gap-2 text-white font-medium">
            <GraduationCap className="w-5 h-5 text-primary-400" />
            Learning
          </div>
          <div className="flex items-center gap-2 text-white font-medium">
            <Coins className="w-5 h-5 text-primary-400" />
            Financial Opportunities
          </div>
          <div className="flex items-center gap-2 text-white font-medium">
            <Laptop className="w-5 h-5 text-primary-400" />
            Resources
          </div>
          <div className="flex items-center gap-2 text-white font-medium">
            <Users className="w-5 h-5 text-primary-400" />
            Industry Connections
          </div>
        </div>

      </div>
    </div>
  );
};

export default TrustStrip;
