import { ArrowDown } from 'lucide-react';

const projects = [
  "Build a Business Website",
  "Design Social Media Content",
  "Create Promotional Video",
  "Manage Digital Marketing",
  "Build a Small Web Application"
];

const skills = [
  "HTML", "CSS", "Canva", "Graphic Design", 
  "Video Editing", "Programming", "Photography", "Digital Marketing"
];

const SkillsToIncomeSection = () => {
  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-surface-900 tracking-tight mb-4">
            Your skills can become your next opportunity.
          </h2>
          <p className="text-xl text-gray-500">
            Students gain experience while local businesses gain affordable access to digital and technical services.
          </p>
        </div>

        {/* Visual Pathway */}
        <div className="max-w-4xl mx-auto bg-surface-50 rounded-[2.5rem] p-8 md:p-12 border border-gray-100 flex flex-col items-center shadow-sm">
          
          {/* Step 1: Skills */}
          <div className="w-full text-center">
            <p className="text-sm font-bold text-primary-500 uppercase tracking-widest mb-4">Student Skills</p>
            <div className="flex flex-wrap justify-center gap-2">
              {skills.map((skill, i) => (
                <span key={i} className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-semibold text-gray-700 shadow-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <ArrowDown className="w-8 h-8 text-primary-300 my-6" />

          {/* Step 2: TechBridge */}
          <div className="px-8 py-3 bg-surface-900 text-white rounded-xl font-bold text-lg tracking-wider shadow-lg border border-surface-800">
            TECHBRIDGE
          </div>

          <ArrowDown className="w-8 h-8 text-primary-300 my-6" />

          {/* Step 3: Providers */}
          <div className="text-center">
            <p className="text-sm font-bold text-primary-500 uppercase tracking-widest mb-3">Opportunity Providers</p>
            <p className="text-gray-700 font-medium">Local businesses • Organizations • Companies • Project providers</p>
          </div>

          <ArrowDown className="w-8 h-8 text-primary-300 my-6" />

          {/* Step 4: Projects */}
          <div className="w-full text-center mb-6">
            <p className="text-sm font-bold text-primary-500 uppercase tracking-widest mb-4">Student Projects</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 justify-center">
              {projects.map((project, i) => (
                <div key={i} className={`p-4 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-surface-900 ${i === projects.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
                  {project}
                </div>
              ))}
            </div>
          </div>

          <ArrowDown className="w-8 h-8 text-primary-300 my-6" />

          {/* Step 5: Outcome */}
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center">
            <div className="px-6 py-3 bg-primary-50 text-primary-700 font-bold rounded-xl border border-primary-100">Portfolio</div>
            <span className="text-gray-300 font-black">+</span>
            <div className="px-6 py-3 bg-primary-50 text-primary-700 font-bold rounded-xl border border-primary-100">Experience</div>
            <span className="text-gray-300 font-black">+</span>
            <div className="px-6 py-3 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100">Income</div>
          </div>

        </div>

      </div>
    </section>
  );
};

export default SkillsToIncomeSection;
