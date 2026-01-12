import React from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/landing/HeroSection';
import WhySection from '@/components/landing/WhySection';
import JourneySection from '@/components/landing/JourneySection';
import LearnSection from '@/components/landing/LearnSection';
import CommunitySection from '@/components/landing/CommunitySection';
import CTASection from '@/components/landing/CTASection';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <WhySection />
        <JourneySection />
        <LearnSection />
        <CommunitySection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
