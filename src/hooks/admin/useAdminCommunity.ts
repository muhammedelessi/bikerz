import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 20;

export interface CommunityMember {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  country: string;
  city: string;
  has_motorcycle: boolean;
  considering_purchase: string | null;
  created_at: string;
}

export const useAdminCommunity = ({
  searchQuery,
  filterCountry,
  filterMotorcycle,
  page,
}: {
  searchQuery: string;
  filterCountry: string;
  filterMotorcycle: string;
  page: number;
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-community-members', searchQuery, filterCountry, filterMotorcycle, page],
    queryFn: async () => {
      let query = supabase.from('community_members' as any).select('*', { count: 'exact' }) as any;
      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`full_name.ilike.${q},email.ilike.${q},phone.ilike.${q},city.ilike.${q}`);
      }
      if (filterCountry !== 'all') query = query.eq('country', filterCountry);
      if (filterMotorcycle !== 'all') query = query.eq('has_motorcycle', filterMotorcycle === 'yes');
      query = query.order('created_at', { ascending: false });
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      return { members: (data || []) as CommunityMember[], total: count || 0 };
    },
  });

  const { data: countries } = useQuery({
    queryKey: ['admin-community-countries'],
    queryFn: async () => {
      const { data } = await (supabase.from('community_members' as any).select('country') as any);
      const unique = [...new Set((data || []).map((d: any) => d.country))].filter(Boolean).sort();
      return unique as string[];
    },
  });

  const members = data?.members || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return {
    members,
    total,
    totalPages,
    countries,
    isLoading,
  };
};
