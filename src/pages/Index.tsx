import React, { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/landing/HeroSection";
import WhySection from "@/components/landing/WhySection";
import JourneySection from "@/components/landing/JourneySection";
import FeaturedCoursesSection from "@/components/landing/FeaturedCoursesSection";
import CTASection from "@/components/landing/CTASection";
import SectionDivider from "@/components/landing/SectionDivider";
import SEOHead from "@/components/common/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";

const Index: React.FC = () => {
  const { isRTL, language } = useLanguage();

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [isRTL, language]);

  return (
    <div
      className="min-h-screen bg-background transition-all duration-300"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <SEOHead
        title={isRTL ? "تعلم قيادة الدراجات النارية مع خبراء" : "Learn Motorcycle Riding with Expert Instructors"}
        description="BIKERZ Academy is your premier online motorcycle riding school."
        canonical="/"
      />

      <Navbar />

      <div className="pt-[var(--navbar-h)]">
        <main>
          <HeroSection />
          <SectionDivider />
          <FeaturedCoursesSection />
          <SectionDivider />
          <WhySection />
          <SectionDivider />
          <JourneySection />
          <SectionDivider />
          <CTASection />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Index;
