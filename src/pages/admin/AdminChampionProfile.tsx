import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  MessageCircle,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Play,
  Radio,
  Save,
  Eye,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAdminChampion,
  useAdminVideoInteractions,
  type ChampionVideoWithStats,
} from "@/hooks/admin/useAdminChampions";
import { extractYoutubeId, youtubeThumbnailUrl } from "@/lib/youtube";
import { CountryCityPicker } from "@/components/ui/fields/CountryCityPicker";
import { COUNTRIES } from "@/data/countryCityData";
import type { AmbassadorClipCategory } from "@/lib/championAmbassadorClipCategories";
import { ambassadorClipCategoryLabel } from "@/lib/championAmbassadorClipCategories";
import AmbassadorClipCategorySelect from "@/components/admin/AmbassadorClipCategorySelect";

const OTHER_VALUE = "__other__";

/** DB stores English country name (from picker resolve); city may be EN or AR from picker. */
function mapStoredToPicker(
  countryStored: string | null,
  cityStored: string | null,
  isRTL: boolean,
): {
  country: string;
  city: string;
  custom_country: string;
  custom_city: string;
} {
  if (!countryStored) {
    return { country: "", city: "", custom_country: "", custom_city: "" };
  }
  const entry = COUNTRIES.find(
    (c) =>
      c.code === countryStored ||
      c.en === countryStored ||
      c.ar === countryStored,
  );
  if (!entry) {
    return {
      country: OTHER_VALUE,
      custom_country: countryStored,
      city: cityStored ? OTHER_VALUE : "",
      custom_city: cityStored ?? "",
    };
  }
  const code = entry.code;
  if (!cityStored) {
    return { country: code, city: "", custom_country: "", custom_city: "" };
  }
  const hit = entry.cities.find(
    (ct) => ct.en === cityStored || ct.ar === cityStored,
  );
  if (hit) {
    return {
      country: code,
      city: isRTL ? hit.ar : hit.en,
      custom_country: "",
      custom_city: "",
    };
  }
  return {
    country: code,
    city: OTHER_VALUE,
    custom_country: "",
    custom_city: cityStored,
  };
}

function resolveCountryName(code: string, custom: string): string | null {
  if (!code) return null;
  if (code === OTHER_VALUE) return custom.trim() || null;
  const e = COUNTRIES.find((c) => c.code === code);
  return e ? e.en : null;
}

function resolveCity(city: string, custom: string): string | null {
  if (!city) return null;
  if (city === OTHER_VALUE) return custom.trim() || null;
  return city;
}

type VideoFormState = {
  id?: string;
  title: string;
  description: string;
  youtube_url: string;
  video_type: "video" | "podcast";
  ambassador_clip_category: AmbassadorClipCategory | null;
  thumbnail_url: string;
  order_index: number;
  published: boolean;
};

const emptyVideoForm: VideoFormState = {
  title: "",
  description: "",
  youtube_url: "",
  video_type: "video",
  ambassador_clip_category: null,
  thumbnail_url: "",
  order_index: 0,
  published: true,
};

const AdminChampionProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const {
    champion,
    isLoading,
    videos,
    isVideosLoading,
    updateChampion,
    isUpdatingChampion,
    createVideo,
    isCreatingVideo,
    updateVideo,
    isUpdatingVideo,
    deleteVideo,
    isDeletingVideo,
  } = useAdminChampion(id);

  const [profile, setProfile] = useState({
    full_name: "",
    bio: "",
    photo_url: "",
    country: "",
    city: "",
    custom_country: "",
    custom_city: "",
    is_active: true,
    order_index: 0,
  });

  useEffect(() => {
    if (champion) {
      const picker = mapStoredToPicker(champion.country, champion.city, isRTL);
      setProfile({
        full_name: champion.full_name ?? "",
        bio: champion.bio ?? "",
        photo_url: champion.photo_url ?? "",
        country: picker.country,
        city: picker.city,
        custom_country: picker.custom_country,
        custom_city: picker.custom_city,
        is_active: champion.is_active,
        order_index: champion.order_index,
      });
    }
  }, [champion, isRTL]);

  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoForm, setVideoForm] = useState<VideoFormState>(emptyVideoForm);
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null);
  const [statsVideo, setStatsVideo] = useState<ChampionVideoWithStats | null>(null);

  const handleSaveProfile = async () => {
    if (!profile.full_name.trim()) {
      toast.error(isRTL ? "يرجى إدخال الاسم" : "Please enter a name");
      return;
    }
    try {
      await updateChampion({
        full_name: profile.full_name.trim(),
        nickname: null,
        bio: profile.bio.trim() || null,
        photo_url: profile.photo_url.trim() || null,
        country: resolveCountryName(profile.country, profile.custom_country),
        city: resolveCity(profile.city, profile.custom_city),
        instagram_url: null,
        youtube_url: null,
        tiktok_url: null,
        podcast_url: null,
        website_url: null,
        is_active: profile.is_active,
        order_index: profile.order_index,
      });
      toast.success(isRTL ? "تم الحفظ" : "Saved");
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? "فشل الحفظ" : "Failed to save"));
    }
  };

  const openCreateVideo = () => {
    setVideoForm({ ...emptyVideoForm, order_index: videos.length });
    setVideoDialogOpen(true);
  };

  const openEditVideo = (v: ChampionVideoWithStats) => {
    setVideoForm({
      id: v.id,
      title: v.title,
      description: v.description ?? "",
      youtube_url: v.youtube_url,
      video_type: v.video_type,
      ambassador_clip_category: v.ambassador_clip_category ?? null,
      thumbnail_url: v.thumbnail_url ?? "",
      order_index: v.order_index,
      published: v.published,
    });
    setVideoDialogOpen(true);
  };

  const handleSaveVideo = async () => {
    if (!videoForm.title.trim() || !videoForm.youtube_url.trim()) {
      toast.error(isRTL ? "العنوان والرابط مطلوبان" : "Title and URL are required");
      return;
    }
    if (!extractYoutubeId(videoForm.youtube_url)) {
      toast.error(isRTL ? "رابط YouTube غير صالح" : "Invalid YouTube URL");
      return;
    }
    if (!videoForm.ambassador_clip_category) {
      toast.error(
        isRTL
          ? "اختر نوع مقطع السفير"
          : "Select an Ambassador clip type",
      );
      return;
    }
    try {
      const payload = {
        title: videoForm.title.trim(),
        description: videoForm.description.trim() || null,
        youtube_url: videoForm.youtube_url.trim(),
        video_type: videoForm.video_type,
        ambassador_clip_category: videoForm.ambassador_clip_category,
        thumbnail_url: videoForm.thumbnail_url.trim() || null,
        order_index: videoForm.order_index,
        published: videoForm.published,
      };
      if (videoForm.id) {
        await updateVideo(videoForm.id, payload);
        toast.success(isRTL ? "تم تحديث الفيديو" : "Video updated");
      } else {
        await createVideo(payload);
        toast.success(isRTL ? "تمت إضافة الفيديو" : "Video added");
      }
      setVideoDialogOpen(false);
      setVideoForm(emptyVideoForm);
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? "فشل الحفظ" : "Failed to save"));
    }
  };

  const handleDeleteVideo = async () => {
    if (!deleteVideoId) return;
    try {
      await deleteVideo(deleteVideoId);
      toast.success(isRTL ? "تم الحذف" : "Deleted");
      setDeleteVideoId(null);
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? "فشل الحذف" : "Failed to delete"));
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!champion) {
    return (
      <AdminLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">
            {isRTL ? "البطل غير موجود" : "Champion not found"}
          </p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => navigate("/admin/champions")}
          >
            {isRTL ? "العودة" : "Go back"}
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const initials = (profile.full_name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const totalLikes = videos.reduce((sum, v) => sum + v.likes_count, 0);
  const totalComments = videos.reduce((sum, v) => sum + v.comments_count, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/champions")}
            >
              <Arrow className="w-4 h-4 me-2" />
              {isRTL ? "العودة" : "Back"}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {profile.full_name || (isRTL ? "بطل" : "Champion")}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isRTL ? "إدارة الملف والفيديوهات" : "Manage profile and videos"}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/community-champions" target="_blank" rel="noopener noreferrer">
              <Eye className="w-4 h-4 me-2" />
              {isRTL ? "عرض في الموقع" : "View on Site"}
            </Link>
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Play className="w-4 h-4" />}
            label={isRTL ? "فيديوهات" : "Videos"}
            value={videos.length}
          />
          <StatCard
            icon={<Heart className="w-4 h-4" />}
            label={isRTL ? "إعجابات" : "Likes"}
            value={totalLikes}
          />
          <StatCard
            icon={<MessageCircle className="w-4 h-4" />}
            label={isRTL ? "تعليقات" : "Comments"}
            value={totalComments}
          />
        </div>

        {/* Profile form */}
        <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {isRTL ? "بيانات البطل" : "Champion Info"}
            </h2>
            <div className="flex items-center gap-2">
              <Switch
                checked={profile.is_active}
                onCheckedChange={(v) =>
                  setProfile((p) => ({ ...p, is_active: v }))
                }
              />
              <span className="text-xs text-muted-foreground">
                {profile.is_active
                  ? isRTL
                    ? "فعّال"
                    : "Active"
                  : isRTL
                    ? "مخفي"
                    : "Hidden"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <Avatar className="h-20 w-20 flex-shrink-0">
              {profile.photo_url && <AvatarImage src={profile.photo_url} />}
              <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-3 w-full">
              <LabeledInput
                label={isRTL ? "الاسم الكامل *" : "Full name *"}
                value={profile.full_name}
                onChange={(v) => setProfile((p) => ({ ...p, full_name: v }))}
              />

              <CountryCityPicker
                country={profile.country}
                city={profile.city}
                customCountry={profile.custom_country}
                customCity={profile.custom_city}
                onCountryChange={(v) =>
                  setProfile((p) => ({ ...p, country: v }))
                }
                onCityChange={(v) => setProfile((p) => ({ ...p, city: v }))}
                onCustomCountryChange={(v) =>
                  setProfile((p) => ({ ...p, custom_country: v }))
                }
                onCustomCityChange={(v) =>
                  setProfile((p) => ({ ...p, custom_city: v }))
                }
              />

              <LabeledInput
                label={isRTL ? "رابط الصورة" : "Photo URL"}
                value={profile.photo_url}
                onChange={(v) => setProfile((p) => ({ ...p, photo_url: v }))}
                placeholder="https://..."
              />

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isRTL ? "نبذة" : "Bio"}
                </label>
                <Textarea
                  rows={3}
                  value={profile.bio}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, bio: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isRTL ? "ترتيب العرض" : "Display order"}
                </label>
                <Input
                  type="number"
                  value={profile.order_index}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      order_index: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveProfile} disabled={isUpdatingChampion}>
              {isUpdatingChampion ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : (
                <Save className="w-4 h-4 me-2" />
              )}
              {isRTL ? "حفظ" : "Save"}
            </Button>
          </div>
        </div>

        {/* Videos */}
        <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {isRTL ? "الفيديوهات والبودكاست" : "Videos & Podcasts"}
            </h2>
            <Button size="sm" onClick={openCreateVideo}>
              <Plus className="w-4 h-4 me-2" />
              {isRTL ? "إضافة" : "Add"}
            </Button>
          </div>

          {isVideosLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-5 h-5 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : videos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {isRTL ? "لا توجد فيديوهات بعد." : "No videos yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {videos.map((v) => {
                const vid = extractYoutubeId(v.youtube_url);
                const thumb = v.thumbnail_url || (vid ? youtubeThumbnailUrl(vid) : null);
                return (
                  <div
                    key={v.id}
                    className="flex gap-3 rounded-lg border border-border/40 p-3"
                  >
                    <div className="w-28 sm:w-36 flex-shrink-0 aspect-video bg-muted rounded-md overflow-hidden">
                      {thumb && (
                        <img
                          src={thumb}
                          alt={v.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {v.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              {v.video_type === "podcast" ? (
                                <>
                                  <Radio className="w-3 h-3" />
                                  {isRTL ? "بودكاست" : "Podcast"}
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3" />
                                  {isRTL ? "فيديو" : "Video"}
                                </>
                              )}
                            </Badge>
                            {(v.ambassador_clip_category ?? null) && (
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {ambassadorClipCategoryLabel(
                                  v.ambassador_clip_category ?? null,
                                  isRTL,
                                )}
                              </Badge>
                            )}
                            {!v.published && (
                              <Badge variant="outline" className="text-[10px]">
                                {isRTL ? "غير منشور" : "Draft"}
                              </Badge>
                            )}
                            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              {v.likes_count}
                            </span>
                            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              {v.comments_count}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStatsVideo(v)}
                            title={isRTL ? "التفاصيل" : "Details"}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditVideo(v)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteVideoId(v.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {v.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {v.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Video create/edit dialog */}
      <Dialog
        open={videoDialogOpen}
        onOpenChange={(open) => {
          setVideoDialogOpen(open);
          if (!open) setVideoForm(emptyVideoForm);
        }}
      >
        <DialogContent className="sm:max-w-lg" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {videoForm.id
                ? isRTL
                  ? "تعديل الفيديو"
                  : "Edit Video"
                : isRTL
                  ? "إضافة فيديو / بودكاست"
                  : "Add Video / Podcast"}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "ألصق رابط YouTube (فيديو / Shorts / بث مباشر)."
                : "Paste a YouTube URL (video / Shorts / live)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <LabeledInput
              label={isRTL ? "العنوان *" : "Title *"}
              value={videoForm.title}
              onChange={(v) => setVideoForm({ ...videoForm, title: v })}
            />
            <LabeledInput
              label={isRTL ? "رابط YouTube *" : "YouTube URL *"}
              value={videoForm.youtube_url}
              onChange={(v) => setVideoForm({ ...videoForm, youtube_url: v })}
              placeholder="https://www.youtube.com/watch?v=..."
            />

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {isRTL ? "الوصف" : "Description"}
              </label>
              <Textarea
                rows={3}
                value={videoForm.description}
                onChange={(e) =>
                  setVideoForm({ ...videoForm, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isRTL ? "النوع" : "Type"}
                </label>
                <Select
                  value={videoForm.video_type}
                  onValueChange={(v: "video" | "podcast") =>
                    setVideoForm({ ...videoForm, video_type: v })
                  }
                >
                  <SelectTrigger dir={isRTL ? "rtl" : "ltr"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir={isRTL ? "rtl" : "ltr"}>
                    <SelectItem value="video">
                      {isRTL ? "فيديو" : "Video"}
                    </SelectItem>
                    <SelectItem value="podcast">
                      {isRTL ? "بودكاست" : "Podcast"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isRTL ? "الترتيب" : "Order"}
                </label>
                <Input
                  type="number"
                  value={videoForm.order_index}
                  onChange={(e) =>
                    setVideoForm({
                      ...videoForm,
                      order_index: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {isRTL
                  ? "سفير — نوع المقطع *"
                  : "Ambassador — clip type *"}
              </label>
              <p className="text-[10px] text-muted-foreground mb-1.5 leading-snug">
                {isRTL
                  ? "ثلاثة أنواع رئيسية؛ (٢) لها فروع أ، ب، ج — (٣) لها فرعان أ، ب. النوع (١) بدون تفرع."
                  : "Three main types; (1) has no sub-branches. (2) branches A–C. (3) branches A–B."}
              </p>
              <AmbassadorClipCategorySelect
                value={videoForm.ambassador_clip_category}
                onChange={(cat) =>
                  setVideoForm({ ...videoForm, ambassador_clip_category: cat })
                }
                isRTL={isRTL}
                allowUnset
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
              <span className="text-sm text-foreground">
                {isRTL ? "منشور" : "Published"}
              </span>
              <Switch
                checked={videoForm.published}
                onCheckedChange={(v) => setVideoForm({ ...videoForm, published: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setVideoDialogOpen(false)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleSaveVideo}
              disabled={isCreatingVideo || isUpdatingVideo}
            >
              {(isCreatingVideo || isUpdatingVideo) ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : (
                <Save className="w-4 h-4 me-2" />
              )}
              {isRTL ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete video */}
      <Dialog
        open={!!deleteVideoId}
        onOpenChange={(open) => !open && setDeleteVideoId(null)}
      >
        <DialogContent className="sm:max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {isRTL ? "حذف الفيديو" : "Delete video"}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "سيتم حذف كل الإعجابات والتعليقات المرتبطة."
                : "All related likes and comments will be removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteVideoId(null)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteVideo}
              disabled={isDeletingVideo}
            >
              {isDeletingVideo ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : (
                <Trash2 className="w-4 h-4 me-2" />
              )}
              {isRTL ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video stats detail dialog */}
      <Dialog
        open={!!statsVideo}
        onOpenChange={(open) => !open && setStatsVideo(null)}
      >
        <DialogContent className="sm:max-w-2xl" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {isRTL ? "تفاصيل التفاعل" : "Interaction Details"}
            </DialogTitle>
            <DialogDescription>{statsVideo?.title}</DialogDescription>
          </DialogHeader>
          {statsVideo && <VideoStatsPanel videoId={statsVideo.id} />}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
}> = ({ icon, label, value }) => (
  <div className="rounded-xl border border-border/40 bg-card p-4">
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">{icon}</span>
    </div>
    <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
  </div>
);

const LabeledInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const VideoStatsPanel: React.FC<{ videoId: string }> = ({ videoId }) => {
  const { isRTL } = useLanguage();
  const { data, isLoading } = useAdminVideoInteractions(videoId);
  const dateLocale = isRTL ? ar : enUS;

  if (isLoading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="w-5 h-5 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  const likes = data?.likes ?? [];
  const comments = data?.comments ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Heart className="w-4 h-4" />
          {isRTL ? "الإعجابات" : "Likes"} ({likes.length})
        </h4>
        {likes.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-1.5">
            {likes.map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-xs">
                <Avatar className="h-6 w-6">
                  {l.user_avatar && <AvatarImage src={l.user_avatar} />}
                  <AvatarFallback className="text-[10px]">
                    {(l.user_name || "U").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">
                  {l.user_name || (isRTL ? "مستخدم" : "User")}
                </span>
                <span className="text-muted-foreground ms-auto flex-shrink-0">
                  {formatDistanceToNow(new Date(l.created_at), {
                    addSuffix: true,
                    locale: dateLocale,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4" />
          {isRTL ? "التعليقات" : "Comments"} ({comments.length})
        </h4>
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-border/40 bg-muted/20 p-2"
              >
                <div className="flex items-center gap-2 text-xs mb-1">
                  <Avatar className="h-5 w-5">
                    {c.user_avatar && <AvatarImage src={c.user_avatar} />}
                    <AvatarFallback className="text-[10px]">
                      {(c.user_name || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold truncate">
                    {c.user_name || (isRTL ? "مستخدم" : "User")}
                  </span>
                  <span className="text-muted-foreground ms-auto flex-shrink-0">
                    {formatDistanceToNow(new Date(c.created_at), {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </span>
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap break-words">
                  {c.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminChampionProfile;
