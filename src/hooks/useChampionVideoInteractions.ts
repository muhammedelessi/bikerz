import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChampionVideoCommentRow {
  id: string;
  video_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
  author_avatar?: string | null;
}

interface LikeSummary {
  count: number;
  likedByMe: boolean;
}

export function useVideoLikes(videoId: string | null | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<LikeSummary>({
    queryKey: ["champion-video-likes", videoId, user?.id ?? "anon"],
    enabled: !!videoId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("champion_video_likes")
        .select("id", { count: "exact", head: true })
        .eq("video_id", videoId);
      if (error) throw error;

      let likedByMe = false;
      if (user?.id) {
        const { data: mine } = await (supabase as any)
          .from("champion_video_likes")
          .select("id")
          .eq("video_id", videoId)
          .eq("user_id", user.id)
          .maybeSingle();
        likedByMe = !!mine;
      }
      return { count: count ?? 0, likedByMe };
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user?.id || !videoId) throw new Error("NOT_AUTHENTICATED");
      const current = query.data?.likedByMe ?? false;
      if (current) {
        const { error } = await (supabase as any)
          .from("champion_video_likes")
          .delete()
          .eq("video_id", videoId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("champion_video_likes")
          .insert({ video_id: videoId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["champion-video-likes", videoId] });
    },
  });

  return {
    count: query.data?.count ?? 0,
    likedByMe: query.data?.likedByMe ?? false,
    isLoading: query.isLoading,
    toggleLike: () => toggle.mutate(),
    isToggling: toggle.isPending,
  };
}

export function useVideoComments(videoId: string | null | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<ChampionVideoCommentRow[]>({
    queryKey: ["champion-video-comments", videoId],
    enabled: !!videoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("champion_video_comments")
        .select("*")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as ChampionVideoCommentRow[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      if (userIds.length === 0) return rows;

      const { data: profiles } = await (supabase as any)
        .from("public_profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);

      const byId = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      for (const p of (profiles ?? []) as any[]) {
        byId.set(p.user_id, { full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null });
      }

      return rows.map((r) => ({
        ...r,
        author_name: byId.get(r.user_id)?.full_name ?? null,
        author_avatar: byId.get(r.user_id)?.avatar_url ?? null,
      }));
    },
  });

  const add = useMutation({
    mutationFn: async (content: string) => {
      if (!user?.id || !videoId) throw new Error("NOT_AUTHENTICATED");
      const trimmed = content.trim();
      if (!trimmed) throw new Error("EMPTY_COMMENT");
      const { error } = await (supabase as any)
        .from("champion_video_comments")
        .insert({ video_id: videoId, user_id: user.id, content: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["champion-video-comments", videoId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await (supabase as any)
        .from("champion_video_comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["champion-video-comments", videoId] });
    },
  });

  return {
    comments: query.data ?? [],
    isLoading: query.isLoading,
    addComment: (content: string) => add.mutateAsync(content),
    isAdding: add.isPending,
    deleteComment: (id: string) => remove.mutateAsync(id),
    isDeleting: remove.isPending,
  };
}
