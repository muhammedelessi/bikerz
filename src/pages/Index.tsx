import React from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/landing/HeroSection';
import WhySection from '@/components/landing/WhySection';
import JourneySection from '@/components/landing/JourneySection';
import LearnSection from '@/components/landing/LearnSection';
import CommunitySection from '@/components/landing/CommunitySection';
import CTASection from '@/components/landing/CTASection';
import SEOHead from '@/components/common/SEOHead';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Learn Motorcycle Riding with Expert Instructors"
        description="BIKERZ Academy is your premier online motorcycle riding school. Learn from certified instructors, master riding techniques, and join a thriving biker community."
        canonical="/"
      />
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
