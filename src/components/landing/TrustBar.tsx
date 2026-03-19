import React from "react";
import { Infinity, MonitorPlay, Smartphone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const items = [
  { icon: Infinity, en: "Life-time Access", ar: "وصول مدى الحياة" },
  { icon: MonitorPlay, en: "Online Course", ar: "دورة أونلاين" },
  { icon: Smartphone, en: "Mobile-Friendly", ar: "متوافق مع الجوال" },
];

const TrustBar: React.FC = () => {
  const { isRTL } = useLanguage();

  return (
    <section className="relative z-10 bg-primary/5 border-y border-primary/10 backdrop-blur-sm">
      <div className="section-container py-3 sm:py-4">
        <div className="flex items-center justify-center gap-6 sm:gap-12">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 sm:gap-3">
              <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">
                {isRTL ? item.ar : item.en}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBar;
