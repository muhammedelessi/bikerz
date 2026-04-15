import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAdminCoupons = () => {
  const queryClient = useQueryClient();
  const dbFrom = (table: string) => (supabase as any).from(table);
  return { useRQ: useQuery, useRM: useMutation, queryClient, dbFrom };
};
