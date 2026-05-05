import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from 'react-router-dom';
import { useLocalizedNavigate } from '@/hooks/useLocalizedNavigate';

interface PurchaseData {
  firstName: string;
  firstNameAr: string;
  countryFlag: string;
  courseName: string;
  courseNameAr: string;
  courseId: string | null;
  thumbnail: string | null;
  minutesAgo: number;
}

const COUNTRY_FLAGS: Record<string, string> = {
  SA: '🇸🇦', AE: '🇦🇪', KW: '🇰🇼', BH: '🇧🇭', QA: '🇶🇦', OM: '🇴🇲',
  JO: '🇯🇴', EG: '🇪🇬', IQ: '🇮🇶', SY: '🇸🇾', LB: '🇱🇧', YE: '🇾🇪',
  LY: '🇱🇾', TN: '🇹🇳', DZ: '🇩🇿', MA: '🇲🇦', SD: '🇸🇩', SO: '🇸🇴',
  MR: '🇲🇷', KM: '🇰🇲', DJ: '🇩🇯', PS: '🇵🇸',
};

const DUMMY_PURCHASES: PurchaseData[] = [
  { firstName: 'Ahmed', firstNameAr: 'أحمد', countryFlag: '🇸🇦', courseName: 'Bikerz Behavior Course', courseNameAr: 'دورة سلوك البايكرز', courseId: null, thumbnail: null, minutesAgo: 12 },
  { firstName: 'Mohammed', firstNameAr: 'محمد', countryFlag: '🇦🇪', courseName: 'Bikerz Behavior Course', courseNameAr: 'دورة سلوك البايكرز', courseId: null, thumbnail: null, minutesAgo: 23 },
  { firstName: 'Khalid', firstNameAr: 'خالد', countryFlag: '🇰🇼', courseName: 'Bikerz Behavior Course', courseNameAr: 'دورة سلوك البايكرز', courseId: null, thumbnail: null, minutesAgo: 37 },
  { firstName: 'Omar', firstNameAr: 'عمر', countryFlag: '🇪🇬', courseName: 'Bikerz Behavior Course', courseNameAr: 'دورة سلوك البايكرز', courseId: null, thumbnail: null, minutesAgo: 45 },
  { firstName: 'Sultan', firstNameAr: 'سلطان', countryFlag: '🇧🇭', courseName: 'Bikerz Behavior Course', courseNameAr: 'دورة سلوك البايكرز', courseId: null, thumbnail: null, minutesAgo: 58 },
  { firstName: 'Faisal', firstNameAr: 'فيصل', countryFlag: '🇶🇦', courseName: 'Bikerz Behavior Course', courseNameAr: 'دورة سلوك البايكرز', courseId: null, thumbnail: null, minutesAgo: 72 },
  { firstName: 'Nasser', firstNameAr: 'ناصر', countryFlag: '🇴🇲', courseName: 'Bikerz Behavior Course', courseNameAr: 'دورة سلوك البايكرز', courseId: null, thumbnail: null, minutesAgo: 90 },
  { firstName: 'Youssef', firstNameAr: 'يوسف', countryFlag: '🇲🇦', courseName: 'Bikerz Behavior Course', courseNameAr: 'دورة سلوك البايكرز', courseId: null, thumbnail: null, minutesAgo: 110 },
];

const SHOW_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const INITIAL_DELAY_MS = 25000; // 25 seconds
const DISMISS_AFTER_MS = 10000; // 10 seconds

function formatTimeAgo(minutes: number, t: any): string {
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  return t('time.daysAgo', { count: 1 });
}

const SocialProofNotification: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useLocalizedNavigate();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<PurchaseData | null>(null);
  const [purchases, setPurchases] = useState<PurchaseData[]>([]);
  const indexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const dismissRef = useRef<ReturnType<typeof setTimeout>>();

  // Don't show on admin pages
  const isAdmin = location.pathname.startsWith('/admin');

  // Fetch real purchases from the last 48 hours
  useEffect(() => {
    if (isAdmin) return;

    const fetchPurchases = async () => {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('tap_charges')
        .select('customer_name, created_at, course_id, courses(title, title_ar, thumbnail_url)')
        .eq('status', 'succeeded')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        const real: PurchaseData[] = data.map((charge: any) => {
          const fullName = charge.customer_name || '';
          const firstName = fullName.split(' ')[0] || 'User';
          const now = Date.now();
          const created = new Date(charge.created_at).getTime();
          const minsAgo = Math.max(1, Math.floor((now - created) / 60000));

          const flags = Object.values(COUNTRY_FLAGS);
          const flag = flags[Math.floor(Math.random() * flags.length)];

          const course = charge.courses as any;

          return {
            firstName,
            firstNameAr: firstName,
            countryFlag: flag,
            courseName: course?.title || 'Bikerz Course',
            courseNameAr: course?.title_ar || 'دورة بايكرز',
            courseId: charge.course_id || null,
            thumbnail: course?.thumbnail_url || null,
            minutesAgo: minsAgo,
          };
        });
        setPurchases(real);
      } else {
        // Use dummy data with randomized times
        const shuffled = [...DUMMY_PURCHASES]
          .sort(() => Math.random() - 0.5)
          .map(p => ({
            ...p,
            minutesAgo: Math.floor(Math.random() * 120) + 5,
          }));
        setPurchases(shuffled);
      }
    };

    fetchPurchases();
  }, [isAdmin]);

  // Show notification cycle
  const showNext = useCallback(() => {
    if (purchases.length === 0) return;
    const idx = indexRef.current % purchases.length;
    setCurrent(purchases[idx]);
    setVisible(true);
    indexRef.current = idx + 1;

    // Auto-dismiss
    dismissRef.current = setTimeout(() => {
      setVisible(false);
    }, DISMISS_AFTER_MS);
  }, [purchases]);

  useEffect(() => {
    if (isAdmin || purchases.length === 0) return;

    // Show first one after ~25 seconds
    const initialTimeout = setTimeout(() => {
      showNext();
    }, INITIAL_DELAY_MS);

    intervalRef.current = setInterval(() => {
      showNext();
    }, SHOW_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalRef.current);
      clearTimeout(dismissRef.current);
    };
  }, [purchases, showNext, isAdmin]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisible(false);
    clearTimeout(dismissRef.current);
  };

  const handleClick = () => {
    if (current?.courseId) {
      navigate(`/courses/${current.courseId}`);
    }
    setVisible(false);
    clearTimeout(dismissRef.current);
  };

  if (isAdmin || !current) return null;

  return (
    <div
      className={`fixed z-[9999] transition-all duration-500 ease-out top-3 left-3 sm:top-auto sm:bottom-5 sm:left-5 ${
        visible
          ? 'translate-x-0 opacity-100'
          : '-translate-x-[120%] opacity-0'
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={handleClick}
        className="flex items-center gap-2 sm:gap-3 bg-card border border-border rounded-xl shadow-lg px-3 py-2 sm:px-4 sm:py-3 max-w-[280px] sm:max-w-[380px] relative group cursor-pointer hover:shadow-xl hover:border-primary/30 transition-all"
      >
        {/* Thumbnail */}
        {current.thumbnail ? (
          <img
            src={current.thumbnail}
            alt=""
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">{current.countryFlag}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">
            {t('socialProof.purchased', {
              name: isRTL ? current.firstNameAr : current.firstName,
              flag: current.countryFlag,
              course: isRTL ? current.courseNameAr : current.courseName
            })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatTimeAgo(current.minutesAgo, t)}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-1.5 end-1.5 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SocialProofNotification;
