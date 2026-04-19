import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountryCityPicker } from "@/components/ui/fields/CountryCityPicker";
import { COUNTRIES } from "@/data/countryCityData";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  Save,
  Trash2,
  Trophy,
  Video as VideoIcon,
  Radio,
  Play,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminChampions } from "@/hooks/admin/useAdminChampions";
import { extractYoutubeId } from "@/lib/youtube";

const OTHER_VALUE = "__other__";

interface VideoDraft {
  key: string;
  title: string;
  youtube_url: string;
  video_type: "video" | "podcast";
  description: string;
}

const makeDraft = (): VideoDraft => ({
  key: Math.random().toString(36).slice(2),
  title: "",
  youtube_url: "",
  video_type: "video",
  description: "",
});

const AdminChampionNew: React.FC = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const { createChampion, isCreating } = useAdminChampions();

  const [profile, setProfile] = useState({
    full_name: "",
    bio: "",
    photo_url: "",
    country: "",
    city: "",
    custom_country: "",
    custom_city: "",
  });

  const [videos, setVideos] = useState<VideoDraft[]>([makeDraft()]);
  const [saving, setSaving] = useState(false);

  const addVideoRow = () => setVideos((prev) => [...prev, makeDraft()]);

  const removeVideoRow = (key: string) =>
    setVideos((prev) => (prev.length === 1 ? prev : prev.filter((v) => v.key !== key)));

  const updateVideo = (key: string, patch: Partial<VideoDraft>) =>
    setVideos((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  const resolveCountryName = (code: string, custom: string): string | null => {
    if (!code) return null;
    if (code === OTHER_VALUE) return custom.trim() || null;
    const entry = COUNTRIES.find((c) => c.code === code);
    return entry ? entry.en : null;
  };

  const resolveCity = (city: string, custom: string): string | null => {
    if (!city) return null;
    if (city === OTHER_VALUE) return custom.trim() || null;
    return city;
  };

  const handleSave = async () => {
    if (!profile.full_name.trim()) {
      toast.error(isRTL ? "يرجى إدخال اسم البطل" : "Please enter the champion's name");
      return;
    }

    const cleanedVideos = videos
      .map((v) => ({
        ...v,
        title: v.title.trim(),
        youtube_url: v.youtube_url.trim(),
        description: v.description.trim(),
      }))
      .filter((v) => v.title || v.youtube_url);

    for (const v of cleanedVideos) {
      if (!v.title || !v.youtube_url) {
        toast.error(
          isRTL
            ? "كل فيديو يحتاج عنواناً ورابطاً"
            : "Each video needs a title and a URL",
        );
        return;
      }
      if (!extractYoutubeId(v.youtube_url)) {
        toast.error(
          isRTL
            ? `رابط YouTube غير صالح: ${v.title}`
            : `Invalid YouTube URL: ${v.title}`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      const created = await createChampion({
        full_name: profile.full_name.trim(),
        bio: profile.bio.trim() || null,
        photo_url: profile.photo_url.trim() || null,
        country: resolveCountryName(profile.country, profile.custom_country),
        city: resolveCity(profile.city, profile.custom_city),
        is_active: true,
        order_index: 0,
      });

      if (cleanedVideos.length > 0 && created?.id) {
        const payload = cleanedVideos.map((v, idx) => ({
          champion_id: created.id,
          title: v.title,
          description: v.description || null,
          youtube_url: v.youtube_url,
          video_type: v.video_type,
          order_index: idx,
          published: true,
        }));
        const { error } = await (supabase as any)
          .from("champion_videos")
          .insert(payload);
        if (error) throw error;
      }

      toast.success(
        isRTL ? "تم إنشاء البطل بنجاح" : "Champion created successfully",
      );
      navigate(`/admin/champions/${created.id}`);
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? "فشل الحفظ" : "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isCreating;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/champions">
                <Arrow className="w-4 h-4 me-2" />
                {isRTL ? "العودة" : "Back"}
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Trophy className="w-6 h-6 text-primary" />
                {isRTL ? "إضافة بطل جديد" : "Add New Champion"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "املأ بيانات البطل وأضف فيديوهاته."
                  : "Fill in the champion info and add their videos."}
              </p>
            </div>
          </div>
        </div>

        {/* Champion info */}
        <section className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">
            {isRTL ? "بيانات البطل" : "Champion Info"}
          </h2>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {isRTL ? "الاسم الكامل *" : "Full name *"}
            </label>
            <Input
              value={profile.full_name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, full_name: e.target.value }))
              }
              placeholder={
                isRTL ? "مثال: أحمد السعيد" : "e.g. Ahmed Al-Saeed"
              }
            />
          </div>

          <CountryCityPicker
            country={profile.country}
            city={profile.city}
            customCountry={profile.custom_country}
            customCity={profile.custom_city}
            onCountryChange={(v) =>
              setProfile((p) => ({ ...p, country: v }))
            }
            onCityChange={(v) =>
              setProfile((p) => ({ ...p, city: v }))
            }
            onCustomCountryChange={(v) =>
              setProfile((p) => ({ ...p, custom_country: v }))
            }
            onCustomCityChange={(v) =>
              setProfile((p) => ({ ...p, custom_city: v }))
            }
          />

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {isRTL ? "رابط الصورة" : "Photo URL"}
            </label>
            <Input
              value={profile.photo_url}
              onChange={(e) =>
                setProfile((p) => ({ ...p, photo_url: e.target.value }))
              }
              placeholder="https://..."
            />
          </div>

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
              placeholder={
                isRTL ? "نبذة عن البطل..." : "Short bio..."
              }
            />
          </div>
        </section>

        {/* Videos */}
        <section className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <VideoIcon className="w-5 h-5 text-primary" />
                {isRTL ? "الفيديوهات والبودكاست" : "Videos & Podcasts"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRTL
                  ? "يمكنك إضافة أكثر من فيديو. كل فيديو له عنوان ورابط YouTube."
                  : "You can add multiple videos. Each needs a title and a YouTube URL."}
              </p>
            </div>
            <Button type="button" size="sm" onClick={addVideoRow}>
              <Plus className="w-4 h-4 me-2" />
              {isRTL ? "إضافة فيديو" : "Add video"}
            </Button>
          </div>

          <div className="space-y-4">
            {videos.map((v, idx) => (
              <div
                key={v.key}
                className="rounded-lg border border-border/40 bg-background/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {isRTL ? `الفيديو #${idx + 1}` : `Video #${idx + 1}`}
                  </span>
                  {videos.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => removeVideoRow(v.key)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {isRTL ? "عنوان الفيديو *" : "Video title *"}
                  </label>
                  <Input
                    value={v.title}
                    onChange={(e) =>
                      updateVideo(v.key, { title: e.target.value })
                    }
                    placeholder={
                      isRTL
                        ? "مثال: رحلة إلى نيوم"
                        : "e.g. Ride to NEOM"
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {isRTL ? "رابط YouTube *" : "YouTube URL *"}
                    </label>
                    <Input
                      value={v.youtube_url}
                      onChange={(e) =>
                        updateVideo(v.key, { youtube_url: e.target.value })
                      }
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {isRTL ? "النوع" : "Type"}
                    </label>
                    <Select
                      value={v.video_type}
                      onValueChange={(val: "video" | "podcast") =>
                        updateVideo(v.key, { video_type: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">
                          <span className="inline-flex items-center gap-1.5">
                            <Play className="w-3.5 h-3.5" />
                            {isRTL ? "فيديو" : "Video"}
                          </span>
                        </SelectItem>
                        <SelectItem value="podcast">
                          <span className="inline-flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5" />
                            {isRTL ? "بودكاست" : "Podcast"}
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {isRTL ? "وصف (اختياري)" : "Description (optional)"}
                  </label>
                  <Textarea
                    rows={2}
                    value={v.description}
                    onChange={(e) =>
                      updateVideo(v.key, { description: e.target.value })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link to="/admin/champions">
              {isRTL ? "إلغاء" : "Cancel"}
            </Link>
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin me-2" />
            ) : (
              <Save className="w-4 h-4 me-2" />
            )}
            {isRTL ? "حفظ البطل" : "Save Champion"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminChampionNew;
