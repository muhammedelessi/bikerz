import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";

import adPlaceholder1 from "@/assets/ad-placeholder-1.jpg";
import adPlaceholder2 from "@/assets/ad-placeholder-2.jpg";
import adPlaceholder3 from "@/assets/ad-placeholder-3.jpg";

interface HeroAdRow {
  id: string;
  title: string;
  target_url: string;
  is_active: boolean;
  position: number;
  image_desktop_en: string | null;
  image_desktop_ar: string | null;
  image_mobile_en: string | null;
  image_mobile_ar: string | null;
}

interface ResolvedSlide {
  id: string;
  image_url: string;
  target_url: string;
}

const FALLBACK_SLIDES: ResolvedSlide[] = [
  { id: "f1", image_url: adPlaceholder1, target_url: "/courses" },
  { id: "f2", image_url: adPlaceholder2, target_url: "/courses" },
  { id: "f3", image_url: adPlaceholder3, target_url: "/courses" },
];

const HeroAdSlider: React.FC = () => {
  const { isRTL } = useLanguage();
  const isMobile = useIsMobile();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    direction: isRTL ? "rtl" : "ltr",
    align: "center",
  });

  // Fetch ads from hero_ads table
  const { data: dbAds } = useQuery({
    queryKey: ["hero-ads-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_ads")
        .select("*")
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as HeroAdRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Resolve correct image based on language + device
  const slides: ResolvedSlide[] = React.useMemo(() => {
    if (!dbAds || dbAds.length === 0) return FALLBACK_SLIDES;

    return dbAds
      .map((ad) => {
        let imageUrl: string | null = null;

        if (isMobile) {
          imageUrl = isRTL ? ad.image_mobile_ar : ad.image_mobile_en;
          // Fallback: try other mobile, then desktop
          if (!imageUrl) imageUrl = isRTL ? ad.image_mobile_en : ad.image_mobile_ar;
          if (!imageUrl) imageUrl = isRTL ? ad.image_desktop_ar : ad.image_desktop_en;
        } else {
          imageUrl = isRTL ? ad.image_desktop_ar : ad.image_desktop_en;
          // Fallback: try other desktop, then mobile
          if (!imageUrl) imageUrl = isRTL ? ad.image_desktop_en : ad.image_desktop_ar;
          if (!imageUrl) imageUrl = isRTL ? ad.image_mobile_ar : ad.image_mobile_en;
        }

        if (!imageUrl) return null;
        return { id: ad.id, image_url: imageUrl, target_url: ad.target_url };
      })
      .filter(Boolean) as ResolvedSlide[];
  }, [dbAds, isMobile, isRTL]);

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
    if (!emblaApi || slides.length <= 1) return;
    const interval = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => clearInterval(interval);
  }, [emblaApi, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className="relative group w-full">
      <div className="relative overflow-hidden rounded-2xl border border-border/30 shadow-2xl bg-card/20 backdrop-blur-sm">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {slides.map((slide) => (
              <div key={slide.id} className="flex-[0_0_100%] min-w-0 relative group/slide">
                <img
                  src={slide.image_url}
                  alt=""
                  className="w-full h-auto block"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 flex justify-center bg-gradient-to-t from-black/50 to-transparent">
                  <a
                    href={slide.target_url}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg hover:bg-primary/90 transition-colors"
                  >
                    {isRTL ? "اكتشف المزيد" : "Learn More"}
                    <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
                  </a>
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
