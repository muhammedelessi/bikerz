/**
 * BikeGarage — reusable multi-bike manager.
 * The parent owns persistence; this component manages the in-memory list and
 * calls `onChange` whenever the list changes.
 *
 * UX:
 *  - Inline grid of bike cards + a single "Add" tile.
 *  - Adding a bike opens a Dialog with two tabs: Catalog (search) / Custom.
 *  - Photos are added AFTER the bike exists (separate Dialog from each card).
 *  - Lightbox is a separate Dialog.
 */
import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { BikeEntry } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Bike, Plus, Trash2, Loader2, ChevronLeft, ChevronRight, X, ImagePlus, Search, Camera } from "lucide-react";

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
interface LightboxState {
  photos: string[];
  index: number;
}

export interface BikeGarageProps {
  entries: BikeEntry[];
  onChange: (entries: BikeEntry[]) => void;
  /** Used as the storage path prefix for photo uploads. If omitted, photo upload is disabled. */
  userId?: string | null;
  /** Optional extra subfolder inside the user dir (default: "bikes") */
  storageFolder?: string;
  isUpdating?: boolean;
}

export interface BikeGarageHandle {
  openAddPage: () => void;
}

// ─── Visual: one tone per type (no emoji / gradient layering) ────────────────

const TYPE_TONE: Record<string, string> = {
  Race: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  Touring: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Cruiser: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Adventure: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Scrambler: "bg-stone-500/10 text-stone-600 dark:text-stone-300 border-stone-500/20",
  Naked: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-500/20",
};
const DEFAULT_TONE = "bg-primary/10 text-primary border-primary/20";

const MAX_PHOTOS = 5;

// ─── Component ────────────────────────────────────────────────────────────────

export const BikeGarage = forwardRef<BikeGarageHandle, BikeGarageProps>(
  ({ entries, onChange, userId, storageFolder = "bikes", isUpdating = false }, ref) => {
    const { isRTL } = useLanguage();
    const canUpload = Boolean(userId);

    // bilingual helper
    const t = (ar: string, en: string) => (isRTL ? ar : en);

    // Modals
    const [addOpen, setAddOpen] = useState(false);
    const [photosFor, setPhotosFor] = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<LightboxState | null>(null);

    const openAdd = () => setAddOpen(true);
    useImperativeHandle(ref, () => ({ openAddPage: openAdd }));

    // Catalog
    const { data: catalogTypes = [], isLoading: catalogLoading } = useQuery<CatalogType[]>({
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

    // ── Storage helpers ───────────────────────────────────────────────────────
    const uploadPhotos = async (bikeId: string, files: File[]): Promise<string[]> => {
      if (!userId || files.length === 0) return [];
      const urls: string[] = [];
      for (const file of files) {
        const path = `${userId}/${storageFolder}/${bikeId}/${Date.now()}-${file.name}`;
        const { error } = await (supabase as any).storage.from("bike-photos").upload(path, file);
        if (error) {
          toast.error(t("فشل رفع الصورة", "Upload failed"));
          continue;
        }
        const { data: u } = (supabase as any).storage.from("bike-photos").getPublicUrl(path);
        if (u?.publicUrl) urls.push(u.publicUrl as string);
      }
      return urls;
    };

    // ── List actions ──────────────────────────────────────────────────────────
    const deleteBike = (id: string) => onChange(entries.filter((e) => e.id !== id));

    const addCatalogBike = (item: FlatModel) => {
      const newEntry: BikeEntry = {
        id: crypto.randomUUID(),
        type_id: item.type_id,
        type_name: item.type_name,
        subtype_id: item.subtype_id,
        subtype_name: item.subtype_name,
        brand: item.brand,
        model: item.model_name,
        is_custom_type: false,
        is_custom_brand: false,
        photos: [],
      };
      onChange([...entries, newEntry]);
      setAddOpen(false);
      toast.success(t("تمت إضافة الدراجة", "Bike added"));
    };

    const addCustomBike = (payload: { typeId: string | null; typeName: string; brand: string; model: string }) => {
      const newEntry: BikeEntry = {
        id: crypto.randomUUID(),
        type_id: payload.typeId,
        type_name: payload.typeName,
        subtype_id: null,
        subtype_name: "",
        brand: payload.brand,
        model: payload.model,
        is_custom_type: !payload.typeId,
        is_custom_brand: true,
        photos: [],
      };
      onChange([...entries, newEntry]);
      setAddOpen(false);
      toast.success(t("تمت إضافة الدراجة", "Bike added"));
    };

    // ── Localized name helpers ────────────────────────────────────────────────
    const localizedTypeName = (entry: BikeEntry) => {
      if (entry.type_id) {
        const ct = catalogTypes.find((tp) => tp.id === entry.type_id);
        if (ct) return isRTL ? ct.name_ar : ct.name_en;
      }
      return entry.type_name;
    };

    // ── Photos dialog state ───────────────────────────────────────────────────
    const photosEntry = entries.find((e) => e.id === photosFor) ?? null;

    const handleAddPhotos = async (files: FileList | null) => {
      if (!files || !photosFor || !photosEntry) return;
      if (photosEntry.photos.length + files.length > MAX_PHOTOS) {
        toast.error(t(`الحد الأقصى ${MAX_PHOTOS} صور`, `Maximum ${MAX_PHOTOS} photos`));
        return;
      }
      const urls = await uploadPhotos(photosFor, Array.from(files));
      onChange(entries.map((e) => (e.id === photosFor ? { ...e, photos: [...e.photos, ...urls] } : e)));
    };

    const removePhoto = async (url: string) => {
      if (!photosFor || !photosEntry) return;
      const path = url.split("/bike-photos/")[1];
      if (path) await (supabase as any).storage.from("bike-photos").remove([path]);
      onChange(entries.map((e) => (e.id === photosFor ? { ...e, photos: e.photos.filter((p) => p !== url) } : e)));
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
      <div dir={isRTL ? "rtl" : "ltr"}>
        {/* ══════════════ LIST ══════════════ */}
        {entries.length === 0 ? (
          <EmptyState onAdd={openAdd} t={t} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {entries.map((entry) => {
              const tone = TYPE_TONE[entry.type_name] ?? DEFAULT_TONE;
              return (
                <BikeCard
                  key={entry.id}
                  entry={entry}
                  typeName={localizedTypeName(entry)}
                  tone={tone}
                  canUpload={canUpload}
                  isUpdating={isUpdating}
                  onOpenLightbox={(i) => setLightbox({ photos: entry.photos, index: i })}
                  onManagePhotos={() => setPhotosFor(entry.id)}
                  onDelete={() => deleteBike(entry.id)}
                  t={t}
                />
              );
            })}

            {/* Add tile (shown beside existing cards) */}
            <button
              onClick={openAdd}
              className="rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-colors min-h-[180px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
            >
              <div className="w-11 h-11 rounded-full bg-muted/40 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">{t("إضافة دراجة", "Add a Bike")}</span>
            </button>
          </div>
        )}

        {/* ══════════════ ADD DIALOG ══════════════ */}
        <AddBikeDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          catalogTypes={catalogTypes}
          catalogLoading={catalogLoading}
          isRTL={isRTL}
          t={t}
          onPickCatalog={addCatalogBike}
          onPickCustom={addCustomBike}
        />

        {/* ══════════════ PHOTOS DIALOG ══════════════ */}
        <PhotosDialog
          entry={photosEntry}
          open={!!photosFor}
          onClose={() => setPhotosFor(null)}
          canUpload={canUpload}
          onAdd={handleAddPhotos}
          onRemove={removePhoto}
          onLightbox={(i) => photosEntry && setLightbox({ photos: photosEntry.photos, index: i })}
          t={t}
        />

        {/* ══════════════ LIGHTBOX ══════════════ */}
        <Lightbox state={lightbox} onClose={() => setLightbox(null)} onChange={setLightbox} />
      </div>
    );
  },
);
BikeGarage.displayName = "BikeGarage";

// ═════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═════════════════════════════════════════════════════════════════════════════

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ onAdd, t }: { onAdd: () => void; t: (a: string, e: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 rounded-2xl border-2 border-dashed border-border/60">
      <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center">
        <Bike className="w-7 h-7 text-muted-foreground/60" />
      </div>
      <div className="text-center px-4">
        <p className="text-sm font-semibold text-foreground">{t("لم تضف أي دراجة بعد", "No bikes added yet")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("أضف دراجتك للحصول على تجربة مخصصة", "Add a bike for a personalized experience")}
        </p>
      </div>
      <Button onClick={onAdd} className="gap-2 h-10 px-4">
        <Plus className="w-4 h-4" />
        {t("إضافة دراجة", "Add a Bike")}
      </Button>
    </div>
  );
}

// ─── BikeCard ─────────────────────────────────────────────────────────────────
interface BikeCardProps {
  entry: BikeEntry;
  typeName: string;
  tone: string;
  canUpload: boolean;
  isUpdating: boolean;
  onOpenLightbox: (index: number) => void;
  onManagePhotos: () => void;
  onDelete: () => void;
  t: (a: string, e: string) => string;
}
function BikeCard({
  entry,
  typeName,
  tone,
  canUpload,
  isUpdating,
  onOpenLightbox,
  onManagePhotos,
  onDelete,
  t,
}: BikeCardProps) {
  const hasPhoto = entry.photos.length > 0;
  return (
    <div className="group rounded-2xl border border-border/50 overflow-hidden bg-card flex flex-col hover:shadow-md transition-shadow">
      <button
        type="button"
        onClick={() => (hasPhoto ? onOpenLightbox(0) : canUpload ? onManagePhotos() : undefined)}
        className="relative aspect-[4/3] bg-muted/40 overflow-hidden text-left"
      >
        {hasPhoto ? (
          <>
            <img
              src={entry.photos[0]}
              alt={entry.model}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {entry.photos.length > 1 && (
              <div className="absolute bottom-2 end-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-semibold backdrop-blur-sm">
                +{entry.photos.length - 1}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
            <Bike className="w-12 h-12" />
            {canUpload && <span className="text-[11px] font-medium">{t("اضغط لإضافة صور", "Tap to add photos")}</span>}
          </div>
        )}
      </button>

      <div className="p-3 flex-1 flex flex-col gap-3">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase truncate" dir="ltr">
            {entry.brand || "—"}
          </p>
          <p className="text-base font-bold text-foreground leading-tight truncate" dir="ltr">
            {entry.model || t("دراجة غير معرّفة", "Unknown Bike")}
          </p>
        </div>

        {typeName && (
          <span
            className={cn(
              "inline-flex self-start items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border",
              tone,
            )}
          >
            {typeName}
          </span>
        )}

        <div className="flex gap-2 pt-1 mt-auto">
          {canUpload && (
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-9" onClick={onManagePhotos}>
              <Camera className="w-4 h-4" />
              <span className="text-xs">
                {entry.photos.length > 0
                  ? `${entry.photos.length} ${t("صور", "photos")}`
                  : t("إضافة صور", "Add photos")}
              </span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            onClick={onDelete}
            disabled={isUpdating}
            aria-label={t("حذف", "Delete")}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── AddBikeDialog ────────────────────────────────────────────────────────────
interface AddBikeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogTypes: CatalogType[];
  catalogLoading: boolean;
  isRTL: boolean;
  t: (a: string, e: string) => string;
  onPickCatalog: (item: FlatModel) => void;
  onPickCustom: (payload: { typeId: string | null; typeName: string; brand: string; model: string }) => void;
}
function AddBikeDialog({
  open,
  onOpenChange,
  catalogTypes,
  catalogLoading,
  isRTL,
  t,
  onPickCatalog,
  onPickCustom,
}: AddBikeDialogProps) {
  const [tab, setTab] = useState<"catalog" | "custom">("catalog");
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<string>("all");

  const [customTypeId, setCustomTypeId] = useState<string>("");
  const [customTypeName, setCustomTypeName] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customModel, setCustomModel] = useState("");

  React.useEffect(() => {
    if (open) {
      setTab("catalog");
      setSearch("");
      setActiveType("all");
      setCustomTypeId("");
      setCustomTypeName("");
      setCustomBrand("");
      setCustomModel("");
    }
  }, [open]);

  const flatModels: FlatModel[] = useMemo(
    () =>
      catalogTypes.flatMap((tp) =>
        tp.bike_subtypes.flatMap((s) =>
          s.bike_models.map((m) => ({
            model_id: m.id,
            brand: m.brand,
            model_name: m.model_name,
            subtype_id: s.id,
            subtype_name: s.name_en,
            subtype_name_ar: s.name_ar,
            type_id: tp.id,
            type_name: tp.name_en,
            type_name_ar: tp.name_ar,
          })),
        ),
      ),
    [catalogTypes],
  );

  const results: FlatModel[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flatModels.filter((m) => {
      if (activeType !== "all" && m.type_id !== activeType) return false;
      if (!q) return true;
      return [m.brand, m.model_name, m.subtype_name, m.type_name].some((s) => s.toLowerCase().includes(q));
    });
  }, [flatModels, search, activeType]);

  const customValid =
    customBrand.trim().length > 0 &&
    customModel.trim().length > 0 &&
    customTypeId.length > 0 &&
    (customTypeId !== "custom" || customTypeName.trim().length > 0);

  const handleCustomSave = () => {
    if (!customValid) return;
    const resolved = customTypeId === "custom" ? null : (catalogTypes.find((tp) => tp.id === customTypeId) ?? null);
    onPickCustom({
      typeId: resolved?.id ?? null,
      typeName: resolved ? (isRTL ? resolved.name_ar : resolved.name_en) : customTypeName.trim(),
      brand: customBrand.trim(),
      model: customModel.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 gap-0 sm:rounded-2xl max-h-[90vh] flex flex-col"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base font-bold">{t("إضافة دراجة", "Add a Bike")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("اختر من الكتالوج أو أدخل دراجتك يدوياً", "Pick from the catalog or enter manually")}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "catalog" | "custom")}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-5 pt-3">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="catalog">{t("الكتالوج", "Catalog")}</TabsTrigger>
              <TabsTrigger value="custom">{t("يدوي", "Custom")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="catalog" className="flex-1 flex flex-col min-h-0 mt-3 px-5 pb-5">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ابحث: BMW R18...", "Search: BMW R18...")}
                className="ps-10 h-10 rounded-xl"
              />
              {search && (
                <button
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearch("")}
                  aria-label={t("مسح", "Clear")}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto py-3 -mx-1 px-1 scrollbar-thin">
              {[
                { id: "all", label: t("الكل", "All") },
                ...catalogTypes.map((tp) => ({ id: tp.id, label: isRTL ? tp.name_ar : tp.name_en })),
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveType(f.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors",
                    activeType === f.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 text-muted-foreground border-border/40 hover:border-primary/40",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1">
              {catalogLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-1.5">
                  {results.map((item) => (
                    <button
                      key={item.model_id}
                      onClick={() => onPickCatalog(item)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-colors text-start group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-primary/10">
                        <Bike className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate" dir="ltr">
                          {item.brand} {item.model_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {isRTL ? item.type_name_ar : item.type_name}
                          {" · "}
                          {isRTL ? item.subtype_name_ar : item.subtype_name}
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {search
                    ? t(`لا نتائج لـ "${search}"`, `No results for "${search}"`)
                    : t("لا توجد دراجات", "No bikes found")}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="flex-1 flex flex-col min-h-0 mt-3 px-5 pb-5">
            <div className="space-y-3 overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  {t("نوع الدراجة", "Bike Type")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ...catalogTypes.map((tp) => ({ id: tp.id, label: isRTL ? tp.name_ar : tp.name_en })),
                    { id: "custom", label: t("أخرى", "Other") },
                  ].map((tp) => (
                    <button
                      key={tp.id}
                      onClick={() => setCustomTypeId(tp.id)}
                      className={cn(
                        "px-2 py-2 rounded-xl border-2 text-xs font-semibold transition-all text-center",
                        customTypeId === tp.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/30 bg-muted/20 text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {tp.label}
                    </button>
                  ))}
                </div>
                {customTypeId === "custom" && (
                  <Input
                    value={customTypeName}
                    onChange={(e) => setCustomTypeName(e.target.value)}
                    placeholder={t("اسم النوع...", "Type name...")}
                    className="h-10 rounded-xl mt-2"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">{t("الماركة", "Brand")}</label>
                <Input
                  value={customBrand}
                  onChange={(e) => setCustomBrand(e.target.value)}
                  placeholder={t("مثال: BMW", "e.g. BMW")}
                  className="h-10 rounded-xl"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">{t("الموديل", "Model")}</label>
                <Input
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder={t("مثال: R18", "e.g. R18")}
                  className="h-10 rounded-xl"
                  dir="ltr"
                />
              </div>
            </div>

            <Button className="w-full gap-2 h-10 mt-4" onClick={handleCustomSave} disabled={!customValid}>
              <Plus className="w-4 h-4" />
              {t("إضافة الدراجة", "Add Bike")}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── PhotosDialog ─────────────────────────────────────────────────────────────
interface PhotosDialogProps {
  entry: BikeEntry | null;
  open: boolean;
  onClose: () => void;
  canUpload: boolean;
  onAdd: (files: FileList | null) => Promise<void>;
  onRemove: (url: string) => Promise<void>;
  onLightbox: (index: number) => void;
  t: (a: string, e: string) => string;
}
function PhotosDialog({ entry, open, onClose, canUpload, onAdd, onRemove, onLightbox, t }: PhotosDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!entry) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    await onAdd(files);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 sm:rounded-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base font-bold truncate" dir="ltr">
            {entry.brand} {entry.model}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {entry.photos.length}/{MAX_PHOTOS} {t("صور", "photos")}
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            {entry.photos.map((url, i) => (
              <div
                key={url}
                className="relative aspect-square rounded-xl overflow-hidden border border-border/40 group"
              >
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => onLightbox(i)}
                />
                {canUpload && (
                  <button
                    onClick={() => onRemove(url)}
                    className="absolute top-1.5 end-1.5 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition-opacity"
                    aria-label={t("حذف", "Remove")}
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
            ))}
            {canUpload && entry.photos.length < MAX_PHOTOS && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                ) : (
                  <ImagePlus className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="text-[11px] text-muted-foreground">{t("إضافة صورة", "Add photo")}</span>
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div className="px-5 pb-5">
          <Button variant="outline" className="w-full h-10" onClick={onClose}>
            {t("تم", "Done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({
  state,
  onClose,
  onChange,
}: {
  state: LightboxState | null;
  onClose: () => void;
  onChange: (s: LightboxState | null) => void;
}) {
  if (!state) return null;
  const { photos, index } = state;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 bg-black/95 border-0 overflow-hidden gap-0">
        <div className="relative">
          <img src={photos[index]} className="w-full max-h-[75vh] object-contain" alt="" />
          <button
            className="absolute top-3 end-3 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 z-10"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                className="absolute start-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 disabled:opacity-30"
                disabled={index === 0}
                onClick={() => onChange({ ...state, index: index - 1 })}
                aria-label="Previous"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button
                className="absolute end-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 disabled:opacity-30"
                disabled={index === photos.length - 1}
                onClick={() => onChange({ ...state, index: index + 1 })}
                aria-label="Next"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </>
          )}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
            {index + 1} / {photos.length}
          </div>
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto bg-black/80">
            {photos.map((photo, i) => (
              <button
                key={i}
                onClick={() => onChange({ ...state, index: i })}
                className={cn(
                  "w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all",
                  i === index ? "border-primary scale-105" : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                <img src={photo} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
