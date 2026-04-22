import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SurveyQuestion } from "@/types/survey";

export type CatalogRefKind = NonNullable<SurveyQuestion["catalog_ref_type"]>;

export function useBikeTypesCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ["catalog", "bike_types"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("bike_types").select("id, name_ar, name_en, sort_order").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBikeSubtypesCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ["catalog", "bike_subtypes"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("bike_subtypes").select("id, name_ar, name_en, sort_order, type_id").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBikeModelsCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ["catalog", "bike_models"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("bike_models").select("id, brand, model_name, sort_order, subtype_id").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}
