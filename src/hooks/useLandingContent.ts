import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HeroContent {
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  cta_en: string;
  cta_ar: string;
  secondary_cta_en: string;
  secondary_cta_ar: string;
  badge_text_en: string;
  badge_text_ar: string;
}

export interface WhyCard {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  icon: string;
}

export interface WhyContent {
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  cards: WhyCard[];
}

export interface JourneyStep {
  number: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  icon: string;
}

export interface JourneyContent {
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  steps: JourneyStep[];
}

export interface LearnSkill {
  key: string;
  text_en: string;
  text_ar: string;
  icon: string;
}

export interface LearnContent {
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  skills: LearnSkill[];
}

export interface TrustBadge {
  text_en: string;
  text_ar: string;
}

export interface CTAContent {
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  button_en: string;
  button_ar: string;
  trust_badges: TrustBadge[];
}

export interface CommunityContent {
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
}

export function useLandingContent<T>(section: string) {
  return useQuery({
    queryKey: ['landing-content', section],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', section)
        .eq('category', 'landing')
        .single();

      if (error) throw error;
      return data?.value as T;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllLandingContent() {
  return useQuery({
    queryKey: ['landing-content-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .eq('category', 'landing');

      if (error) throw error;
      
      const content: Record<string, unknown> = {};
      data?.forEach(item => {
        content[item.key] = item.value;
      });
      
      return content as {
        hero: HeroContent;
        why: WhyContent;
        journey: JourneyContent;
        learn: LearnContent;
        cta: CTAContent;
        community: CommunityContent;
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
