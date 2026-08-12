import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import TrustStrip from '../components/landing/TrustStrip';
import ProblemSection from '../components/landing/ProblemSection';
import SolutionSection from '../components/landing/SolutionSection';
import OpportunityCategories from '../components/landing/OpportunityCategories';
import ResourceAccessSection from '../components/landing/ResourceAccessSection';
import SkillsToIncomeSection from '../components/landing/SkillsToIncomeSection';
import HowItWorks from '../components/landing/HowItWorks';
import StudentJourneySection from '../components/landing/StudentJourneySection';
import ProviderEcosystem from '../components/landing/ProviderEcosystem';
import ProviderCTA from '../components/landing/ProviderCTA';
import ImpactSection from '../components/landing/ImpactSection';
import ComparisonSection from '../components/landing/ComparisonSection';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-surface-50 text-surface-800 font-sans">
      <Navbar />
      <Hero />
      <TrustStrip />
      <ProblemSection />
      <SolutionSection />
      <OpportunityCategories />
      <ResourceAccessSection />
      <SkillsToIncomeSection />
      <HowItWorks />
      <StudentJourneySection />
      <ProviderEcosystem />
      <ProviderCTA />
      <ImpactSection />
      <ComparisonSection />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default LandingPage;
