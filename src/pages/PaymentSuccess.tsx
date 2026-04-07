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
import type { User } from "@supabase/supabase-js";
import { COUNTRIES } from "@/data/countryCityData";
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
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user, isReady } = useAuthReady();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const tapId = searchParams.get("tap_id");
  const { sendCourseStatus } = useGHLFormWebhook();

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("verifying");
  const [confettiFired, setConfettiFired] = useState(false);
  const retryCountRef = useRef(0);
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
    enabled: !!courseId,
  });

  // Meta Pixel + n8n webhook on successful verification
  useEffect(() => {
    if (verifyStatus === "succeeded" && course && courseId) {
      trackPurchase({
        content_name: course.title,
        content_ids: [courseId],
        content_type: "product",
        value: course.price ?? 0,
        currency: "SAR",
      });
      if (user) {
        sendCourseStatus(user.id, courseId, course.title, "purchased", {
          full_name: profile?.full_name || "",
          email: user.email || "",
          phone: profile?.phone || "",
          country:
            COUNTRIES.find((c) => c.en === profile?.country || c.ar === profile?.country || c.code === profile?.country)
              ?.code ||
            profile?.country ||
            "",
          city: profile?.city || "",
          address: [profile?.city, profile?.country].filter(Boolean).join(", "),
          amount: String(course.price ?? 0),
          dateOfBirth: profile?.date_of_birth || "",
          gender: profile?.gender || "",
          silent: true,
        });
        // Send order data to n8n webhook (fire-and-forget)
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
      }
    }
  }, [verifyStatus, course, courseId]);

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
          if (user) {
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
          if (user) {
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
  }, [tapId, isReady]);

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

  const courseTitle = isRTL && course?.title_ar ? course.title_ar : course?.title;

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
          <Button onClick={() => navigate(`/courses/${courseId}`)} variant="cta" className="h-12 px-8 rounded-2xl">
            {t("payment.backToCourse")}
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
          <Button onClick={() => navigate(`/courses/${courseId}`)} variant="cta" className="h-12 px-8 rounded-2xl">
            {t("payment.backToCourse")}
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
          <Button onClick={() => navigate(`/courses/${courseId}`)} variant="cta" className="h-12 px-8 rounded-2xl">
            {t("payment.backToCourse")}
          </Button>
        </motion.div>
      </div>
    );
  }

  // Success state
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
              <Button className="w-full btn-cta h-12 text-base font-bold shadow-xl shadow-primary/20" asChild>
                <Link to={`/courses/${courseId}/learn?welcome=1`}>
                  {t("payment.startLearning")}
                  <ArrowIcon className="w-5 h-5 ms-2" />
                </Link>
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-sm text-muted-foreground"
            >
              {t("payment.welcomeFamily")}
            </motion.p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;
