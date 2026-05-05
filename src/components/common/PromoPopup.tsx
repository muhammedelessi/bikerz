import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalizedNavigate } from '@/hooks/useLocalizedNavigate';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Clock, Zap, Star } from 'lucide-react';

const COURSE_ID = '1f5ce93f-5ecd-4c49-b3c7-86adbc8704f6';
const STORAGE_KEY = 'bikerz_promo_shown';
const POPUP_DELAY_MS = 10000; // 10 seconds
const SCROLL_THRESHOLD = 0.5; // 50% scroll
const OFFER_DURATION_HOURS = 48;

function getOrCreateExpiry(): number {
  const stored = localStorage.getItem(STORAGE_KEY + '_expiry');
  if (stored) return parseInt(stored);
  const expiry = Date.now() + OFFER_DURATION_HOURS * 60 * 60 * 1000;
  localStorage.setItem(STORAGE_KEY + '_expiry', String(expiry));
  return expiry;
}

function hasBeenShown(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function markAsShown() {
  localStorage.setItem(STORAGE_KEY, 'true');
}

function useCountdown(expiryMs: number) {
  const [remaining, setRemaining] = useState(Math.max(0, expiryMs - Date.now()));

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiryMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiryMs]);

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return { hours, minutes, seconds, expired: remaining <= 0 };
}

interface PromoPopupProps {
  trigger: 'timer' | 'scroll' | 'exit';
}

const PromoPopup: React.FC<PromoPopupProps> = ({ trigger }) => {
  const [open, setOpen] = useState(false);
  const [fired, setFired] = useState(false);
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { getCoursePriceInfo, symbol, symbolAr } = useCurrency();
  const navigate = useLocalizedNavigate();
  const expiryRef = useRef(getOrCreateExpiry());
  const countdown = useCountdown(expiryRef.current);
  const currencyLabel = isRTL ? symbolAr : symbol;

  // Fetch course data
  const { data: course } = useQuery({
    queryKey: ['promo-course', COURSE_ID],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, title_ar, thumbnail_url, price, discount_percentage')
        .eq('id', COURSE_ID)
        .single();
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Check if user already enrolled
  const { data: isEnrolled } = useQuery({
    queryKey: ['promo-enrolled', COURSE_ID, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', COURSE_ID)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const shouldShow = !hasBeenShown() && !isEnrolled && !countdown.expired;

  const showPopup = useCallback(() => {
    if (fired || !shouldShow) return;
    setFired(true);
    setOpen(true);
    markAsShown();
  }, [fired, shouldShow]);

  // Timer trigger
  useEffect(() => {
    if (trigger !== 'timer' || fired) return;
    const id = setTimeout(showPopup, POPUP_DELAY_MS);
    return () => clearTimeout(id);
  }, [trigger, fired, showPopup]);

  // Scroll trigger
  useEffect(() => {
    if (trigger !== 'scroll' || fired) return;
    const handleScroll = () => {
      const scrolled = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (scrolled >= SCROLL_THRESHOLD) showPopup();
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [trigger, fired, showPopup]);

  // Exit intent trigger
  useEffect(() => {
    if (trigger !== 'exit' || fired) return;
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) showPopup();
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [trigger, fired, showPopup]);

  if (!course) return null;

  const priceInfo = getCoursePriceInfo(course.id, course.price, course.discount_percentage || 0);
  const hasDiscount = priceInfo.discountPct > 0;
  const courseTitle = isRTL && course.title_ar ? course.title_ar : course.title;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-[440px] w-[calc(100vw-2rem)] p-0 overflow-hidden border-0 gap-0"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 end-3 z-10 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>

        {/* Top banner */}
        <div className="bg-primary px-5 py-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-white flex-shrink-0" />
          <p className="text-white text-xs font-bold uppercase tracking-wider">
            {isRTL ? '🔥 عرض حصري لفترة محدودة!' : '🔥 Exclusive Limited Time Offer!'}
          </p>
        </div>

        {/* Course thumbnail */}
        {course.thumbnail_url && (
          <div className="relative h-40 overflow-hidden">
            <img
              src={course.thumbnail_url}
              alt={courseTitle}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            {hasDiscount && (
              <div className="absolute top-3 start-3 bg-primary text-white text-sm font-black px-3 py-1 rounded-full">
                -{priceInfo.discountPct}%
              </div>
            )}
            <div className="absolute bottom-3 start-3 end-3">
              <div className="flex items-center gap-1 mb-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-white font-bold text-sm leading-tight">{courseTitle}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-5 py-4 space-y-4 bg-card">

          {/* Offer text */}
          <div className="text-center">
            <p className="text-foreground font-semibold text-sm">
              {isRTL
                ? 'استغل هذا العرض قبل أن ينتهي!'
                : 'Grab this deal before it expires!'}
            </p>
            {hasDiscount && (
              <p className="text-muted-foreground text-xs mt-1">
                {isRTL
                  ? `وفّر ${priceInfo.discountPct}% على دورة ${courseTitle}`
                  : `Save ${priceInfo.discountPct}% on ${courseTitle}`}
              </p>
            )}
          </div>

          {/* Price */}
          <div className="flex items-center justify-center gap-3">
            {hasDiscount && (
              <span className="text-muted-foreground line-through text-sm">
                {priceInfo.originalPrice} {currencyLabel}
              </span>
            )}
            <span className="text-primary font-black text-2xl">
              {priceInfo.finalPrice} {currencyLabel}
            </span>
          </div>

          {/* Countdown */}
          <div className="bg-muted/40 rounded-xl p-3">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">
                {isRTL ? 'ينتهي العرض خلال:' : 'Offer expires in:'}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2">
              {[
                { val: pad(countdown.hours), label: isRTL ? 'ساعة' : 'hrs' },
                { val: pad(countdown.minutes), label: isRTL ? 'دقيقة' : 'min' },
                { val: pad(countdown.seconds), label: isRTL ? 'ثانية' : 'sec' },
              ].map(({ val, label }, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <span className="text-primary font-bold text-lg">:</span>}
                  <div className="flex flex-col items-center">
                    <div className="bg-background border border-border rounded-lg w-12 h-12 flex items-center justify-center">
                      <span className="text-foreground font-black text-xl leading-none">{val}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">{label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-2">
            <Button
              className="w-full h-11 font-bold text-sm gap-2 shadow-[0_4px_20px_rgba(232,66,10,0.4)]"
              variant="cta"
              onClick={() => {
                setOpen(false);
                navigate(`/courses/${COURSE_ID}`);
              }}
            >
              <Zap className="w-4 h-4" />
              {isRTL ? 'استغل العرض الآن!' : 'Grab the Deal Now!'}
            </Button>
            <button
              onClick={() => setOpen(false)}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              {isRTL
                ? 'لا شكراً، سأدفع السعر الكامل لاحقاً'
                : "No thanks, I'll pay full price later"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromoPopup;
