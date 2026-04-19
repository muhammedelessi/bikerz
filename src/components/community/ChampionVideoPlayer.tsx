import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Loader2, Trash2, Radio, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AuthPromptDialog from "@/components/common/AuthPromptDialog";
import { extractYoutubeId, youtubeEmbedUrl, youtubeThumbnailUrl } from "@/lib/youtube";
import {
  useVideoLikes,
  useVideoComments,
} from "@/hooks/useChampionVideoInteractions";
import type { ChampionVideoRow } from "@/hooks/useChampions";

interface Props {
  video: ChampionVideoRow;
  championName: string;
  /** Detail page: show comments expanded by default. */
  defaultCommentsOpen?: boolean;
  /** Where to return after login (e.g. current video URL). */
  returnTo?: string;
  /** When false, title/“by” block is hidden (e.g. page already shows them above the card). */
  showTitleInCard?: boolean;
}

const ChampionVideoPlayer: React.FC<Props> = ({
  video,
  championName,
  defaultCommentsOpen = false,
  returnTo,
  showTitleInCard = true,
}) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const dateLocale = isRTL ? ar : enUS;

  const videoId = extractYoutubeId(video.youtube_url);
  const thumbnail = video.thumbnail_url || (videoId ? youtubeThumbnailUrl(videoId) : null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(defaultCommentsOpen);
  const [commentText, setCommentText] = useState("");
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  const likes = useVideoLikes(video.id);
  const comments = useVideoComments(video.id);

  const isPodcast = video.video_type === "podcast";

  const handleLikeClick = () => {
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }
    likes.toggleLike();
  };

  const handleCommentToggle = () => {
    setShowComments((prev) => !prev);
  };

  const handleAddComment = async () => {
    if (!user) {
      setAuthPromptOpen(true);
      return;
    }
    const trimmed = commentText.trim();
    if (!trimmed) return;
    try {
      await comments.addComment(trimmed);
      setCommentText("");
    } catch (err: any) {
      toast.error(isRTL ? "فشل إرسال التعليق" : "Failed to post comment");
      console.error(err);
    }
  };

  const handleDeleteComment = async (id: string) => {
    try {
      await comments.deleteComment(id);
    } catch {
      toast.error(isRTL ? "فشل حذف التعليق" : "Failed to delete comment");
    }
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border border-border/60 bg-card",
      )}
    >
      {/* Video header / type badge — hidden when page already shows meta */}
      {showTitleInCard && (
        <div className="flex items-center gap-2 px-3 pt-3 sm:px-4 sm:pt-4">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              isPodcast
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-primary/15 text-primary",
            )}
          >
            {isPodcast ? (
              <Radio className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {isPodcast ? (isRTL ? "بودكاست" : "Podcast") : isRTL ? "فيديو" : "Video"}
          </span>
        </div>
      )}

      {/* Player */}
      <div className={cn("relative aspect-video bg-black", showTitleInCard ? "mt-2" : "")}>
        {videoId ? (
          isPlaying ? (
            <iframe
              src={`${youtubeEmbedUrl(videoId)}&autoplay=1`}
              title={video.title}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 group w-full h-full"
              aria-label={isRTL ? "تشغيل الفيديو" : "Play video"}
            >
              {thumbnail && (
                <img
                  src={thumbnail}
                  alt={video.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/15">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-105">
                  <Play className="h-6 w-6 translate-x-0.5 text-black" fill="currentColor" />
                </div>
              </div>
            </button>
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
            {isRTL ? "رابط فيديو غير صالح" : "Invalid video URL"}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="space-y-2 p-3 sm:p-4 sm:pt-3">
        {showTitleInCard && (
          <div>
            <h3 className="text-sm font-semibold leading-snug text-foreground sm:text-base">
              {video.title}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isRTL ? "بواسطة" : "by"} {championName}
            </p>
          </div>
        )}

        {video.description && (
          <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line sm:text-sm">
            {video.description}
          </p>
        )}

        {/* Action row */}
        <div className="flex items-center gap-1 pt-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLikeClick}
            disabled={likes.isToggling}
            className={cn(
              "h-8 gap-1",
              likes.likedByMe && "text-rose-500 hover:text-rose-500",
            )}
          >
            <Heart
              className={cn("w-4 h-4", likes.likedByMe && "fill-current")}
            />
            <span className="text-xs font-semibold tabular-nums">
              {likes.count}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCommentToggle}
            className="h-8 gap-1"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs font-semibold tabular-nums">
              {comments.comments.length}
            </span>
          </Button>
        </div>

        {/* Comments */}
        {showComments && (
          <div className="space-y-2 border-t border-border/40 pt-2">
            <div className="flex items-start gap-2">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={
                  user
                    ? isRTL
                      ? "أضف تعليقاً..."
                      : "Add a comment..."
                    : isRTL
                      ? "سجّل دخول للتعليق"
                      : "Sign in to comment"
                }
                rows={2}
                className="flex-1 resize-none text-sm"
                onFocus={() => {
                  if (!user) {
                    setAuthPromptOpen(true);
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={comments.isAdding || !commentText.trim()}
                className="h-9"
              >
                {comments.isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRTL ? (
                  "نشر"
                ) : (
                  "Post"
                )}
              </Button>
            </div>

            <div className="space-y-3">
              {comments.isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : comments.comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {isRTL ? "كن أول من يعلّق" : "Be the first to comment"}
                </p>
              ) : (
                comments.comments.map((c) => {
                  const initials = (c.author_name || "U")
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const canDelete = user?.id === c.user_id;
                  return (
                    <div key={c.id} className="flex items-start gap-2">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        {c.author_avatar && <AvatarImage src={c.author_avatar} />}
                        <AvatarFallback className="text-xs bg-muted">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 rounded-lg bg-muted/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {c.author_name || (isRTL ? "مستخدم" : "User")}
                          </p>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(new Date(c.created_at), {
                              addSuffix: true,
                              locale: dateLocale,
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">
                          {c.content}
                        </p>
                      </div>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteComment(c.id)}
                          disabled={comments.isDeleting}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <AuthPromptDialog
        open={authPromptOpen}
        onOpenChange={setAuthPromptOpen}
        returnTo={returnTo ?? "/community-champions"}
      />
    </article>
  );
};

export default ChampionVideoPlayer;
