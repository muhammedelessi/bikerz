import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BundleTierRow } from '@/types/bundle';

export function useBundleTiers() {
  return useQuery({
    queryKey: ['bundle-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bundle_tiers')
        .select('*')
        .order('min_courses', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BundleTierRow[];
    },
    staleTime: 60_000,
  });
}
