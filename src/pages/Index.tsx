import React from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/landing/HeroSection";
import WhySection from "@/components/landing/WhySection";
import JourneySection from "@/components/landing/JourneySection";
import FeaturedCoursesSection from "@/components/landing/FeaturedCoursesSection";
import DiscountUrgencyBanner from "@/components/landing/DiscountUrgencyBanner";
import CTASection from "@/components/landing/CTASection";
import SEOHead from "@/components/common/SEOHead";

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Learn Motorcycle Riding with Expert Instructors"
        description="BIKERZ Academy is your premier online motorcycle riding school. Learn from certified instructors, master riding techniques, and join a thriving biker community."
        canonical="/"
      />
      <Navbar />
      <div className="pt-[var(--navbar-h)]">
        <DiscountUrgencyBanner />
        <main>
        <HeroSection />
        <FeaturedCoursesSection />
        <WhySection />
        
        <JourneySection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
