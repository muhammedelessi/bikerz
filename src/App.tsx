import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { HelmetProvider } from "react-helmet-async";
import ScrollToTop from "@/components/common/ScrollToTop";
import ProductionThirdPartyTrackers from "@/components/common/ProductionThirdPartyTrackers";
import WhatsAppFloatingButton from "@/components/common/WhatsAppFloatingButton";
import { useAnalyticsTracking } from "@/hooks/useAnalyticsTracking";
import { shouldSkipMarketingAnalytics } from "@/lib/shouldSkipMarketingAnalytics";
import React, { Suspense, lazy, useEffect, useState } from "react";
import RequireInstructor from "@/components/auth/RequireInstructor";

const LAZY_IMPORT_RELOAD_KEY = "lazy-import-reload-pending";

const isChunkLoadError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
};

const lazyRetry = async (importFn: () => Promise<any>, retries = 2, delay = 800): Promise<any> => {
  try {
    const module = await importFn();

    if (!module?.default) {
      throw new Error("Lazy-loaded module is missing a default export");
    }

    try {
      sessionStorage.removeItem(LAZY_IMPORT_RELOAD_KEY);
    } catch {
      // Ignore storage failures in restricted browser contexts
    }

    return module;
  } catch (err) {
    // Stale chunk after a redeploy/HMR — retrying the same URL will not help.
    // Force a one-time hard reload so the browser fetches the new asset manifest.
    if (isChunkLoadError(err)) {
      try {
        const hasReloaded = sessionStorage.getItem(LAZY_IMPORT_RELOAD_KEY) === "1";
        if (!hasReloaded) {
          sessionStorage.setItem(LAZY_IMPORT_RELOAD_KEY, "1");
          window.location.reload();
          return new Promise(() => undefined);
        }
        sessionStorage.removeItem(LAZY_IMPORT_RELOAD_KEY);
      } catch {
        // ignore
      }
      throw err;
    }

    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return lazyRetry(importFn, retries - 1, delay);
    }

    try {
      const hasReloaded = sessionStorage.getItem(LAZY_IMPORT_RELOAD_KEY) === "1";
      if (!hasReloaded) {
        sessionStorage.setItem(LAZY_IMPORT_RELOAD_KEY, "1");
        window.location.reload();
        return new Promise(() => undefined);
      }
      sessionStorage.removeItem(LAZY_IMPORT_RELOAD_KEY);
    } catch {
      // Ignore storage failures and surface the original error below
    }

    throw err;
  }
};

const lazyPage = (importFn: () => Promise<any>) => lazy(() => lazyRetry(importFn));

const SocialProofNotification = lazyPage(() => import("@/components/common/SocialProofNotification"));

// Route-level code splitting — smaller initial JS. Suspense fallback is static (no pulse/shimmer) so it does not
// stack with each page’s own loading skeletons.
const Index = lazyPage(() => import("./pages/Index"));
const Courses = lazyPage(() => import("./pages/Courses"));
const TrainingBooking = lazyPage(() => import("./pages/TrainingBooking"));
const CourseDetail = lazyPage(() => import("./pages/CourseDetail"));
const Login = lazyPage(() => import("./pages/Login"));
const Signup = lazyPage(() => import("./pages/Signup"));
const Trainings = lazyPage(() => import("./pages/Trainings"));
const TrainingDetail = lazyPage(() => import("./pages/TrainingDetail"));
const Trainers = lazyPage(() => import("./pages/Trainers"));
const TrainerProfile = lazyPage(() => import("./pages/TrainerProfile"));

// Secondary public routes - lazy loaded
const ForgotPassword = lazyPage(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const AboutUs = lazyPage(() => import("./pages/AboutUs"));
const PrivacyPolicy = lazyPage(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyPage(() => import("./pages/TermsOfService"));
const ContactUs = lazyPage(() => import("./pages/ContactUs"));
const CourseLearn = lazyPage(() => import("./pages/CourseLearn"));
const DashboardLayout = lazyPage(() => import("./pages/DashboardLayout"));
const DashboardHome = lazyPage(() => import("./pages/DashboardHome"));
const DashboardTrainerWorkspace = lazyPage(() => import("./pages/DashboardTrainerWorkspace"));
const ProfileLayout = lazyPage(() => import("./pages/ProfileLayout"));
const ApplyTrainer = lazyPage(() => import("./pages/ApplyTrainer"));
const ProfileHome = lazyPage(() => import("./pages/ProfileHome"));
const AccountSettingsPage = lazyPage(() => import("./pages/AccountSettingsPage"));
const NotFound = lazyPage(() => import("./pages/NotFound"));
const PaymentSuccess = lazyPage(() => import("./pages/PaymentSuccess"));
const BookingPaymentComplete = lazyPage(() => import("./pages/BookingPaymentComplete"));
const BookingSuccess = lazyPage(() => import("./pages/BookingSuccess"));
const MyBookings = lazyPage(() => import("./pages/MyBookings"));
const JoinCommunity = lazyPage(() => import("./pages/JoinCommunity"));
const Bundles = lazyPage(() => import("./pages/Bundles"));
const Ambassador = lazyPage(() => import("./pages/Ambassador"));
const CommunityChampions = lazyPage(() => import("./pages/CommunityChampions"));
const ChampionVideosList = lazyPage(() => import("./pages/ChampionVideosList"));
const ChampionVideoDetail = lazyPage(() => import("./pages/ChampionVideoDetail"));

// Admin Pages - lazy loaded
const AdminHome = lazyPage(() => import("./pages/admin/AdminHome"));
const AdminCourses = lazyPage(() => import("./pages/admin/AdminCourses"));
const AdminCourseEditor = lazyPage(() => import("./pages/admin/AdminCourseEditor"));
const AdminUsers = lazyPage(() => import("./pages/admin/AdminUsers"));
const AdminInstructors = lazyPage(() => import("./pages/admin/AdminInstructors"));
const AdminPayments = lazyPage(() => import("./pages/admin/AdminPayments"));
const AdminCheckoutPaymentVisits = lazyPage(() => import("./pages/admin/AdminCheckoutPaymentVisits"));
const AdminAnalytics = lazyPage(() => import("./pages/admin/AdminAnalytics"));
const AdminRoles = lazyPage(() => import("./pages/admin/AdminRoles"));
const AdminSettings = lazyPage(() => import("./pages/admin/AdminSettings"));
const AdminSupport = lazyPage(() => import("./pages/admin/AdminSupport"));
const AdminLessonDiscussions = lazyPage(() => import("./pages/admin/AdminLessonDiscussions"));
const AdminContent = lazyPage(() => import("./pages/admin/AdminContent"));
const AdminCoupons = lazyPage(() => import("./pages/admin/AdminCoupons"));
const AdminCourseReviews = lazyPage(() => import("./pages/admin/AdminCourseReviews"));
const AdminCourseStudents = lazyPage(() => import("./pages/admin/AdminCourseStudents"));
const AdminStudentDetail = lazyPage(() => import("./pages/admin/AdminStudentDetail"));
const AdminAds = lazyPage(() => import("./pages/admin/AdminAds"));
const AdminCommunity = lazyPage(() => import("./pages/admin/AdminCommunity"));
const AdminTrainings = lazyPage(() => import("./pages/admin/AdminTrainings"));
const AdminTrainingProfile = lazyPage(() => import("./pages/admin/AdminTrainingProfile"));
const AdminTrainers = lazyPage(() => import("./pages/admin/AdminTrainers"));
const AdminTrainerApplicationDetail = lazyPage(() => import("./pages/admin/AdminTrainerApplicationDetail"));
const AdminTrainerProfile = lazyPage(() => import("./pages/admin/AdminTrainerProfile"));
const AdminTrainerPayments = lazyPage(() => import("./pages/admin/AdminTrainerPayments"));
const AdminTrainingStudents = lazyPage(() => import("./pages/admin/AdminTrainingStudents"));
const AdminTrainerReviews = lazyPage(() => import("./pages/admin/AdminTrainerReviews"));
const AdminBikeCatalog = lazyPage(() => import("./pages/admin/AdminBikeCatalog"));
const AdminRanks = lazyPage(() => import("./pages/admin/AdminRanks"));
const AdminChampions = lazyPage(() => import("./pages/admin/AdminChampions"));
const AdminChampionNew = lazyPage(() => import("./pages/admin/AdminChampionNew"));
const AdminChampionProfile = lazyPage(() => import("./pages/admin/AdminChampionProfile"));
const SurveyListPage = lazyPage(() => import("./pages/surveys/SurveyListPage"));
const SurveyPlayPage = lazyPage(() => import("./pages/surveys/SurveyPlayPage"));
const SurveyResultsPage = lazyPage(() => import("./pages/surveys/SurveyResultsPage"));
const AdminSurveys = lazyPage(() => import("./pages/admin/AdminSurveys"));
const AdminSurveyDetail = lazyPage(() => import("./pages/admin/AdminSurveyDetail"));
const AdminQuestionEdit = lazyPage(() => import("./pages/admin/AdminQuestionEdit"));
const AdminSurveyStats = lazyPage(() => import("./pages/admin/AdminSurveyStats"));
const AdminStudentSurveyDetail = lazyPage(() => import("./pages/admin/AdminStudentSurveyDetail"));
const DataFeed = lazyPage(() => import("./pages/DataFeed"));

const queryClient = new QueryClient();

/** Fills the viewport while a lazy route chunk loads. Static only — animated skeletons live on each page. */
const RouteChunkFallback = () => <div className="min-h-[100dvh] bg-background" aria-hidden />;

/** Full-screen spinner — only while auth session resolves in Protected/Admin route guards. */
const PageLoader = () => (
  <div className="min-h-[100dvh] flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Admin Route Component - checks for admin roles
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, canAccessAdmin, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Auth Route - redirects if already logged in
const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  if (user) return <Navigate to="/dashboard" replace />;
  // Don't block on session bootstrap — showing the form immediately improves LCP vs. a full-page spinner on cold loads.
  return <>{children}</>;
};

// Analytics tracker component - must be inside BrowserRouter
const AnalyticsTracker = () => {
  const { canAccessAdmin, profile } = useAuth();
  useAnalyticsTracking(shouldSkipMarketingAnalytics(canAccessAdmin, profile));
  return null;
};

// Deferred loader – renders SocialProofNotification after 4s idle to keep main thread free
const DeferredSocialProof = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = (window.requestIdleCallback || ((cb: IdleRequestCallback) => setTimeout(cb, 4000)))(
      () => setShow(true),
      { timeout: 5000 },
    );
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id as number);
      else clearTimeout(id as unknown as number);
    };
  }, []);
  if (!show) return null;
  return (
    <Suspense fallback={null}>
      <SocialProofNotification />
    </Suspense>
  );
};

/**
 * Apple Pay domain verification redirect.
 * Lovable's hosting cannot serve files from dot-directories (.well-known/),
 * so React Router intercepts the path. This component immediately sends the
 * browser to the Supabase Edge Function that holds the verification file.
 */
const ApplePayDomainVerify = () => {
  useEffect(() => {
    window.location.replace(
      "https://gifovgwlxwuiibfzyvwb.supabase.co/functions/v1/apple-pay-verify"
    );
  }, []);
  return null;
};

/** Floating WhatsApp CTA is for public / learner UX only, not admin consoles. */
const WhatsAppFloatingButtonGate = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;
  return <WhatsAppFloatingButton />;
};

const AppRoutes = () => (
  <>
    <AnalyticsTracker />
    <Suspense fallback={<RouteChunkFallback />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/bundles" element={<Bundles />} />
        <Route path="/trainings" element={<Trainings />} />
        <Route path="/trainings/:trainingId/book/:trainerCourseId" element={<TrainingBooking />} />
        <Route path="/trainings/:id" element={<TrainingDetail />} />
        <Route path="/trainers" element={<Trainers />} />
        <Route path="/trainers/:id" element={<TrainerProfile />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route
          path="/login"
          element={
            <AuthRoute>
              <Login />
            </AuthRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <AuthRoute>
              <Signup />
            </AuthRoute>
          }
        />

        {/* Secondary public routes */}
        <Route
          path="/forgot-password"
          element={
            <AuthRoute>
              <ForgotPassword />
            </AuthRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/courses/:id/learn" element={<CourseLearn />} />
        <Route path="/courses/:id/lessons/:lessonId" element={<CourseLearn />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route
          path="/booking-payment-complete"
          element={
            <ProtectedRoute>
              <BookingPaymentComplete />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking-success"
          element={
            <ProtectedRoute>
              <BookingSuccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute>
              <Navigate to="/profile/bookings" replace />
            </ProtectedRoute>
          }
        />
        <Route path="/join-community" element={<JoinCommunity />} />
        <Route path="/community-champions/:championId/videos/:videoId" element={<ChampionVideoDetail />} />
        <Route path="/community-champions/:championId" element={<ChampionVideosList />} />
        <Route path="/community-champions" element={<CommunityChampions />} />
        <Route path="/ambassador" element={<Ambassador />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardHome />} />
          <Route path="apply-trainer" element={<ApplyTrainer />} />
          <Route
            path="trainer"
            element={
              <RequireInstructor>
                <DashboardTrainerWorkspace />
              </RequireInstructor>
            }
          />
        </Route>
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfileLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ProfileHome />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="surveys" element={<SurveyListPage />} />
          <Route path="surveys/:surveyId/play" element={<SurveyPlayPage />} />
          <Route path="surveys/:surveyId/results" element={<SurveyResultsPage />} />
          <Route path="apply-trainer" element={<ApplyTrainer />} />
        </Route>
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AccountSettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminHome />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/courses"
          element={
            <AdminRoute>
              <AdminCourses />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/courses/new"
          element={
            <AdminRoute>
              <AdminCourseEditor />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/courses/:id"
          element={
            <AdminRoute>
              <AdminCourseEditor />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/instructors"
          element={
            <AdminRoute>
              <AdminInstructors />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <AdminRoute>
              <AdminPayments />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/checkout-visits"
          element={
            <AdminRoute>
              <AdminCheckoutPaymentVisits />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <AdminRoute>
              <AdminAnalytics />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <AdminRoute>
              <AdminRoles />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminRoute>
              <AdminSettings />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/support"
          element={
            <AdminRoute>
              <AdminSupport />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/discussions"
          element={
            <AdminRoute>
              <AdminLessonDiscussions />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/content"
          element={
            <AdminRoute>
              <AdminContent />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/coupons"
          element={
            <AdminRoute>
              <AdminCoupons />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/courses/:id/reviews"
          element={
            <AdminRoute>
              <AdminCourseReviews />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/courses/:id/students"
          element={
            <AdminRoute>
              <AdminCourseStudents />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/courses/:id/students/:userId"
          element={
            <AdminRoute>
              <AdminStudentDetail />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/ads"
          element={
            <AdminRoute>
              <AdminAds />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/community"
          element={
            <AdminRoute>
              <AdminCommunity />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/trainings"
          element={
            <AdminRoute>
              <AdminTrainings />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/trainings/:id"
          element={
            <AdminRoute>
              <AdminTrainingProfile />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/trainers"
          element={
            <AdminRoute>
              <AdminTrainers />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/trainer-applications/:applicationId"
          element={
            <AdminRoute>
              <AdminTrainerApplicationDetail />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/trainers/:id"
          element={
            <AdminRoute>
              <AdminTrainerProfile />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/trainers/:id/payments"
          element={
            <AdminRoute>
              <AdminTrainerPayments />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/training-students"
          element={
            <AdminRoute>
              <AdminTrainingStudents />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/trainer-reviews"
          element={
            <AdminRoute>
              <AdminTrainerReviews />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/bike-catalog"
          element={
            <AdminRoute>
              <AdminBikeCatalog />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/ranks"
          element={
            <AdminRoute>
              <AdminRanks />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/champions"
          element={
            <AdminRoute>
              <AdminChampions />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/champions/new"
          element={
            <AdminRoute>
              <AdminChampionNew />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/champions/:id"
          element={
            <AdminRoute>
              <AdminChampionProfile />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/surveys/statistics/:userId"
          element={
            <AdminRoute>
              <AdminStudentSurveyDetail />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/surveys/statistics"
          element={
            <AdminRoute>
              <AdminSurveyStats />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/surveys/:surveyId/questions/new"
          element={
            <AdminRoute>
              <AdminQuestionEdit />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/surveys/:surveyId/questions/:questionId"
          element={
            <AdminRoute>
              <AdminQuestionEdit />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/surveys/:surveyId"
          element={
            <AdminRoute>
              <AdminSurveyDetail />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/surveys"
          element={
            <AdminRoute>
              <AdminSurveys />
            </AdminRoute>
          }
        />

        {/* Meta product feed redirect */}
        <Route path="/datafeed.xml" element={<DataFeed />} />
        <Route path="/datafeed" element={<DataFeed />} />

        {/*
          Apple Pay domain verification — must come before the * catch-all.
          Lovable's hosting serves index.html for unknown paths (including
          dot-directories), so React Router receives this request. We redirect
          the browser to the Supabase Edge Function that holds the file content.
          The _redirects 301 rule handles direct server-to-server fetches
          (Apple/Tap verification bots that never load the React bundle).
        */}
        <Route
          path="/.well-known/apple-developer-merchantid-domain-association"
          element={<ApplePayDomainVerify />}
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </>
);

const SafeHelmetProvider = HelmetProvider as unknown as React.ComponentType<{
  children: React.ReactNode;
}>;

const App = () => (
  <SafeHelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CurrencyProvider>
          <AuthProvider>
            <ProductionThirdPartyTrackers />
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter
                future={{
                  // v7_startTransition was causing navigations to feel "stuck":
                  // every Link click went through React.startTransition, so when
                  // the target route's lazy chunk was suspending, React kept the
                  // OLD route (e.g. ApplyTrainer) on screen and only committed
                  // the new route after some unrelated re-render (selecting a
                  // date in the picker, etc.). Disabling it makes navigations
                  // commit immediately and show the route's Suspense fallback,
                  // which is the expected behavior.
                  v7_relativeSplatPath: true,
                }}
              >
                <ScrollToTop />
                <WhatsAppFloatingButtonGate />
                <DeferredSocialProof />
                <AppRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </SafeHelmetProvider>
);

export default App;
