import React, { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { BikeEntry } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bike,
  Plus,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  X,
  ImagePlus,
  Camera,
  Search,
  Zap,
  Wind,
  Gauge,
  Mountain,
  Flame,
} from "lucide-react";

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
  /** View-only: same cards as profile, no add / delete / uploads. */
  readOnly?: boolean;
}
export interface BikeGarageHandle {
  openAddPage: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_ACCENT: Record<string, string> = {
  Race: "from-red-600 to-red-900",
  Touring: "from-blue-600 to-blue-900",
  Cruiser: "from-amber-600 to-amber-900",
  Adventure: "from-green-600 to-green-900",
  Scrambler: "from-stone-500 to-stone-800",
  Naked: "from-zinc-500 to-zinc-800",
};
const TYPE_CHIP: Record<string, string> = {
  Race: "bg-red-500/20 text-red-400 border-red-500/30",
  Touring: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Cruiser: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Adventure: "bg-green-500/20 text-green-400 border-green-500/30",
  Scrambler: "bg-stone-500/20 text-stone-400 border-stone-500/30",
  Naked: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
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
  ({ entries, onChange, userId, storageFolder = "bikes", isUpdating = false, readOnly = false }, ref) => {
    const { isRTL } = useLanguage();
    const BackIcon = isRTL ? ChevronRight : ChevronLeft;
    const canUpload = Boolean(userId) && !readOnly;

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
    const [addTab, setAddTab] = useState<"search" | "manual">("search");

    useEffect(() => {
      if (readOnly && (view === "add" || view === "photos")) setView("list");
    }, [readOnly, view]);

    // ── Per-card quick upload ─────────────────────────────────────────────────
    const cardFileRef = useRef<HTMLInputElement>(null);
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);

    const uploadPhotos = async (bikeId: string, files: FileList | File[]): Promise<string[]> => {
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
    const [manualType, setManualType] = useState("");
    const [manualTypeName, setManualTypeName] = useState("");
    const [manualBrand, setManualBrand] = useState("");
    const [manualModel, setManualModel] = useState("");
    const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
    const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
    const addPhotoInputRef = useRef<HTMLInputElement>(null);
    const [savingNewBike, setSavingNewBike] = useState(false);
    const [photoError, setPhotoError] = useState(false);

    const onPickPendingPhotos = (files: FileList | null) => {
      if (!files) return;
      const arr = Array.from(files);
      if (pendingPhotos.length + arr.length > 5) {
        toast.error(isRTL ? "الحد الأقصى 5 صور" : "Maximum 5 photos");
        return;
      }
      setPhotoError(false);
      setPendingPhotos((prev) => [...prev, ...arr]);
      setPendingPreviews((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
      if (addPhotoInputRef.current) addPhotoInputRef.current.value = "";
    };

    const removePendingPhoto = (i: number) => {
      setPendingPhotos((prev) => prev.filter((_, j) => j !== i));
      setPendingPreviews((prev) => {
        URL.revokeObjectURL(prev[i]);
        return prev.filter((_, j) => j !== i);
      });
    };

    const clearPendingPhotos = () => {
      pendingPreviews.forEach(URL.revokeObjectURL);
      setPendingPhotos([]);
      setPendingPreviews([]);
    };

    const openAddPage = () => {
      if (readOnly) return;
      setSearch("");
      setActiveType("all");
      setAddTab("search");
      setManualType("");
      setManualTypeName("");
      setManualBrand("");
      setManualModel("");
      setPhotoError(false);
      clearPendingPhotos();
      setView("add");
    };
    useImperativeHandle(ref, () => ({ openAddPage: readOnly ? () => {} : openAddPage }));

    // ── Photos page ───────────────────────────────────────────────────────────
    const photosFileRef = useRef<HTMLInputElement>(null);
    const [photosUploading, setPhotosUploading] = useState(false);
    const photoEntry = entries.find((e) => e.id === photoBikeId) ?? null;

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
          return (
            matchType &&
            (!q || [m.brand, m.model_name, m.subtype_name, m.type_name].some((s) => s.toLowerCase().includes(q)))
          );
        }),
      [flatModels, search, activeType],
    );

    // ── Add handlers ──────────────────────────────────────────────────────────
    const requirePhoto = () => {
      if (pendingPhotos.length === 0) {
        setPhotoError(true);
        toast.error(isRTL ? "صورة الدراجة مطلوبة" : "Bike photo is required");
        return false;
      }
      return true;
    };

    const onQuickAdd = async (item: FlatModel) => {
      if (!requirePhoto()) return;
      const id = crypto.randomUUID();
      setSavingNewBike(true);
      const photoUrls = await uploadPhotos(id, pendingPhotos);
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
      if (!requirePhoto()) return;
      if (!manualBrand.trim() || !manualModel.trim()) {
        toast.error(isRTL ? "الرجاء إدخال الماركة والموديل" : "Please enter brand and model");
        return;
      }
      const resolved = manualType === "custom" ? null : (catalogTypes.find((t) => t.id === manualType) ?? null);
      const id = crypto.randomUUID();
      setSavingNewBike(true);
      const photoUrls = await uploadPhotos(id, pendingPhotos);
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

    const deleteBike = (id: string) => {
      if (readOnly) return;
      onChange(entries.filter((e) => e.id !== id));
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
              <div
                className={cn(
                  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr",
                  readOnly && "lg:grid-cols-3",
                )}
              >
                {entries.map((entry) => {
                  const typeName = localName(entry);
                  const subName = localSubName(entry);
                  const chipCls = TYPE_CHIP[entry.type_name] ?? "bg-primary/10 text-primary border-primary/20";
                  const accentCls = TYPE_ACCENT[entry.type_name] ?? "from-primary/60 to-primary/90";
                  const TypeIcon = TYPE_ICON[entry.type_name] ?? Bike;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl overflow-hidden border border-border/30 bg-card shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
                    >
                      {/* ── Full-bleed photo ── */}
                      <div
                        className="relative aspect-[4/3] overflow-hidden cursor-pointer"
                        onClick={() => entry.photos.length > 0 && setLightbox({ photos: entry.photos, index: 0 })}
                      >
                        {entry.photos.length > 0 ? (
                          <img
                            src={entry.photos[0]}
                            alt={entry.model}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div
                            className={cn(
                              "w-full h-full bg-gradient-to-br flex items-center justify-center",
                              accentCls,
                            )}
                          >
                            <TypeIcon className="w-20 h-20 text-white/10" />
                          </div>
                        )}

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                        {/* Type chip — top start */}
                        {typeName && (
                          <div className="absolute top-2.5 start-2.5">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm",
                                chipCls,
                              )}
                            >
                              {typeName}
                            </span>
                          </div>
                        )}

                        {/* Photo count — top end */}
                        {entry.photos.length > 1 && (
                          <div className="absolute top-2.5 end-2.5 flex items-center gap-1 bg-black/50 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                            <Camera className="w-2.5 h-2.5" />
                            {entry.photos.length}
                          </div>
                        )}

                        {/* Info overlay — bottom */}
                        <div className="absolute bottom-0 start-0 end-0 p-3">
                          {entry.brand && (
                            <p
                              className="text-[10px] text-white/50 font-medium tracking-widest uppercase mb-0.5"
                              dir="ltr"
                            >
                              {entry.brand}
                            </p>
                          )}
                          <p className="text-base font-black text-white leading-tight truncate" dir="ltr">
                            {entry.model || (isRTL ? "دراجة غير معرّفة" : "Unknown Bike")}
                          </p>
                          {subName && <p className="text-[11px] text-white/50 mt-0.5 truncate">{subName}</p>}
                        </div>
                      </div>

                      {/* ── Action bar ── */}
                      <div className="px-3 py-2.5 flex items-center gap-2 bg-card">
                        {/* Thumbnails row */}
                        <div className="flex items-center gap-1 flex-1 overflow-hidden">
                          {entry.photos.slice(0, 4).map((photo, i) => (
                            <button
                              key={i}
                              onClick={() => setLightbox({ photos: entry.photos, index: i })}
                              className="w-8 h-8 rounded-lg overflow-hidden border-2 border-border/20 hover:border-primary/60 hover:scale-110 transition-all shrink-0"
                            >
                              <img src={photo} className="w-full h-full object-cover" alt="" />
                            </button>
                          ))}
                          {entry.photos.length > 4 && (
                            <button
                              onClick={() => setLightbox({ photos: entry.photos, index: 4 })}
                              className="w-8 h-8 rounded-lg bg-muted/60 border-2 border-border/20 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0"
                            >
                              +{entry.photos.length - 4}
                            </button>
                          )}
                          {canUpload && entry.photos.length < 5 && (
                            <button
                              onClick={() => {
                                setUploadingFor(entry.id);
                                cardFileRef.current?.click();
                              }}
                              disabled={uploadingFor === entry.id}
                              className="w-8 h-8 rounded-lg border-2 border-dashed border-border/30 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all shrink-0 disabled:opacity-40"
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
                        {!readOnly ? (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {canUpload && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
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
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => deleteBike(entry.id)}
                              disabled={isUpdating}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {/* Add Bike tile */}
                {!readOnly ? (
                  <button
                    onClick={openAddPage}
                    className="rounded-2xl border-2 border-dashed border-border/40 min-h-[220px] flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                      <Plus className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                      {isRTL ? "إضافة دراجة" : "Add Bike"}
                    </span>
                  </button>
                ) : null}
              </div>
            ) : readOnly ? (
              <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-border/40 bg-muted/10">
                <Bike className="w-10 h-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد دراجات في الطلب" : "No bikes in this application"}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-5 rounded-2xl border-2 border-dashed border-border/40">
                <div className="w-20 h-20 rounded-3xl bg-muted/40 flex items-center justify-center">
                  <Bike className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-lg font-bold text-foreground">{isRTL ? "جراجك فارغ" : "Your garage is empty"}</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {isRTL
                      ? "أضف دراجتك الأولى وأرفق صورها للحصول على تجربة مخصصة"
                      : "Add your first bike with photos for a personalized experience"}
                  </p>
                </div>
                <Button onClick={openAddPage} size="lg" className="gap-2 rounded-xl px-6">
                  <Plus className="w-4 h-4" />
                  {isRTL ? "إضافة دراجتك" : "Add Your Bike"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ ADD BIKE PAGE ══════════════ */}
        {!readOnly && view === "add" && (
          <div className="rounded-2xl border border-border/40 overflow-hidden bg-card flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-muted/20 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl shrink-0"
                onClick={() => setView("list")}
              >
                <BackIcon className="w-4 h-4" />
              </Button>
              <div>
                <h3 className="text-sm font-bold">{isRTL ? "إضافة دراجة" : "Add a Bike"}</h3>
                <p className="text-[11px] text-muted-foreground">{isRTL ? "الصورة إجبارية" : "Photo is required"}</p>
              </div>
            </div>

            {/* ── Photo Upload (mandatory) ── */}
            <div
              className={cn(
                "px-4 pt-4 pb-3 border-b shrink-0",
                photoError ? "border-destructive/40 bg-destructive/5" : "border-border/30 bg-muted/5",
              )}
            >
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  {isRTL ? "صور الدراجة" : "Bike Photos"}
                  <span className="text-destructive">*</span>
                </p>
                <span
                  className={cn(
                    "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                    pendingPhotos.length > 0
                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20",
                  )}
                >
                  {pendingPhotos.length > 0 ? `${pendingPhotos.length} / 5` : isRTL ? "مطلوبة" : "Required"}
                </span>
              </div>

              {pendingPhotos.length === 0 ? (
                <button
                  onClick={() => {
                    setPhotoError(false);
                    addPhotoInputRef.current?.click();
                  }}
                  className={cn(
                    "w-full rounded-2xl border-2 border-dashed py-6 flex flex-col items-center gap-2.5 transition-all",
                    photoError
                      ? "border-destructive/50 bg-destructive/5 hover:bg-destructive/10"
                      : "border-border/50 hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                      photoError ? "bg-destructive/15" : "bg-muted/60",
                    )}
                  >
                    <ImagePlus className={cn("w-6 h-6", photoError ? "text-destructive" : "text-muted-foreground")} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">
                      {isRTL ? "اضغط لرفع صورة الدراجة" : "Tap to upload bike photo"}
                    </p>
                    <p className={cn("text-xs mt-0.5", photoError ? "text-destructive" : "text-muted-foreground")}>
                      {isRTL ? "مطلوبة — حتى 5 صور" : "Required — up to 5 photos"}
                    </p>
                  </div>
                </button>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {pendingPreviews.map((url, i) => (
                    <div
                      key={i}
                      className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-border/30 group"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePendingPhoto(i)}
                        className="absolute inset-0 bg-black/55 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                      {i === 0 && (
                        <div className="absolute bottom-0.5 start-0.5 end-0.5 bg-black/60 text-[8px] text-white text-center font-bold rounded-md py-0.5">
                          {isRTL ? "رئيسية" : "Cover"}
                        </div>
                      )}
                    </div>
                  ))}
                  {pendingPhotos.length < 5 && (
                    <button
                      onClick={() => addPhotoInputRef.current?.click()}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-border/40 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}
              <input
                ref={addPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPickPendingPhotos(e.target.files)}
              />
            </div>

            {/* ── Tab bar ── */}
            <div className="grid grid-cols-2 border-b border-border/30 shrink-0">
              {(["search", "manual"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAddTab(tab)}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 text-xs font-semibold border-b-2 transition-all",
                    addTab === tab
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20",
                  )}
                >
                  {tab === "search" ? <Search className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {tab === "search"
                    ? isRTL
                      ? "بحث في الكتالوج"
                      : "Search Catalog"
                    : isRTL
                      ? "إضافة يدوية"
                      : "Add Manually"}
                </button>
              ))}
            </div>

            {/* ── Tab content ── */}
            <div className="overflow-y-auto max-h-[380px] p-4 space-y-4">
              {/* CATALOG TAB */}
              {addTab === "search" && (
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
                            : "border-border/30 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:bg-muted/40",
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
                            <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                              <ItemIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-foreground truncate" dir="ltr">
                                {item.brand} {item.model_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {isRTL ? item.type_name_ar : item.type_name}
                                <span className="mx-1 opacity-30">·</span>
                                {isRTL ? item.subtype_name_ar : item.subtype_name}
                              </p>
                            </div>
                            <button
                              onClick={() => onQuickAdd(item)}
                              disabled={savingNewBike}
                              className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1.5 hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-40 shrink-0"
                            >
                              {savingNewBike ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  {isRTL ? "إضافة" : "Add"}
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-2.5">
                      <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
                        <Search className="w-5 h-5 text-muted-foreground/40" />
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
                          onClick={() => setAddTab("manual")}
                        >
                          {isRTL ? "إضافة يدوياً بدلاً من ذلك" : "Add manually instead"}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* MANUAL TAB */}
              {addTab === "manual" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-foreground">{isRTL ? "نوع الدراجة *" : "Bike Type *"}</p>
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
                              : "border-border/30 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:bg-muted/40",
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
                      <p className="text-xs font-bold text-foreground">{isRTL ? "اسم النوع *" : "Type Name *"}</p>
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
                      <p className="text-xs font-bold text-foreground">{isRTL ? "الماركة *" : "Brand *"}</p>
                      <Input
                        value={manualBrand}
                        onChange={(e) => setManualBrand(e.target.value)}
                        placeholder="Honda, BMW..."
                        className="h-10 rounded-xl"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-foreground">{isRTL ? "الموديل *" : "Model *"}</p>
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
          </div>
        )}

        {/* ══════════════ PHOTOS PAGE ══════════════ */}
        {!readOnly && view === "photos" && photoEntry && (
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
                    className="relative aspect-square rounded-xl overflow-hidden border border-border/30 group"
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setLightbox({ photos: photoEntry.photos, index: i })}
                    />
                    {i === 0 && (
                      <div className="absolute top-1.5 start-1.5 bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                        {isRTL ? "رئيسية" : "Cover"}
                      </div>
                    )}
                    <button
                      onClick={() => removePhoto(url)}
                      className="absolute inset-0 bg-black/55 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
                {photoEntry.photos.length < 5 && (
                  <button
                    onClick={() => photosFileRef.current?.click()}
                    disabled={photosUploading}
                    className="aspect-square rounded-xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    {photosUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
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
