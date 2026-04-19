import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChampionRow, ChampionVideoRow } from "@/hooks/useChampions";

export interface ChampionWithStats extends ChampionRow {
  video_count: number;
  total_likes: number;
  total_comments: number;
}

export interface ChampionVideoWithStats extends ChampionVideoRow {
  likes_count: number;
  comments_count: number;
}

export function useAdminChampions() {
  const queryClient = useQueryClient();

  const list = useQuery<ChampionWithStats[]>({
    queryKey: ["admin-champions-list"],
    queryFn: async () => {
      const { data: champions, error } = await (supabase as any)
        .from("community_champions")
        .select("*")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const champs = (champions ?? []) as ChampionRow[];
      if (champs.length === 0) return [];

      const ids = champs.map((c) => c.id);

      const { data: videos } = await (supabase as any)
        .from("champion_videos")
        .select("id, champion_id")
        .in("champion_id", ids);

      const videoIds = ((videos ?? []) as { id: string; champion_id: string }[]).map((v) => v.id);
      const videoToChampion = new Map(
        ((videos ?? []) as { id: string; champion_id: string }[]).map((v) => [v.id, v.champion_id]),
      );

      let likesByChampion = new Map<string, number>();
      let commentsByChampion = new Map<string, number>();

      if (videoIds.length > 0) {
        const { data: likes } = await (supabase as any)
          .from("champion_video_likes")
          .select("video_id")
          .in("video_id", videoIds);
        for (const l of (likes ?? []) as { video_id: string }[]) {
          const champId = videoToChampion.get(l.video_id);
          if (!champId) continue;
          likesByChampion.set(champId, (likesByChampion.get(champId) ?? 0) + 1);
        }

        const { data: comments } = await (supabase as any)
          .from("champion_video_comments")
          .select("video_id")
          .in("video_id", videoIds);
        for (const c of (comments ?? []) as { video_id: string }[]) {
          const champId = videoToChampion.get(c.video_id);
          if (!champId) continue;
          commentsByChampion.set(champId, (commentsByChampion.get(champId) ?? 0) + 1);
        }
      }

      const videoCountByChampion = new Map<string, number>();
      for (const v of (videos ?? []) as { id: string; champion_id: string }[]) {
        videoCountByChampion.set(v.champion_id, (videoCountByChampion.get(v.champion_id) ?? 0) + 1);
      }

      return champs.map((c) => ({
        ...c,
        video_count: videoCountByChampion.get(c.id) ?? 0,
        total_likes: likesByChampion.get(c.id) ?? 0,
        total_comments: commentsByChampion.get(c.id) ?? 0,
      }));
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<ChampionRow>) => {
      const { data, error } = await (supabase as any)
        .from("community_champions")
        .insert({
          full_name: payload.full_name,
          nickname: payload.nickname ?? null,
          bio: payload.bio ?? null,
          photo_url: payload.photo_url ?? null,
          country: payload.country ?? null,
          city: payload.city ?? null,
          instagram_url: payload.instagram_url ?? null,
          youtube_url: payload.youtube_url ?? null,
          tiktok_url: payload.tiktok_url ?? null,
          podcast_url: payload.podcast_url ?? null,
          website_url: payload.website_url ?? null,
          is_active: payload.is_active ?? true,
          order_index: payload.order_index ?? 0,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as ChampionRow;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-champions-list"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("community_champions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-champions-list"] }),
  });

  return {
    champions: list.data ?? [],
    isLoading: list.isLoading,
    createChampion: (p: Partial<ChampionRow>) => create.mutateAsync(p),
    isCreating: create.isPending,
    deleteChampion: (id: string) => remove.mutateAsync(id),
    isDeleting: remove.isPending,
  };
}

export function useAdminChampion(id: string | null | undefined) {
  const queryClient = useQueryClient();

  const champion = useQuery<ChampionRow | null>({
    queryKey: ["admin-champion", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("community_champions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ChampionRow | null;
    },
  });

  const videos = useQuery<ChampionVideoWithStats[]>({
    queryKey: ["admin-champion-videos", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: vids, error } = await (supabase as any)
        .from("champion_videos")
        .select("*")
        .eq("champion_id", id)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (vids ?? []) as ChampionVideoRow[];
      if (rows.length === 0) return [];

      const videoIds = rows.map((v) => v.id);

      const { data: likes } = await (supabase as any)
        .from("champion_video_likes")
        .select("video_id")
        .in("video_id", videoIds);
      const likesByVideo = new Map<string, number>();
      for (const l of (likes ?? []) as { video_id: string }[]) {
        likesByVideo.set(l.video_id, (likesByVideo.get(l.video_id) ?? 0) + 1);
      }

      const { data: comments } = await (supabase as any)
        .from("champion_video_comments")
        .select("video_id")
        .in("video_id", videoIds);
      const commentsByVideo = new Map<string, number>();
      for (const c of (comments ?? []) as { video_id: string }[]) {
        commentsByVideo.set(c.video_id, (commentsByVideo.get(c.video_id) ?? 0) + 1);
      }

      return rows.map((v) => ({
        ...v,
        likes_count: likesByVideo.get(v.id) ?? 0,
        comments_count: commentsByVideo.get(v.id) ?? 0,
      }));
    },
  });

  const updateChampion = useMutation({
    mutationFn: async (patch: Partial<ChampionRow>) => {
      const { error } = await (supabase as any)
        .from("community_champions")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-champion", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-champions-list"] });
    },
  });

  const createVideo = useMutation({
    mutationFn: async (payload: Partial<ChampionVideoRow>) => {
      const { error } = await (supabase as any).from("champion_videos").insert({
        champion_id: id,
        title: payload.title,
        description: payload.description ?? null,
        youtube_url: payload.youtube_url,
        video_type: payload.video_type ?? "video",
        thumbnail_url: payload.thumbnail_url ?? null,
        order_index: payload.order_index ?? 0,
        published: payload.published ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-champion-videos", id] }),
  });

  const updateVideo = useMutation({
    mutationFn: async ({ videoId, patch }: { videoId: string; patch: Partial<ChampionVideoRow> }) => {
      const { error } = await (supabase as any)
        .from("champion_videos")
        .update(patch)
        .eq("id", videoId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-champion-videos", id] }),
  });

  const deleteVideo = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await (supabase as any)
        .from("champion_videos")
        .delete()
        .eq("id", videoId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-champion-videos", id] }),
  });

  return {
    champion: champion.data ?? null,
    isLoading: champion.isLoading,
    videos: videos.data ?? [],
    isVideosLoading: videos.isLoading,
    updateChampion: (p: Partial<ChampionRow>) => updateChampion.mutateAsync(p),
    isUpdatingChampion: updateChampion.isPending,
    createVideo: (p: Partial<ChampionVideoRow>) => createVideo.mutateAsync(p),
    isCreatingVideo: createVideo.isPending,
    updateVideo: (videoId: string, patch: Partial<ChampionVideoRow>) =>
      updateVideo.mutateAsync({ videoId, patch }),
    isUpdatingVideo: updateVideo.isPending,
    deleteVideo: (videoId: string) => deleteVideo.mutateAsync(videoId),
    isDeletingVideo: deleteVideo.isPending,
  };
}

export interface VideoInteractionDetail {
  likes: {
    id: string;
    user_id: string;
    created_at: string;
    user_name: string | null;
    user_avatar: string | null;
  }[];
  comments: {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    user_name: string | null;
    user_avatar: string | null;
  }[];
}

export function useAdminVideoInteractions(videoId: string | null | undefined) {
  return useQuery<VideoInteractionDetail>({
    queryKey: ["admin-champion-video-interactions", videoId],
    enabled: !!videoId,
    queryFn: async () => {
      const { data: likes, error: likesErr } = await (supabase as any)
        .from("champion_video_likes")
        .select("id, user_id, created_at")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false });
      if (likesErr) throw likesErr;

      const { data: comments, error: cErr } = await (supabase as any)
        .from("champion_video_comments")
        .select("id, user_id, content, created_at")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false });
      if (cErr) throw cErr;

      const userIds = Array.from(
        new Set([
          ...((likes ?? []) as { user_id: string }[]).map((l) => l.user_id),
          ...((comments ?? []) as { user_id: string }[]).map((c) => c.user_id),
        ]),
      );

      const profileMap = new Map<string, { name: string | null; avatar: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        for (const p of (profiles ?? []) as any[]) {
          profileMap.set(p.user_id, {
            name: p.full_name ?? null,
            avatar: p.avatar_url ?? null,
          });
        }
      }

      return {
        likes: ((likes ?? []) as any[]).map((l) => ({
          ...l,
          user_name: profileMap.get(l.user_id)?.name ?? null,
          user_avatar: profileMap.get(l.user_id)?.avatar ?? null,
        })),
        comments: ((comments ?? []) as any[]).map((c) => ({
          ...c,
          user_name: profileMap.get(c.user_id)?.name ?? null,
          user_avatar: profileMap.get(c.user_id)?.avatar ?? null,
        })),
      };
    },
  });
}
