import React, { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/landing/HeroSection";
import WhySection from "@/components/landing/WhySection";
import JourneySection from "@/components/landing/JourneySection";
import FeaturedCoursesSection from "@/components/landing/FeaturedCoursesSection";
import CTASection from "@/components/landing/CTASection";
import SEOHead from "@/components/common/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext"; // استيراد سياق اللغة

const Index: React.FC = () => {
  const { isRTL, language } = useLanguage();

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [isRTL, language]);

  return (
    <div
      className="min-h-screen bg-background transition-all duration-300"
      // إضافة dir هنا تضمن أن جميع المكونات الفرعية (Tailwind logic) تعمل بـ RTL
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
          {/* المكونات ستعتمد الآن على اتجاه الـ dir الممرر للحاوية أو الـ Context الداخلي */}
          <HeroSection />
          <FeaturedCoursesSection />
          <WhySection />
          <JourneySection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Index;
