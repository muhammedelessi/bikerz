import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseMarkupPercentFromAdminValue, parseVatPercentFromAdminValue } from "@/lib/trainingPlatformMarkup";

const MARKUP_KEY = "training_platform_markup_percent";
const VAT_KEY = "training_platform_vat_percent";

export type TrainingPlatformPricing = {
  markupPercent: number;
  vatPercent: number;
};

export function useTrainingPlatformPricing() {
  return useQuery({
    queryKey: ["admin-training-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_settings").select("key, value").in("key", [MARKUP_KEY, VAT_KEY]);
      if (error) throw error;
      const rows = data || [];
      const markupRow = rows.find((r) => r.key === MARKUP_KEY);
      const vatRow = rows.find((r) => r.key === VAT_KEY);
      return {
        markupPercent: parseMarkupPercentFromAdminValue(markupRow?.value),
        vatPercent: parseVatPercentFromAdminValue(vatRow?.value),
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
