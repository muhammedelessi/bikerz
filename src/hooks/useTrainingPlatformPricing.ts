import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  parseMarkupPercentFromAdminValue,
  parseVatPercentFromAdminValue,
  parseExtraFeesPercentFromAdminValue,
} from "@/lib/trainingPlatformMarkup";

const MARKUP_KEY = "training_platform_markup_percent";
const VAT_KEY = "training_platform_vat_percent";
const EXTRA_FEES_KEY = "training_extra_fees_percent";

/**
 * Admin-configurable price-modifier set applied on top of trainer-listed
 * SAR base when computing what the trainee actually pays.
 *
 * - markupPercent      = Bikerz commission on top of trainer's listed price
 * - vatPercent         = Saudi VAT (uncapped — admin enters whatever the
 *                        regulator requires that quarter)
 * - extraFeesPercent   = combined transfer + energy-company surcharge.
 *                        Single field instead of two so the admin enters
 *                        ONE number; receipts can still itemise it as
 *                        "transfer + energy fees" downstream.
 */
export type TrainingPlatformPricing = {
  markupPercent: number;
  vatPercent: number;
  extraFeesPercent: number;
};

export function useTrainingPlatformPricing() {
  return useQuery({
    queryKey: ["admin-training-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", [MARKUP_KEY, VAT_KEY, EXTRA_FEES_KEY]);
      if (error) throw error;
      const rows = data || [];
      const byKey = (k: string) => rows.find((r) => r.key === k)?.value;
      return {
        markupPercent: parseMarkupPercentFromAdminValue(byKey(MARKUP_KEY)),
        vatPercent: parseVatPercentFromAdminValue(byKey(VAT_KEY)),
        extraFeesPercent: parseExtraFeesPercentFromAdminValue(byKey(EXTRA_FEES_KEY)),
      } satisfies TrainingPlatformPricing;
    },
    staleTime: 60_000,
  });
}

/** Backward-compatible: returns the same React Query shape but `data` is markup % only. */
export function useTrainingPlatformMarkupPercent() {
  const q = useTrainingPlatformPricing();
  return {
    ...q,
    data: q.data?.markupPercent ?? 0,
  };
}
