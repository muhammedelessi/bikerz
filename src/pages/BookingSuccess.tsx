import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import LocalizedLink from '@/components/common/LocalizedLink';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { CheckCircle2 } from 'lucide-react';

function bookingRef(id: string) {
  const y = new Date().getFullYear();
  const short = id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `#BK-${y}-${short}`;
}

const BookingSuccess: React.FC = () => {
  const { isRTL, language } = useLanguage();
  const [params] = useSearchParams();
  const id = params.get('id');
  const dfLocale = isRTL ? arSA : enUS;

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);

  const { data: row, isLoading } = useQuery({
    queryKey: ['booking-success', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select(
          'id, booking_date, start_time, end_time, trainers(name_ar, name_en, photo_url), trainings(name_ar, name_en)',
        )
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const trainer = row?.trainers as { name_ar: string; name_en: string; photo_url: string | null } | null;
  const training = row?.trainings as { name_ar: string; name_en: string } | null;
  const trainerName = trainer ? (isRTL ? trainer.name_ar : trainer.name_en) : '';
  const trainingName = training ? (isRTL ? training.name_ar : training.name_en) : '';

  const dateLine =
    row?.booking_date &&
    format(new Date(String(row.booking_date) + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: dfLocale });
  const timeLine =
    row?.start_time && row?.end_time
      ? `${String(row.start_time).slice(0, 5)} — ${String(row.end_time).slice(0, 5)}`
      : '';

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <div className="pt-[var(--navbar-h)] section-container py-12">
        <Card className="max-w-lg mx-auto border-emerald-500/20 shadow-lg">
          <CardHeader className="text-center space-y-3">
            <div className="flex justify-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            </div>
            <CardTitle className="text-xl">
              {isRTL ? 'تم تأكيد حجزك!' : 'Your booking is confirmed!'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {isLoading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
              </div>
            ) : !row ? (
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'لم يُعثر على الحجز.' : 'Booking not found.'}
              </p>
            ) : (
              <ul className="text-sm text-start space-y-2 ps-1">
                <li>
                  <span className="text-muted-foreground">{isRTL ? 'المدرب: ' : 'Trainer: '}</span>
                  {trainerName}
                </li>
                <li>
                  <span className="text-muted-foreground">{isRTL ? 'التدريب: ' : 'Training: '}</span>
                  {trainingName}
                </li>
                <li>
                  <span className="text-muted-foreground">{isRTL ? 'التاريخ: ' : 'Date: '}</span>
                  {dateLine}
                </li>
                <li dir="ltr" className="text-start">
                  <span className="text-muted-foreground">{isRTL ? 'الوقت: ' : 'Time: '}</span>
                  {timeLine}
                </li>
                <li dir="ltr" className="text-start font-mono text-xs">
                  <span className="text-muted-foreground font-sans">{isRTL ? 'رقم الحجز: ' : 'Booking ref: '}</span>
                  {bookingRef(row.id)}
                </li>
              </ul>
            )}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button asChild className="flex-1">
                <LocalizedLink to="/profile/bookings">{isRTL ? 'عرض حجوزاتي' : 'My bookings'}</LocalizedLink>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <LocalizedLink to="/">{isRTL ? 'العودة للرئيسية' : 'Back home'}</LocalizedLink>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default BookingSuccess;
