import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAdminContent = () => {
  const queryClient = useQueryClient();
  const dbFrom = (table: string) => supabase.from(table as any);
  return { useRQ: useQuery, useRM: useMutation, queryClient, dbFrom };
};
