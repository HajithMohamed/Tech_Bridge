import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import SolutionSection from '../components/landing/SolutionSection';
import OpportunityCategories from '../components/landing/OpportunityCategories';
import ResourceAccessSection from '../components/landing/ResourceAccessSection';
import HowItWorks from '../components/landing/HowItWorks';
import ComparisonSection from '../components/landing/ComparisonSection';
import ProviderCTA from '../components/landing/ProviderCTA';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-surface-50 text-surface-800 font-sans">
      <Navbar />
      <Hero />
      <SolutionSection />
      <OpportunityCategories />
      <ResourceAccessSection />
      <HowItWorks />
      <ComparisonSection />
      <ProviderCTA />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default LandingPage;
