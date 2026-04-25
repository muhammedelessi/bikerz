import { useEffect, useState, type FC } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { installBikerzProductionTrackers } from "@/lib/bikerzProductionTrackers.js";
import { shouldSkipMarketingAnalytics } from "@/lib/shouldSkipMarketingAnalytics";

const PROD = typeof window !== "undefined" && window.location.hostname === "academy.bikerz.com";

/**
 * Loads Clarity, GA4, Meta Pixel, TikTok, and GHL **only** on the production host and **never** for staff:
 * `canAccessAdmin` (`user_roles`) or `profiles.role` (e.g. `admin`, `academy_admin`, …).
 */
const ProductionThirdPartyTrackers: FC = () => {
  const { isLoading, user, canAccessAdmin, profile } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);

  // Let auth/roles settle after SIGNED_IN (onAuthStateChange fetches `user_roles` in a follow-up task).
  useEffect(() => {
    if (isLoading) {
      setGateOpen(false);
      return;
    }
    if (!user) {
      setGateOpen(true);
      return;
    }
    setGateOpen(false);
    const t = window.setTimeout(() => setGateOpen(true), 800);
    return () => clearTimeout(t);
  }, [isLoading, user?.id]);

  const skip = shouldSkipMarketingAnalytics(canAccessAdmin, profile);

  useEffect(() => {
    if (!PROD) return;
    if (!gateOpen) return;
    if (skip) return;
    installBikerzProductionTrackers();
  }, [gateOpen, skip]);

  return null;
};

export default ProductionThirdPartyTrackers;
