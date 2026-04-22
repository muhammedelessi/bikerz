import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Sparkles, Rocket, ArrowRight, ArrowLeft, CheckCircle2, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import bikerLogo from "@/assets/bikerz-logo.webp";
import { trackPurchase } from "@/utils/metaPixel";
import { useGHLFormWebhook } from "@/hooks/useGHLFormWebhook";
import { clearBundleSelection } from "@/lib/bundleSelectionStorage";
import type { User } from "@supabase/supabase-js";
import { COUNTRIES } from "@/data/countryCityData";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BookingTimeDisplay from "@/components/common/BookingTimeDisplay";
import { normalizeBookingSessions } from "@/lib/trainingBookingSessions";
function useAuthReady() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (supabase.auth as any).getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    const {
      data: { subscription },
    } = (supabase.auth as any).onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, isReady };
}

type VerifyStatus = "verifying" | "succeeded" | "failed" | "cancelled" | "processing";

const MAX_RETRIES = 4;
const RETRY_DELAY = 3000;

const PaymentSuccess: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("course");
  const isBundle = searchParams.get("bundle") === "1";
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user, isReady } = useAuthReady();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const tapId = searchParams.get("tap_id");
  const { sendCourseStatus, sendWithCourses } = useGHLFormWebhook();

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("verifying");
  const [confettiFired, setConfettiFired] = useState(false);
  const retryCountRef = useRef(0);
  const crmSuccessSyncedRef = useRef(false);
  const pixelFiredRef = useRef<string | null>(null);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  // Fetch course info
  const { data: course } = useQuery({
    queryKey: ["course-success", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("title, title_ar, total_lessons, duration_hours, price")
        .eq("id", courseId!)
        .single();
      return data;
    },
    enabled: !!courseId && !isBundle,
  });

  const { data: bundleData } = useQuery({
    queryKey: ["bundle-success", tapId],
    enabled: isBundle && verifyStatus === "succeeded" && !!tapId,
    queryFn: async () => {
      const { data } = await supabase
        .from("course_bundles")
        .select(`
          id, courses_count, discount_percentage, final_price_sar,
          course_bundle_enrollments(
            courses(id, title, title_ar, thumbnail_url)
          )
        `)
        .eq("payment_id", tapId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: verifiedTapCharge } = useQuery({
    queryKey: ["tap-charge-verified", tapId],
    enabled: verifyStatus === "succeeded" && !!tapId && tapId !== "free_enrollment",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tap_charges")
        .select("id, charge_id, metadata")
        .eq("charge_id", tapId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const paymentKind = String((verifiedTapCharge?.metadata as any)?.payment_kind ?? "").toLowerCase();
  const isTrainingBookingSuccess = paymentKind === "training_booking";

  const { data: trainingBookingSuccess } = useQuery({
    queryKey: ["training-booking-success", tapId],
    enabled: verifyStatus === "succeeded" && isTrainingBookingSuccess && !!tapId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_bookings")
        .select(
          `
          id, amount, currency, payment_id, sessions, booking_date, start_time, end_time,
          trainers(name_ar, name_en, photo_url),
          trainings(name_ar, name_en)
        `,
        )
        .eq("payment_id", tapId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Meta Pixel + GHL + n8n on successful verification (once per success)
  useEffect(() => {
    if (verifyStatus !== "succeeded" || !user || crmSuccessSyncedRef.current) return;

    const countryCode =
      COUNTRIES.find((c) => c.en === profile?.country || c.ar === profile?.country || c.code === profile?.country)
        ?.code ||
      profile?.country ||
      "";

    if (isBundle) {
      crmSuccessSyncedRef.current = true;
      let checkout: Record<string, string> = {};
      try {
        const raw = sessionStorage.getItem("bikerz_checkout_data");
        if (raw) checkout = JSON.parse(raw) as Record<string, string>;
      } catch {
        /* ignore */
      }

      const bundleLabel = isRTL ? "باقة كورسات" : "Course bundle";
      const amountStr = checkout.amount || "";
      const currency = checkout.currency || "SAR";

      void sendWithCourses(user.id, {
        full_name: profile?.full_name || checkout.fullName || "",
        email: user.email || "",
        phone: profile?.phone || checkout.phone || "",
        country: countryCode,
        city: profile?.city || checkout.city || "",
        address: [profile?.city, profile?.country].filter(Boolean).join(", "),
        amount: amountStr,
        currency,
        orderStatus: "purchased",
        courseName: bundleLabel,
        dateOfBirth: profile?.date_of_birth || "",
        gender: profile?.gender || "",
        silent: true,
      });

      if (pixelFiredRef.current !== tapId) {
        pixelFiredRef.current = tapId;
        trackPurchase({
          content_name: bundleLabel,
          content_ids: ["course_bundle"],
          content_type: "product",
          value: Number(amountStr) || 0,
          currency: "SAR",
        });
      }

      const n8nBase = {
        email: user.email || "",
        full_name: profile?.full_name || checkout.fullName || "",
        phone: profile?.phone || checkout.phone || "",
        courseName: bundleLabel,
        amount: amountStr,
        currency,
        orderStatus: "purchased",
        is_bundle: true,
        payment_id: tapId,
        date: new Date().toISOString(),
      };
      fetch("https://n8n.srv1504278.hstgr.cloud/webhook/new_order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n8nBase),
      }).catch((err) => console.warn("[n8n webhook] failed:", err));

      fetch("https://n8n.srv1504278.hstgr.cloud/webhook-test/fec802fa-f0c5-45e9-b9c9-3ecb0ecbc5c3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...n8nBase,
          country: profile?.country || "",
          city: profile?.city || "",
          purchase_date: new Date().toISOString(),
          order_status: "purchased",
        }),
      }).catch(() => {});
      return;
    }

    if (!course || !courseId) return;
    crmSuccessSyncedRef.current = true;

    trackPurchase({
      content_name: course.title,
      content_ids: [courseId],
      content_type: "product",
      value: course.price ?? 0,
      currency: "SAR",
    });

    void sendCourseStatus(user.id, courseId, course.title, "purchased", {
      full_name: profile?.full_name || "",
      email: user.email || "",
      phone: profile?.phone || "",
      country: countryCode,
      city: profile?.city || "",
      address: [profile?.city, profile?.country].filter(Boolean).join(", "),
      amount: String(course.price ?? 0),
      currency: "SAR",
      dateOfBirth: profile?.date_of_birth || "",
      gender: profile?.gender || "",
      silent: true,
    });

    fetch("https://n8n.srv1504278.hstgr.cloud/webhook/new_order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email || "",
        full_name: profile?.full_name || "",
        phone: profile?.phone || "",
        courseName: course.title || "",
        amount: String(course.price ?? 0),
        currency: "SAR",
        orderStatus: "purchased",
        date: new Date().toISOString(),
      }),
    }).catch((err) => console.warn("[n8n webhook] failed:", err));

    fetch("https://n8n.srv1504278.hstgr.cloud/webhook-test/fec802fa-f0c5-45e9-b9c9-3ecb0ecbc5c3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: profile?.full_name || "",
        email: user.email || "",
        phone: profile?.phone || "",
        country: profile?.country || "",
        city: profile?.city || "",
        course_id: courseId,
        course_name: course.title || "",
        amount: course.price || 0,
        currency: "SAR",
        payment_id: tapId,
        purchase_date: new Date().toISOString(),
        order_status: "purchased",
      }),
    }).catch(() => {});
  }, [
    verifyStatus,
    course,
    courseId,
    isBundle,
    user,
    profile,
    isRTL,
    sendCourseStatus,
    sendWithCourses,
    tapId,
  ]);

  // Verify payment with retry/polling logic
  useEffect(() => {
    if (!isReady) return;

    // Free enrollment — skip verification
    if (!tapId || tapId === "free_enrollment") {
      setVerifyStatus("succeeded");
      return;
    }

    const verify = async () => {
      try {
        // Call verify — works with or without auth (edge function handles both)
        const { data, error } = await supabase.functions.invoke("tap-verify-charge", {
          body: { charge_id: tapId },
        });

        if (error) throw error;

        if (data?.status === "succeeded") {
          setVerifyStatus("succeeded");
          if (isBundle) {
            clearBundleSelection();
            queryClient.invalidateQueries({ queryKey: ["user-enrollments", user?.id] });
            queryClient.invalidateQueries({ queryKey: ["courses-with-stats"] });
          } else if (user && courseId) {
            queryClient.invalidateQueries({ queryKey: ["enrollment", courseId, user.id] });
          }
          return;
        }

        if (data?.status === "cancelled") {
          setVerifyStatus("cancelled");
          return;
        }

        if (data?.status === "failed") {
          setVerifyStatus("failed");
          return;
        }

        // Still processing — retry with polling
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          console.log(`[PaymentSuccess] Retry ${retryCountRef.current}/${MAX_RETRIES}...`);
          setTimeout(verify, RETRY_DELAY);
        } else {
          // Max retries — still show success-ish if the charge exists
          // The webhook will handle final enrollment
          setVerifyStatus("processing");
          if (isBundle) {
            queryClient.invalidateQueries({ queryKey: ["user-enrollments", user?.id] });
            queryClient.invalidateQueries({ queryKey: ["courses-with-stats"] });
          } else if (user && courseId) {
            queryClient.invalidateQueries({ queryKey: ["enrollment", courseId, user.id] });
          }
        }
      } catch (err) {
        console.error("[PaymentSuccess] Verify error:", err);
        // On error, retry a few times before giving up
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          setTimeout(verify, RETRY_DELAY);
        } else {
          setVerifyStatus("failed");
        }
      }
    };

    verify();
  }, [tapId, isReady, isBundle, courseId, user, queryClient]);

  // Fire confetti on success
  useEffect(() => {
    if (verifyStatus !== "succeeded" || confettiFired) return;
    setConfettiFired(true);

    const fire = () => {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ["#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"],
      });
    };
    fire();
    setTimeout(fire, 400);
    setTimeout(fire, 900);
  }, [verifyStatus, confettiFired]);

  const courseTitle = isBundle
    ? isRTL
      ? "باقة الكورسات"
      : "Course bundle"
    : isRTL && course?.title_ar
      ? course.title_ar
      : course?.title;

  // Wait for auth to be ready
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Cancelled state — user cancelled on Tap page
  if (verifyStatus === "cancelled") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg text-center space-y-6"
        >
          <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <span className="text-4xl">🚫</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">{t("payment.cancelled")}</h2>
          <p className="text-muted-foreground">{t("payment.cancelledDescription")}</p>
          <Button onClick={() => navigate(isBundle ? "/bundles" : `/courses/${courseId}`)} variant="cta" className="h-12 px-8 rounded-2xl">
            {isBundle ? (isRTL ? "العودة للباقات" : "Back to Bundles") : t("payment.backToCourse")}
          </Button>
        </motion.div>
      </div>
    );
  }

  // Failed state
  if (verifyStatus === "failed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg text-center space-y-6"
        >
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/15 flex items-center justify-center">
            <span className="text-4xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">{t("payment.failed")}</h2>
          <p className="text-muted-foreground">{t("payment.failedDescription")}</p>
          <Button onClick={() => navigate(isBundle ? "/bundles" : `/courses/${courseId}`)} variant="cta" className="h-12 px-8 rounded-2xl">
            {isBundle ? (isRTL ? "العودة للباقات" : "Back to Bundles") : t("payment.backToCourse")}
          </Button>
        </motion.div>
      </div>
    );
  }

  // Verifying state — show spinner
  if (verifyStatus === "verifying") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <h2 className="text-2xl font-bold text-foreground mb-2">{t("payment.verifying")}</h2>
          <p className="text-muted-foreground">{t("payment.pleaseWait")}</p>
        </motion.div>
      </div>
    );
  }

  // Processing state — payment initiated but not yet confirmed
  if (verifyStatus === "processing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg text-center space-y-6"
        >
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">{t("payment.processing")}</h2>
          <p className="text-muted-foreground">{t("payment.processingDescription")}</p>
          <Button onClick={() => navigate(isBundle ? "/bundles" : `/courses/${courseId}`)} variant="cta" className="h-12 px-8 rounded-2xl">
            {isBundle ? (isRTL ? "العودة للباقات" : "Back to bundles") : t("payment.backToCourse")}
          </Button>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (isTrainingBookingSuccess && trainingBookingSuccess) {
    const trainerName = isRTL
      ? trainingBookingSuccess.trainers?.name_ar || trainingBookingSuccess.trainers?.name_en
      : trainingBookingSuccess.trainers?.name_en || trainingBookingSuccess.trainers?.name_ar;
    const trainingName = isRTL
      ? trainingBookingSuccess.trainings?.name_ar || trainingBookingSuccess.trainings?.name_en
      : trainingBookingSuccess.trainings?.name_en || trainingBookingSuccess.trainings?.name_ar;
    const sessions = normalizeBookingSessions(
      trainingBookingSuccess.sessions,
      trainingBookingSuccess.booking_date,
      trainingBookingSuccess.start_time,
      trainingBookingSuccess.end_time,
      "confirmed",
    );

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 w-full max-w-2xl bg-card border rounded-2xl p-6 space-y-5" dir={isRTL ? "rtl" : "ltr"}>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-black">{isRTL ? "تم تأكيد حجزك!" : "Booking Confirmed!"}</h1>
            <p className="text-sm text-muted-foreground">{isRTL ? "شكراً لك، تم تأكيد الدفع بنجاح" : "Your payment was successful"}</p>
          </div>

          <div className="rounded-xl border p-4 flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={trainingBookingSuccess.trainers?.photo_url || undefined} alt={trainerName || "Trainer"} />
              <AvatarFallback>{(trainerName || "T").charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="text-start min-w-0">
              <p className="font-semibold truncate">{trainerName || "-"}</p>
              <p className="text-sm text-muted-foreground truncate">{trainingName || "-"}</p>
            </div>
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <h3 className="font-semibold">{isRTL ? "جدول جلساتك" : "Your Sessions"}</h3>
            {sessions.map((session) => (
              <div key={`${session.session_number}-${session.date}`} className="flex items-center justify-between gap-3 text-sm border-b last:border-0 py-2">
                <span className="font-medium">{isRTL ? `الجلسة ${session.session_number}` : `Session ${session.session_number}`}</span>
                <BookingTimeDisplay date={session.date} startTime={session.start_time} endTime={session.end_time} compact showCountdown={false} />
              </div>
            ))}
          </div>

          <div className="rounded-xl border p-4 space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">{isRTL ? "المبلغ المدفوع: " : "Amount paid: "}</span>
              <span dir="ltr" className="font-semibold tabular-nums">
                {Number(trainingBookingSuccess.amount || 0).toFixed(2)} {trainingBookingSuccess.currency || "SAR"}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">{isRTL ? "رقم الحجز: " : "Booking ID: "}</span>
              <span dir="ltr" className="font-mono text-xs">
                {trainingBookingSuccess.id}
              </span>
            </p>
          </div>

          <div className="rounded-xl border p-4 space-y-2 text-sm">
            <p className="font-semibold">{isRTL ? "ما الذي يحدث الآن؟" : "What happens next?"}</p>
            <p>✓ {isRTL ? "المدرب سيتواصل معك" : "Trainer will contact you"}</p>
            <p>✓ {isRTL ? "تذكير قبل الجلسة بـ 24 ساعة" : "Reminder 24h before session"}</p>
            <p>✓ {isRTL ? "متابعة التقدم من حجوزاتي" : "Track progress in My Bookings"}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={() => navigate("/my-bookings")}>{isRTL ? "عرض حجوزاتي" : "View My Bookings"}</Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              {isRTL ? "العودة للرئيسية" : "Back to Home"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className="relative z-10 w-full max-w-lg mx-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <Link to="/" className="inline-block mb-3 sm:mb-4 lg:mb-6">
            <picture>
              <source srcSet={bikerLogo} type="image/webp" />
              <img
                src={bikerLogo}
                alt="BIKERZ"
                width={160}
                height={64}
                className="h-10 sm:h-12 lg:h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                loading="eager"
                decoding="async"
              />
            </picture>
          </Link>
        </motion.div>

        <div className="bg-card border-2 border-primary/20 rounded-3xl p-8 sm:p-10 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/5 pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-7">
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
              className="mx-auto w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center"
            >
              <Trophy className="w-12 h-12 text-primary" />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground mb-3">
                {t("payment.congratulations")}
              </h2>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto mb-8">
                  {t("payment.successEnrollment")}
                </p>
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-muted/50 rounded-2xl p-5 border border-border space-y-3"
            >
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
                {t("payment.yourCourse")}
              </h3>
              {!isBundle ? (
                <>
                  <p className="text-xl font-bold text-foreground leading-tight">{courseTitle || "..."}</p>
                  <div className="flex items-center justify-center gap-6 pt-2">
                    {course?.total_lessons && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <BookOpen className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-foreground">{course.title}</span>
                        <span className="hidden sm:inline text-border">•</span>
                        <span>
                          {course.total_lessons} {t("courses.lesson")}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t("payment.confirmed")}</span>
                    </div>
                  </div>
                </>
              ) : bundleData ? (
                <div className="space-y-3 text-start">
                  <p className="text-sm font-semibold text-muted-foreground">{isRTL ? "الكورسات المضافة:" : "Courses added:"}</p>
                  {bundleData.course_bundle_enrollments?.map((e: any) => (
                    <div key={e.courses?.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      {e.courses?.thumbnail_url && (
                        <img src={e.courses.thumbnail_url} className="w-10 h-10 rounded-lg object-cover shrink-0" alt={e.courses?.title || "course"} />
                      )}
                      <span className="text-sm font-medium">
                        {isRTL ? e.courses?.title_ar || e.courses?.title : e.courses?.title}
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 ms-auto shrink-0" />
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pt-2 border-t border-border/40">
                    <span className="text-muted-foreground">
                      {isRTL
                        ? `باقة ${bundleData.courses_count} كورسات — خصم ${bundleData.discount_percentage}%`
                        : `${bundleData.courses_count}-course bundle — ${bundleData.discount_percentage}% off`}
                    </span>
                    <span className="font-bold text-primary">
                      {bundleData.final_price_sar} {isRTL ? "ر.س" : "SAR"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xl font-bold text-foreground leading-tight">{courseTitle || "..."}</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 border border-border/50"
            >
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
                {t("payment.whatsNext")}
              </h3>
              <p>{t("payment.whatsNextDescription")}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
              {isBundle ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild className="flex-1">
                    <Link to="/dashboard">{isRTL ? "ابدأ التعلم" : "Start Learning"}</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/courses">{isRTL ? "تصفح المزيد" : "Browse More"}</Link>
                  </Button>
                </div>
              ) : (
                <Button className="w-full btn-cta h-12 text-base font-bold shadow-xl shadow-primary/20" asChild>
                  <Link to={`/courses/${courseId}/learn?welcome=1`}>
                    {t("payment.startLearning")}
                    <ArrowIcon className="w-5 h-5 ms-2" />
                  </Link>
                </Button>
              )}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-sm text-muted-foreground"
            >
              {t("payment.welcomeFamily")}
            </motion.p>

            {import.meta.env.DEV && (
              <button
                onClick={() => {
                  fetch('https://n8n.srv1504278.hstgr.cloud/webhook-test/fec802fa-f0c5-45e9-b9c9-3ecb0ecbc5c3', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      full_name: 'Test User',
                      email: 'test@bikerz.com',
                      phone: '+966500000000',
                      country: 'SA',
                      city: 'Riyadh',
                      course_id: 'test-course-id',
                      course_name: 'Test Course',
                      amount: 69,
                      currency: 'SAR',
                      payment_id: 'test_payment_123',
                      purchase_date: new Date().toISOString(),
                      order_status: 'purchased',
                    }),
                  })
                    .then(() => alert('Webhook sent successfully!'))
                    .catch(() => alert('Webhook failed!'));
                }}
                style={{ marginTop: '16px', padding: '8px 16px', background: '#e85', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                TEST: Send Webhook
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;
