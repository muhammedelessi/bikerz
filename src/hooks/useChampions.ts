import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChampionRow {
  id: string;
  full_name: string;
  nickname: string | null;
  bio: string | null;
  photo_url: string | null;
  country: string | null;
  city: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
  podcast_url: string | null;
  website_url: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ChampionVideoRow {
  id: string;
  champion_id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  video_type: "video" | "podcast";
  thumbnail_url: string | null;
  /** Length in seconds (optional; from DB or fetched). */
  duration_seconds?: number | null;
  order_index: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChampionWithVideos extends ChampionRow {
  videos: ChampionVideoRow[];
}

export function useChampions() {
  return useQuery<ChampionWithVideos[]>({
    queryKey: ["public-community-champions"],
    queryFn: async () => {
      const { data: champions, error: champErr } = await (supabase as any)
        .from("community_champions")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });
      if (champErr) throw champErr;

      const ids = (champions ?? []).map((c: ChampionRow) => c.id);
      if (ids.length === 0) return [];

      const { data: videos, error: vidErr } = await (supabase as any)
        .from("champion_videos")
        .select("*")
        .in("champion_id", ids)
        .eq("published", true)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });
      if (vidErr) throw vidErr;

      const videosByChampion = new Map<string, ChampionVideoRow[]>();
      for (const v of (videos ?? []) as ChampionVideoRow[]) {
        const list = videosByChampion.get(v.champion_id) ?? [];
        list.push(v);
        videosByChampion.set(v.champion_id, list);
      }

      return (champions as ChampionRow[]).map((c) => ({
        ...c,
        videos: videosByChampion.get(c.id) ?? [],
      }));
    },
  });
}

/** Single active champion + published videos (public detail / video pages). */
export function useChampionById(championId: string | undefined) {
  return useQuery<ChampionWithVideos | null>({
    queryKey: ["public-community-champion", championId],
    enabled: !!championId,
    queryFn: async () => {
      const { data: champion, error: ce } = await (supabase as any)
        .from("community_champions")
        .select("*")
        .eq("id", championId)
        .eq("is_active", true)
        .maybeSingle();
      if (ce) throw ce;
      if (!champion) return null;

      const { data: videos, error: ve } = await (supabase as any)
        .from("champion_videos")
        .select("*")
        .eq("champion_id", championId)
        .eq("published", true)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });
      if (ve) throw ve;

      return {
        ...(champion as ChampionRow),
        videos: (videos ?? []) as ChampionVideoRow[],
      };
    },
  });
}
