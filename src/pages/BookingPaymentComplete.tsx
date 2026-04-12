import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { verifyChargeOnce } from '@/services/payment.service';
import {
  readPendingTrainingBooking,
  clearPendingTrainingBooking,
} from '@/lib/trainingBookingStorage';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Skeleton } from '@/components/ui/skeleton';

function toPgTime(t: string): string {
  const p = t.trim().split(':');
  if (p.length === 2) return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}:00`;
  if (p.length >= 3) return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}:${(p[2] || '00').padStart(2, '0').slice(0, 2)}`;
  return '09:00:00';
}

const BookingPaymentComplete: React.FC = () => {
  const { isRTL, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState(isRTL ? 'جاري تأكيد الدفع…' : 'Confirming payment…');

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const tapId = searchParams.get('tap_id');
      const tc = searchParams.get('tc');
      const pending = readPendingTrainingBooking();

      if (!tapId || !tc || !pending || pending.trainer_course_id !== tc) {
        setMessage(isRTL ? 'بيانات الحجز غير مكتملة. ارجع لصفحة التدريب وحاول مرة أخرى.' : 'Booking data incomplete. Return to the training page and try again.');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user) {
        navigate(`/login?returnTo=${encodeURIComponent(`/booking-payment-complete?tap_id=${encodeURIComponent(tapId)}&tc=${encodeURIComponent(tc)}`)}`, { replace: true });
        return;
      }

      let verified: { status?: string } | null = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (cancelled) return;
        try {
          verified = await verifyChargeOnce(tapId);
        } catch {
          verified = null;
        }
        if (verified?.status === 'succeeded') break;
        if (verified?.status === 'failed' || verified?.status === 'cancelled') {
          setMessage(isRTL ? 'لم يتم الدفع أو تم رفض العملية.' : 'Payment was not completed or was declined.');
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (cancelled) return;
      if (verified?.status !== 'succeeded') {
        setMessage(isRTL ? 'تعذر تأكيد الدفع. تواصل مع الدعم برقم العملية.' : 'Could not confirm payment. Contact support with your charge reference.');
        return;
      }

      const { data: existing } = await supabase
        .from('training_bookings')
        .select('id')
        .eq('payment_id', tapId)
        .maybeSingle();

      if (existing?.id) {
        clearPendingTrainingBooking();
        if (!cancelled) navigate(`/booking-success?id=${encodeURIComponent(existing.id)}`, { replace: true });
        return;
      }

      const { data: inserted, error } = await supabase
        .from('training_bookings')
        .insert({
          user_id: session.user.id,
          trainer_id: pending.trainer_id,
          training_id: pending.training_id,
          trainer_course_id: pending.trainer_course_id,
          booking_date: pending.booking_date,
          start_time: toPgTime(pending.start_time),
          end_time: toPgTime(pending.end_time),
          amount: pending.payment_amount,
          currency: pending.payment_currency || 'SAR',
          status: 'confirmed',
          payment_status: 'paid',
          payment_id: tapId,
          notes: pending.notes?.trim() || null,
          full_name: pending.full_name.trim(),
          phone: pending.phone.trim(),
          email: pending.email.trim(),
          preferred_date: pending.booking_date,
        })
        .select('id')
        .single();

      if (error) {
        console.error(error);
        setMessage(error.message || (isRTL ? 'تعذر حفظ الحجز' : 'Could not save booking'));
        return;
      }

      clearPendingTrainingBooking();
      if (!cancelled && inserted?.id) {
        navigate(`/booking-success?id=${encodeURIComponent(inserted.id)}`, { replace: true });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, isRTL]);

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <div className="pt-[var(--navbar-h)] section-container py-16">
        <div className="max-w-md mx-auto text-center space-y-4">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <p className="text-muted-foreground text-sm">{message}</p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BookingPaymentComplete;
