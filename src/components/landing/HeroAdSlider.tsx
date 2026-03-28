import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

import adPlaceholder1 from "@/assets/ad-placeholder-1.jpg";
import adPlaceholder2 from "@/assets/ad-placeholder-2.jpg";
import adPlaceholder3 from "@/assets/ad-placeholder-3.jpg";

interface SlideData {
  id: string;
  image_url: string;
  headline_en: string | null;
  headline_ar: string | null;
  subtitle_en: string | null;
  subtitle_ar: string | null;
  cta_text_en: string | null;
  cta_text_ar: string | null;
  cta_link: string | null;
}

const FALLBACK_SLIDES: SlideData[] = [
  { id: "1", image_url: adPlaceholder1, headline_en: "Learn to Ride", headline_ar: "تعلم القيادة", subtitle_en: "Professional motorcycle courses", subtitle_ar: "دورات دراجات نارية احترافية", cta_text_en: "Enroll Now", cta_text_ar: "سجل الآن", cta_link: "/courses" },
  { id: "2", image_url: adPlaceholder2, headline_en: "Gear Up", headline_ar: "جهّز معداتك", subtitle_en: "Safety first, always", subtitle_ar: "السلامة أولاً دائماً", cta_text_en: "Learn More", cta_text_ar: "اعرف المزيد", cta_link: "/courses" },
  { id: "3", image_url: adPlaceholder3, headline_en: "Join the Ride", headline_ar: "انضم للرحلة", subtitle_en: "Be part of our community", subtitle_ar: "كن جزءاً من مجتمعنا", cta_text_en: "Join Us", cta_text_ar: "انضم إلينا", cta_link: "/courses" },
];

const HeroAdSlider: React.FC = () => {
  const { isRTL } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    direction: isRTL ? "rtl" : "ltr",
    align: "center",
  });

  const { data: dbSlides } = useQuery({
    queryKey: ["hero-slides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_slides")
        .select("*")
        .eq("is_published", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as SlideData[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const slides = dbSlides && dbSlides.length > 0 ? dbSlides : FALLBACK_SLIDES;

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  // Auto-play
  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => clearInterval(interval);
  }, [emblaApi]);

  return (
    <div className="relative group w-full">
      {/* Container with responsive aspect ratio */}
      <div className="relative overflow-hidden rounded-2xl border border-border/30 shadow-2xl bg-card/20 backdrop-blur-sm">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {slides.map((slide) => (
              <div key={slide.id} className="flex-[0_0_100%] min-w-0">
                {/* 16:9 on mobile, 9:16 on desktop */}
                <div className="relative aspect-video lg:aspect-[9/16]">
                  <img
                    src={slide.image_url}
                    alt={isRTL ? (slide.headline_ar || "") : (slide.headline_en || "")}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

                  {/* Content overlay */}
                  {(slide.headline_en || slide.cta_link) && (
                    <div className={cn(
                      "absolute bottom-0 inset-x-0 p-4 sm:p-5 flex flex-col gap-1.5",
                      isRTL ? "text-right" : "text-left"
                    )}>
                      {(slide.headline_en || slide.headline_ar) && (
                        <h3 className="text-sm sm:text-base font-bold text-primary-foreground leading-tight line-clamp-2">
                          {isRTL ? slide.headline_ar : slide.headline_en}
                        </h3>
                      )}
                      {(slide.subtitle_en || slide.subtitle_ar) && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {isRTL ? slide.subtitle_ar : slide.subtitle_en}
                        </p>
                      )}
                      {slide.cta_link && (
                        <a
                          href={slide.cta_link}
                          className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors w-fit"
                        >
                          {isRTL ? slide.cta_text_ar : slide.cta_text_en}
                          <ChevronRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={scrollPrev}
              className="absolute top-1/2 left-2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/60 backdrop-blur-sm border border-border/30 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-background/80 transition-all opacity-0 group-hover:opacity-100"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={scrollNext}
              className="absolute top-1/2 right-2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/60 backdrop-blur-sm border border-border/30 flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-background/80 transition-all opacity-0 group-hover:opacity-100"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "rounded-full transition-all duration-300",
                selectedIndex === i
                  ? "w-5 h-1.5 bg-primary"
                  : "w-1.5 h-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/60"
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HeroAdSlider;
