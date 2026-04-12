import React, { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import TrainersSection from "@/components/landing/TrainersSection";
import SEOHead from "@/components/common/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";

const Trainers: React.FC = () => {
  const { isRTL, language } = useLanguage();

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [isRTL, language]);

  return (
    <div className="min-h-screen bg-background transition-all duration-300" dir={isRTL ? "rtl" : "ltr"}>
      <SEOHead
        title={isRTL ? "المدربون" : "Trainers"}
        description={
          isRTL
            ? "تعرّف على مدربي بايكرز المعتمدين، خبراتهم وتقييمات المتدربين واحجز تدريبك العملي."
            : "Meet BIKERZ certified trainers, their experience and student reviews, and book your practical training."
        }
        canonical="/trainers"
        breadcrumbs={[
          { name: isRTL ? "الرئيسية" : "Home", url: "/" },
          { name: isRTL ? "المدربون" : "Trainers", url: "/trainers" },
        ]}
      />
      <Navbar />
      <div className="pt-[var(--navbar-h)]">
        <main>
          <TrainersSection />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Trainers;
