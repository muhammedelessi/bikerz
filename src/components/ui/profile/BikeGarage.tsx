import React, { useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { BikeEntry } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Bike, Plus, Trash2, Loader2, ChevronRight, ChevronLeft, X, ImagePlus, Camera, Search } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogModel {
  id: string;
  brand: string;
  model_name: string;
  sort_order: number;
  subtype_id: string;
}
interface CatalogSubtype {
  id: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
  type_id: string;
  bike_models: CatalogModel[];
}
interface CatalogType {
  id: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
  bike_subtypes: CatalogSubtype[];
}
interface LightboxState {
  photos: string[];
  index: number;
}
interface FlatModel {
  model_id: string;
  brand: string;
  model_name: string;
  subtype_id: string;
  subtype_name: string;
  subtype_name_ar: string;
  type_id: string;
  type_name: string;
  type_name_ar: string;
}

export interface BikeGarageProps {
  entries: BikeEntry[];
  onChange: (entries: BikeEntry[]) => void;
  userId?: string | null;
  storageFolder?: string;
  isUpdating?: boolean;
}

export interface BikeGarageHandle {
  openAddPage: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_GRADIENTS: Record<string, string> = {
  Race: "from-red-900/60 via-red-950/40 to-black/60",
  Touring: "from-blue-900/60 via-blue-950/40 to-black/60",
  Cruiser: "from-amber-900/60 via-amber-950/40 to-black/60",
  Adventure: "from-green-900/60 via-green-950/40 to-black/60",
  Scrambler: "from-stone-800/60 via-stone-900/40 to-black/60",
  Naked: "from-zinc-800/60 via-zinc-900/40 to-black/60",
};
const TYPE_BG: Record<string, string> = {
  Race: "from-red-950/80 to-background",
  Touring: "from-blue-950/80 to-background",
  Cruiser: "from-amber-950/80 to-background",
  Adventure: "from-green-950/80 to-background",
  Scrambler: "from-stone-950/80 to-background",
  Naked: "from-zinc-950/80 to-background",
};
const TYPE_CHIP: Record<string, string> = {
  Race: "bg-red-500/15 text-red-400 border-red-500/20",
  Touring: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Cruiser: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Adventure: "bg-green-500/15 text-green-400 border-green-500/20",
  Scrambler: "bg-stone-500/15 text-stone-400 border-stone-500/20",
  Naked: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20",
};
const TYPE_EMOJI: Record<string, string> = {
  Race: "🏁",
  Touring: "🗺️",
  Cruiser: "🛣️",
  Adventure: "🏔️",
  Scrambler: "🪨",
  Naked: "⚡",
};
const TYPE_ICON: Record<string, React.ElementType> = {
  Race: Zap,
  Touring: Wind,
  Cruiser: Gauge,
  Adventure: Mountain,
  Scrambler: Flame,
  Naked: Bike,
};

// ─── Component ────────────────────────────────────────────────────────────────

export const BikeGarage = forwardRef<BikeGarageHandle, BikeGarageProps>(
  ({ entries, onChange, userId, storageFolder = "bikes", isUpdating = false }, ref) => {
    const { isRTL } = useLanguage();
    const BackIcon = isRTL ? ChevronRight : ChevronLeft;
    const canUpload = Boolean(userId);

    // ── Catalog ───────────────────────────────────────────────────────────────
    const { data: catalogTypes = [] } = useQuery<CatalogType[]>({
      queryKey: ["bike-types"],
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from("bike_types")
          .select("*, bike_subtypes(*, bike_models(*))")
          .order("sort_order");
        if (error) throw error;
        return (data ?? []) as CatalogType[];
      },
      staleTime: 10 * 60 * 1000,
    });

    // ── View state ────────────────────────────────────────────────────────────
    const [view, setView] = useState<"list" | "add" | "photos">("list");
    const [photoBikeId, setPhotoBikeId] = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<LightboxState | null>(null);

    // ── Per-card quick upload ─────────────────────────────────────────────────
    const cardFileRef = useRef<HTMLInputElement>(null);
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);

    const triggerCardUpload = (bikeId: string) => {
      setUploadingFor(bikeId);
      cardFileRef.current?.click();
    };

    const uploadPhotos = async (bikeId: string, files: FileList): Promise<string[]> => {
      if (!userId) return [];
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const path = `${userId}/${storageFolder}/${bikeId}/${Date.now()}-${file.name}`;
        const { error } = await (supabase as any).storage.from("bike-photos").upload(path, file);
        if (error) {
          toast.error(isRTL ? "فشل رفع الصورة" : "Upload failed");
          continue;
        }
        const { data: u } = (supabase as any).storage.from("bike-photos").getPublicUrl(path);
        if (u?.publicUrl) urls.push(u.publicUrl as string);
      }
      return urls;
    };

    const handleCardPhotoUpload = async (files: FileList | null) => {
      if (!files || !uploadingFor) return;
      const entry = entries.find((e) => e.id === uploadingFor);
      if (!entry || entry.photos.length + files.length > 5) {
        toast.error(isRTL ? "الحد الأقصى 5 صور" : "Maximum 5 photos");
        return;
      }
      const newUrls = await uploadPhotos(uploadingFor, files);
      onChange(entries.map((e) => (e.id === uploadingFor ? { ...e, photos: [...e.photos, ...newUrls] } : e)));
      setUploadingFor(null);
      if (cardFileRef.current) cardFileRef.current.value = "";
    };

    // ── Add-bike state ────────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [activeType, setActiveType] = useState<string>("all");
    const [showManual, setShowManual] = useState(false);
    const [manualType, setManualType] = useState("");
    const [manualTypeName, setManualTypeName] = useState("");
    const [manualBrand, setManualBrand] = useState("");
    const [manualModel, setManualModel] = useState("");
    const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
    const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
    const addPhotoInputRef = useRef<HTMLInputElement>(null);
    const [savingNewBike, setSavingNewBike] = useState(false);

    const onPickPendingPhotos = (files: FileList | null) => {
      if (!files) return;
      const arr = Array.from(files);
      if (pendingPhotos.length + arr.length > 5) {
        toast.error(isRTL ? "الحد الأقصى 5 صور" : "Maximum 5 photos");
        return;
      }
      setPendingPhotos((prev) => [...prev, ...arr]);
      setPendingPreviews((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
      if (addPhotoInputRef.current) addPhotoInputRef.current.value = "";
    };

    const removePendingPhoto = (index: number) => {
      setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
      setPendingPreviews((prev) => {
        URL.revokeObjectURL(prev[index]);
        return prev.filter((_, i) => i !== index);
      });
    };

    const clearPendingPhotos = () => {
      pendingPreviews.forEach((u) => URL.revokeObjectURL(u));
      setPendingPhotos([]);
      setPendingPreviews([]);
    };

    const uploadFilesForBike = async (bikeId: string, files: File[]): Promise<string[]> => {
      if (!userId || files.length === 0) return [];
      const urls: string[] = [];
      for (const file of files) {
        const path = `${userId}/${storageFolder}/${bikeId}/${Date.now()}-${file.name}`;
        const { error } = await (supabase as any).storage.from("bike-photos").upload(path, file);
        if (error) {
          toast.error(isRTL ? "فشل رفع الصورة" : "Upload failed");
          continue;
        }
        const { data: u } = (supabase as any).storage.from("bike-photos").getPublicUrl(path);
        if (u?.publicUrl) urls.push(u.publicUrl as string);
      }
      return urls;
    };

    const openAddPage = () => {
      setSearch("");
      setActiveType("all");
      setShowManual(false);
      setManualType("");
      setManualTypeName("");
      setManualBrand("");
      setManualModel("");
      clearPendingPhotos();
      setView("add");
    };

    useImperativeHandle(ref, () => ({ openAddPage }));

    // ── Photos page ───────────────────────────────────────────────────────────
    const photosFileRef = useRef<HTMLInputElement>(null);
    const [photosUploading, setPhotosUploading] = useState(false);
    const photoEntry = entries.find((e) => e.id === photoBikeId) ?? null;

    // ── Flat models ───────────────────────────────────────────────────────────
    const flatModels: FlatModel[] = useMemo(
      () =>
        catalogTypes.flatMap((t) =>
          t.bike_subtypes.flatMap((s) =>
            s.bike_models.map((m) => ({
              model_id: m.id,
              brand: m.brand,
              model_name: m.model_name,
              subtype_id: s.id,
              subtype_name: s.name_en,
              subtype_name_ar: s.name_ar,
              type_id: t.id,
              type_name: t.name_en,
              type_name_ar: t.name_ar,
            })),
          ),
        ),
      [catalogTypes],
    );

    const searchResults = useMemo(
      () =>
        flatModels.filter((m) => {
          const matchType = activeType === "all" || m.type_id === activeType;
          const q = search.trim().toLowerCase();
          const matchSearch =
            !q || [m.brand, m.model_name, m.subtype_name, m.type_name].some((s) => s.toLowerCase().includes(q));
          return matchType && matchSearch;
        }),
      [flatModels, search, activeType],
    );

    // ── Handlers ──────────────────────────────────────────────────────────────
    const onQuickAdd = async (item: FlatModel) => {
      const id = crypto.randomUUID();
      setSavingNewBike(true);
      const photoUrls = await uploadFilesForBike(id, pendingPhotos);
      onChange([
        ...entries,
        {
          id,
          type_id: item.type_id,
          type_name: item.type_name,
          subtype_id: item.subtype_id,
          subtype_name: item.subtype_name,
          brand: item.brand,
          model: item.model_name,
          is_custom_type: false,
          is_custom_brand: false,
          photos: photoUrls,
        },
      ]);
      setSavingNewBike(false);
      clearPendingPhotos();
      setView("list");
      toast.success(isRTL ? "تمت إضافة الدراجة" : "Bike added");
    };

    const onSaveManual = async () => {
      if (!manualBrand.trim() || !manualModel.trim()) {
        toast.error(isRTL ? "الرجاء إدخال الماركة والموديل" : "Please enter brand and model");
        return;
      }
      const resolved = manualType === "custom" ? null : (catalogTypes.find((t) => t.id === manualType) ?? null);
      const id = crypto.randomUUID();
      setSavingNewBike(true);
      const photoUrls = await uploadFilesForBike(id, pendingPhotos);
      onChange([
        ...entries,
        {
          id,
          type_id: resolved?.id ?? null,
          type_name: resolved?.name_en ?? manualTypeName.trim(),
          subtype_id: null,
          subtype_name: "",
          brand: manualBrand.trim(),
          model: manualModel.trim(),
          is_custom_type: !resolved,
          is_custom_brand: true,
          photos: photoUrls,
        },
      ]);
      setSavingNewBike(false);
      clearPendingPhotos();
      setView("list");
      toast.success(isRTL ? "تمت إضافة الدراجة" : "Bike added");
    };

    const deleteBike = (id: string) => onChange(entries.filter((e) => e.id !== id));

    const handlePhotosUpload = async (files: FileList | null) => {
      if (!files || !photoBikeId || !photoEntry) return;
      if (photoEntry.photos.length + files.length > 5) {
        toast.error(isRTL ? "الحد الأقصى 5 صور" : "Maximum 5 photos");
        return;
      }
      setPhotosUploading(true);
      const newUrls = await uploadPhotos(photoBikeId, files);
      onChange(entries.map((e) => (e.id === photoBikeId ? { ...e, photos: [...e.photos, ...newUrls] } : e)));
      setPhotosUploading(false);
    };

    const removePhoto = async (url: string) => {
      if (!photoBikeId || !photoEntry) return;
      const path = url.split("/bike-photos/")[1];
      if (path) await (supabase as any).storage.from("bike-photos").remove([path]);
      onChange(entries.map((e) => (e.id === photoBikeId ? { ...e, photos: e.photos.filter((p) => p !== url) } : e)));
    };

    // ── Localized names ───────────────────────────────────────────────────────
    const localName = (entry: BikeEntry) => {
      if (entry.type_id) {
        const ct = catalogTypes.find((t) => t.id === entry.type_id);
        if (ct) return isRTL ? ct.name_ar : ct.name_en;
      }
      return entry.type_name;
    };
    const localSubName = (entry: BikeEntry) => {
      if (entry.subtype_id) {
        for (const ct of catalogTypes) {
          const s = ct.bike_subtypes.find((s) => s.id === entry.subtype_id);
          if (s) return isRTL ? s.name_ar : s.name_en;
        }
      }
      return entry.subtype_name;
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
      <div dir={isRTL ? "rtl" : "ltr"}>
        {/* ══════════════ LIST VIEW ══════════════ */}
        {view === "list" && (
          <div>
            {entries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                {entries.map((entry) => {
                  const typeName = localName(entry);
                  const subName = localSubName(entry);
                  const chipCls = TYPE_CHIP[entry.type_name] ?? "bg-primary/10 text-primary border-primary/20";
                  const bg = TYPE_BG[entry.type_name] ?? "from-primary/20 to-background";
                  const emoji = TYPE_EMOJI[entry.type_name] ?? "🏍️";
                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-border/50 overflow-hidden bg-card shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group"
                    >
                      {/* ── Photo area ── */}
                      <div className="relative aspect-[4/3] overflow-hidden bg-muted shrink-0">
                        {entry.photos.length > 0 ? (
                          <>
                            <img
                              src={entry.photos[0]}
                              alt={entry.model}
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-500"
                              onClick={() => setLightbox({ photos: entry.photos, index: 0 })}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            {entry.photos.length > 1 && (
                              <div className="absolute bottom-2 end-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                                1 / {entry.photos.length}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className={cn("w-full h-full bg-gradient-to-b flex items-center justify-center", bg)}>
                            <span className="text-6xl opacity-20 select-none group-hover:scale-110 transition-transform duration-500">
                              {emoji}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ── Info ── */}
                      <div className="p-3 flex-1 min-w-0 space-y-1">
                        {typeName && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", chipCls)}>
                              {typeName}
                            </span>
                            {subName && (
                              <>
                                <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 rtl:rotate-180" />
                                <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full truncate">
                                  {subName}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        {entry.brand && (
                          <p
                            className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase"
                            dir="ltr"
                          >
                            {entry.brand}
                          </p>
                        )}
                        <p className="text-sm font-bold text-foreground leading-snug truncate" dir="ltr">
                          {entry.model || (isRTL ? "دراجة غير معرّفة" : "Unknown Bike")}
                        </p>
                      </div>

                      {/* ── Action bar ── */}
                      <div className="px-3 pb-3 pt-2 border-t border-border/20 flex items-center gap-1.5">
                        {/* Thumbnails */}
                        <div className="flex items-center gap-1 flex-1 overflow-hidden">
                          {entry.photos.slice(0, 3).map((photo, i) => (
                            <button
                              key={i}
                              onClick={() => setLightbox({ photos: entry.photos, index: i })}
                              className="w-7 h-7 rounded-lg overflow-hidden border-2 border-border/30 hover:border-primary/60 hover:scale-110 transition-all shrink-0"
                            >
                              <img src={photo} className="w-full h-full object-cover" alt="" />
                            </button>
                          ))}
                          {entry.photos.length > 3 && (
                            <button
                              onClick={() => setLightbox({ photos: entry.photos, index: 3 })}
                              className="w-7 h-7 rounded-lg bg-muted/60 border-2 border-border/30 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 hover:border-primary/50"
                            >
                              +{entry.photos.length - 3}
                            </button>
                          )}
                          {canUpload && entry.photos.length < 5 && (
                            <button
                              onClick={() => triggerCardUpload(entry.id)}
                              disabled={uploadingFor === entry.id}
                              className="w-7 h-7 rounded-lg border-2 border-dashed border-border/30 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all shrink-0 disabled:opacity-40"
                            >
                              {uploadingFor === entry.id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                              ) : (
                                <Plus className="w-3 h-3 text-muted-foreground" />
                              )}
                            </button>
                          )}
                        </div>
                        {/* Buttons */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          {canUpload && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary"
                              onClick={() => {
                                setPhotoBikeId(entry.id);
                                setView("photos");
                              }}
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => deleteBike(entry.id)}
                            disabled={isUpdating}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add Bike tile */}
                <button
                  onClick={openAddPage}
                  className="rounded-2xl border-2 border-dashed border-border/40 min-h-[200px] flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 group"
                >
                  <div className="w-12 h-12 rounded-full bg-muted/50 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    {isRTL ? "إضافة دراجة" : "Add Bike"}
                  </span>
                </button>
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-14 gap-4 rounded-2xl border-2 border-dashed border-border/50">
                <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                  <Bike className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {isRTL ? "كراجك فارغ!" : "Your garage is empty!"}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {isRTL
                      ? "أضف دراجتك الأولى للحصول على تجربة مخصصة"
                      : "Add your first bike for a personalized experience"}
                  </p>
                </div>
                <Button onClick={openAddPage} className="gap-2 rounded-xl">
                  <Plus className="w-4 h-4" />
                  {isRTL ? "إضافة دراجة" : "Add Your Bike"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ ADD BIKE PAGE ══════════════ */}
        {view === "add" && (
          <div className="rounded-2xl border border-border/40 overflow-hidden bg-card flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/20 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl shrink-0"
                onClick={() => setView("list")}
              >
                <BackIcon className="w-4 h-4" />
              </Button>
              <h3 className="text-sm font-semibold flex-1">{isRTL ? "إضافة دراجة" : "Add a Bike"}</h3>
            </div>

            {/* Tab bar */}
            <div className="grid grid-cols-2 border-b border-border/30 shrink-0">
              <button
                onClick={() => setShowManual(false)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 text-xs font-semibold border-b-2 transition-all",
                  !showManual
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20",
                )}
              >
                <Search className="w-3.5 h-3.5" />
                {isRTL ? "بحث في الكتالوج" : "Search Catalog"}
              </button>
              <button
                onClick={() => setShowManual(true)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 text-xs font-semibold border-b-2 transition-all",
                  showManual
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20",
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                {isRTL ? "إضافة يدوية" : "Add Manually"}
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto max-h-[460px] p-4 space-y-4">
              {/* ── CATALOG TAB ── */}
              {!showManual && (
                <>
                  {/* Type filter grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {[
                      { id: "all", label_ar: "الكل", label_en: "All", Icon: Bike },
                      ...catalogTypes.map((t) => ({
                        id: t.id,
                        label_ar: t.name_ar,
                        label_en: t.name_en,
                        Icon: TYPE_ICON[t.name_en] ?? Bike,
                      })),
                    ].map(({ id, label_ar, label_en, Icon }) => (
                      <button
                        key={id}
                        onClick={() => setActiveType(id)}
                        className={cn(
                          "flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 transition-all",
                          activeType === id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/30 bg-muted/20 text-muted-foreground hover:border-primary/40 hover:bg-muted/40",
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[9px] font-semibold truncate w-full text-center leading-tight">
                          {isRTL ? label_ar : label_en}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={isRTL ? "ابحث: Honda, BMW, R1250..." : "Search: Honda, BMW, R1250..."}
                      className="ps-10 pe-10 h-10 rounded-xl bg-muted/30 border-border/40 focus:bg-background"
                      autoFocus
                    />
                    {search && (
                      <button className="absolute end-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </button>
                    )}
                  </div>

                  {/* Results */}
                  {searchResults.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground ps-1 pb-0.5">
                        {searchResults.length} {isRTL ? "نتيجة" : "results"}
                      </p>
                      {searchResults.map((item) => {
                        const ItemIcon = TYPE_ICON[item.type_name] ?? Bike;
                        return (
                          <div
                            key={item.model_id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/20 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                              <ItemIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate" dir="ltr">
                                {item.brand} {item.model_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {isRTL ? item.type_name_ar : item.type_name}
                                <span className="mx-1 opacity-40">·</span>
                                {isRTL ? item.subtype_name_ar : item.subtype_name}
                              </p>
                            </div>
                            <button
                              onClick={() => onQuickAdd(item)}
                              disabled={savingNewBike}
                              className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-40"
                            >
                              {savingNewBike ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
                        <Search className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        {search
                          ? isRTL
                            ? `لا نتائج لـ "${search}"`
                            : `No results for "${search}"`
                          : isRTL
                            ? "اختر نوعاً أو ابحث بالاسم"
                            : "Select a type or search by name"}
                      </p>
                      {search && (
                        <button
                          className="text-xs text-primary underline underline-offset-2"
                          onClick={() => setShowManual(true)}
                        >
                          {isRTL ? "إضافة يدوياً بدلاً من ذلك" : "Add manually instead"}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── MANUAL TAB ── */}
              {showManual && (
                <div className="space-y-4">
                  {/* Type selection */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">{isRTL ? "نوع الدراجة *" : "Bike Type *"}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {[
                        ...catalogTypes.map((t) => ({
                          id: t.id,
                          nameAr: t.name_ar,
                          nameEn: t.name_en,
                          Icon: TYPE_ICON[t.name_en] ?? Bike,
                        })),
                        { id: "custom", nameAr: "أخرى", nameEn: "Other", Icon: Plus },
                      ].map(({ id, nameAr, nameEn, Icon }) => (
                        <button
                          key={id}
                          onClick={() => setManualType(id)}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                            manualType === id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/30 bg-muted/20 text-muted-foreground hover:border-primary/40 hover:bg-muted/40",
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-[11px] font-semibold">{isRTL ? nameAr : nameEn}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {manualType === "custom" && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-foreground">{isRTL ? "اسم النوع *" : "Type Name *"}</p>
                      <Input
                        value={manualTypeName}
                        onChange={(e) => setManualTypeName(e.target.value)}
                        placeholder={isRTL ? "مثال: سكوتر..." : "e.g. Scooter..."}
                        className="h-10 rounded-xl"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-foreground">{isRTL ? "الماركة *" : "Brand *"}</p>
                      <Input
                        value={manualBrand}
                        onChange={(e) => setManualBrand(e.target.value)}
                        placeholder="Honda, BMW..."
                        className="h-10 rounded-xl"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-foreground">{isRTL ? "الموديل *" : "Model *"}</p>
                      <Input
                        value={manualModel}
                        onChange={(e) => setManualModel(e.target.value)}
                        placeholder="CBR 600, R1250..."
                        className="h-10 rounded-xl"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full h-10 gap-2 rounded-xl"
                    onClick={onSaveManual}
                    disabled={!manualBrand.trim() || !manualModel.trim() || !manualType || savingNewBike}
                  >
                    {savingNewBike ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {isRTL ? "إضافة الدراجة" : "Add Bike"}
                  </Button>
                </div>
              )}
            </div>

            {/* Photos — sticky at bottom, shared between both tabs */}
            {canUpload && (
              <div className="border-t border-border/30 px-4 py-3 bg-muted/10 shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                    {isRTL ? "صور الدراجة (اختياري)" : "Bike Photos (optional)"}
                  </p>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {pendingPhotos.length} / 5
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {pendingPreviews.map((url, i) => (
                    <div
                      key={i}
                      className="relative w-12 h-12 rounded-lg overflow-hidden border border-border/40 group"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePendingPhoto(i)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                  {pendingPhotos.length < 5 && (
                    <button
                      onClick={() => addPhotoInputRef.current?.click()}
                      className="w-12 h-12 rounded-lg border-2 border-dashed border-border/40 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <ImagePlus className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <input
                  ref={addPhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickPendingPhotos(e.target.files)}
                />
              </div>
            )}
          </div>
        )}

        {/* ══════════════ PHOTOS PAGE ══════════════ */}
        {view === "photos" && photoEntry && (
          <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/20">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl shrink-0"
                onClick={() => setView("list")}
              >
                <BackIcon className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold truncate" dir="ltr">
                  {photoEntry.brand} {photoEntry.model}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {photoEntry.photos.length} / 5 {isRTL ? "صور" : "photos"}
                </p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photoEntry.photos.map((url, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border/40 group"
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setLightbox({ photos: photoEntry.photos, index: i })}
                    />
                    <button
                      onClick={() => removePhoto(url)}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
                {photoEntry.photos.length < 5 && (
                  <button
                    onClick={() => photosFileRef.current?.click()}
                    disabled={photosUploading}
                    className="aspect-square rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    {photosUploading ? (
                      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                    ) : (
                      <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="text-[10px] text-muted-foreground">{isRTL ? "إضافة" : "Add"}</span>
                  </button>
                )}
              </div>
              <input
                ref={photosFileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handlePhotosUpload(e.target.files)}
              />
              <Button variant="outline" className="w-full rounded-xl" onClick={() => setView("list")}>
                {isRTL ? "تم" : "Done"}
              </Button>
            </div>
          </div>
        )}

        {/* Hidden card upload input */}
        <input
          ref={cardFileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleCardPhotoUpload(e.target.files)}
        />

        {/* ══════════════ LIGHTBOX ══════════════ */}
        {lightbox && (
          <Dialog open onOpenChange={() => setLightbox(null)}>
            <DialogContent
              className="max-w-3xl p-0 bg-black/95 border-0 overflow-hidden gap-0"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <div className="relative">
                <img src={lightbox.photos[lightbox.index]} className="w-full max-h-[75vh] object-contain" alt="" />
                <button
                  className="absolute top-3 end-3 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 z-10 transition-colors"
                  onClick={() => setLightbox(null)}
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                {lightbox.photos.length > 1 && (
                  <>
                    <button
                      className="absolute start-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 disabled:opacity-20 transition-all"
                      disabled={lightbox.index === 0}
                      onClick={() => setLightbox((p) => p && { ...p, index: p.index - 1 })}
                    >
                      <ChevronLeft className="w-5 h-5 text-white rtl:rotate-180" />
                    </button>
                    <button
                      className="absolute end-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 disabled:opacity-20 transition-all"
                      disabled={lightbox.index === lightbox.photos.length - 1}
                      onClick={() => setLightbox((p) => p && { ...p, index: p.index + 1 })}
                    >
                      <ChevronRight className="w-5 h-5 text-white rtl:rotate-180" />
                    </button>
                  </>
                )}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                  {lightbox.index + 1} / {lightbox.photos.length}
                </div>
              </div>
              {lightbox.photos.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto bg-black/80">
                  {lightbox.photos.map((photo, i) => (
                    <button
                      key={i}
                      onClick={() => setLightbox((p) => p && { ...p, index: i })}
                      className={cn(
                        "w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all",
                        i === lightbox.index
                          ? "border-primary scale-110"
                          : "border-transparent opacity-50 hover:opacity-100",
                      )}
                    >
                      <img src={photo} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  },
);
BikeGarage.displayName = "BikeGarage";
