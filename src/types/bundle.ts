import type { Tables } from '@/integrations/supabase/types';

export type BundleTierRow = Tables<'bundle_tiers'>;

export type BundleCourseInput = {
  id: string;
  price: number;
  discount_percentage?: number | null;
  discount_expires_at?: string | null;
  vat_percentage?: number | null;
};
