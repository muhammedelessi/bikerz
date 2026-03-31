import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/query-core";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { HelmetProvider } from "react-helmet-async";
import ScrollToTop from "@/components/common/ScrollToTop";
import WhatsAppFloatingButton from "@/components/common/WhatsAppFloatingButton";
import { useAnalyticsTracking } from "@/hooks/useAnalyticsTracking";
import React, { Suspense, lazy, useEffect, useState } from "react";

const lazyRetry = (importFn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> =>
  importFn().catch((err: Error) => {
    if (retries <= 0) throw err;
    return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
      lazyRetry(importFn, retries - 1, delay)
    );
  });

const SocialProofNotification = lazy(() => lazyRetry(() => import("@/components/common/SocialProofNotification")));

// Critical routes - loaded eagerly (above-the-fold / high-traffic)
import Index from "./pages/Index";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

// Secondary public routes - lazy loaded
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const CourseLearn = lazy(() => import("./pages/CourseLearn"));
const Mentors = lazy(() => import("./pages/Mentors"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const JoinCommunity = lazy(() => import("./pages/JoinCommunity"));

// Admin Pages - lazy loaded
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const AdminCourses = lazy(() => import("./pages/admin/AdminCourses"));
const AdminCourseEditor = lazy(() => import("./pages/admin/AdminCourseEditor"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminInstructors = lazy(() => import("./pages/admin/AdminInstructors"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminRoles = lazy(() => import("./pages/admin/AdminRoles"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminLessonDiscussions = lazy(() => import("./pages/admin/AdminLessonDiscussions"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminCourseReviews = lazy(() => import("./pages/admin/AdminCourseReviews"));
const AdminCourseStudents = lazy(() => import("./pages/admin/AdminCourseStudents"));
const AdminStudentDetail = lazy(() => import("./pages/admin/AdminStudentDetail"));
const AdminAds = lazy(() => import("./pages/admin/AdminAds"));
const AdminCommunity = lazy(() => import("./pages/admin/AdminCommunity"));

const queryClient = new QueryClient();

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
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Analytics tracker component - must be inside BrowserRouter
const AnalyticsTracker = () => {
  useAnalyticsTracking();
  return null;
};

// Deferred loader – renders SocialProofNotification after 4s idle to keep main thread free
const DeferredSocialProof = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = (window.requestIdleCallback || ((cb: IdleRequestCallback) => setTimeout(cb, 4000)))(
      () => setShow(true),
      { timeout: 5000 }
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

const AppRoutes = () => (
  <>
    <AnalyticsTracker />
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Critical eager-loaded routes */}
        <Route path="/" element={<Index />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
        <Route path="/signup" element={<AuthRoute><Signup /></AuthRoute>} />

        {/* Secondary public routes */}
        <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/courses/:id/learn" element={<CourseLearn />} />
        <Route path="/courses/:id/lessons/:lessonId" element={<CourseLearn />} />
        <Route path="/mentors" element={<Mentors />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/join-community" element={<JoinCommunity />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><AdminHome /></AdminRoute>} />
        <Route path="/admin/courses" element={<AdminRoute><AdminCourses /></AdminRoute>} />
        <Route path="/admin/courses/new" element={<AdminRoute><AdminCourseEditor /></AdminRoute>} />
        <Route path="/admin/courses/:id" element={<AdminRoute><AdminCourseEditor /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/instructors" element={<AdminRoute><AdminInstructors /></AdminRoute>} />
        <Route path="/admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
        <Route path="/admin/roles" element={<AdminRoute><AdminRoles /></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
        <Route path="/admin/support" element={<AdminRoute><AdminSupport /></AdminRoute>} />
        <Route path="/admin/discussions" element={<AdminRoute><AdminLessonDiscussions /></AdminRoute>} />
        <Route path="/admin/content" element={<AdminRoute><AdminContent /></AdminRoute>} />
        <Route path="/admin/coupons" element={<AdminRoute><AdminCoupons /></AdminRoute>} />
        <Route path="/admin/courses/:id/reviews" element={<AdminRoute><AdminCourseReviews /></AdminRoute>} />
        <Route path="/admin/courses/:id/students" element={<AdminRoute><AdminCourseStudents /></AdminRoute>} />
        <Route path="/admin/courses/:id/students/:userId" element={<AdminRoute><AdminStudentDetail /></AdminRoute>} />
        <Route path="/admin/ads" element={<AdminRoute><AdminAds /></AdminRoute>} />
        <Route path="/admin/community" element={<AdminRoute><AdminCommunity /></AdminRoute>} />

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
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <WhatsAppFloatingButton />
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
