import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminSurveyQuestions } from "@/hooks/survey/useSurveyQuestions";
import { useUpsertSurveyQuestion, uploadSurveyImage, type SurveyQuestionUpsert } from "@/hooks/survey/useSurveyAdminMutations";
import { useAdminAllSurveys } from "@/hooks/survey/useSurveys";
import { useBikeTypesCatalog, useBikeSubtypesCatalog, useBikeModelsCatalog } from "@/hooks/survey/useCatalogEntities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  ListChecks,
  Loader2,
  ImageIcon,
  Link2,
  ListOrdered,
  Plus,
  Save,
  Settings2,
  ToggleLeft,
  Type,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { QuestionType, SurveyQuestion, SurveyType } from "@/types/survey";

const MAX_MC_OPTIONS = 4;
const NONE = "__none__";

function defaultCatalogRefForSurvey(type: SurveyType | undefined): SurveyQuestion["catalog_ref_type"] {
  switch (type) {
    case "brands":
      return "brand";
    case "bike_types":
      return "bike_type";
    case "bike_subtypes":
      return "bike_subtype";
    case "bike_models":
      return "bike_model";
    default:
      return null;
  }
}

function catalogRefOptionsForSurvey(type: SurveyType | undefined): (NonNullable<SurveyQuestion["catalog_ref_type"]> | "none")[] {
  switch (type) {
    case "brands":
      return ["none", "brand"];
    case "bike_types":
      return ["none", "bike_type"];
    case "bike_subtypes":
      return ["none", "bike_subtype"];
    case "bike_models":
      return ["none", "bike_model"];
    case "custom":
      return ["none", "brand", "bike_type", "bike_subtype", "bike_model"];
    default:
      return ["none"];
  }
}

const emptyOption = () => ({
  id: undefined as string | undefined,
  label_ar: "",
  label_en: "",
  image_url: null as string | null,
  is_correct: false,
  sort_order: 0,
});

const sectionClass = "rounded-2xl border border-border/60 bg-card p-5 space-y-4";
const sectionTitleClass =
  "text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 flex-wrap";

const AdminQuestionEdit: React.FC = () => {
  const { surveyId, questionId } = useParams<{ surveyId: string; questionId?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const selectDir = isRTL ? "rtl" : "ltr";
  const isNew = !questionId || questionId === "new";
  const { data: surveys } = useAdminAllSurveys();
  const survey = useMemo(() => surveys?.find((s) => s.id === surveyId), [surveys, surveyId]);
  const { data: questions = [], isLoading } = useAdminSurveyQuestions(surveyId);
  const existing = useMemo(() => (!isNew ? questions.find((q) => q.id === questionId) : undefined), [questions, questionId, isNew]);
  const upsert = useUpsertSurveyQuestion();

  const [catalogRefType, setCatalogRefType] = useState<SurveyQuestion["catalog_ref_type"]>(null);
  const [catalogRefId, setCatalogRefId] = useState<string | null>(null);

  const catOpts = catalogRefOptionsForSurvey(survey?.type);
  const needsBikeTypeList = catalogRefType === "bike_type";
  const needsSubtypeList = catalogRefType === "bike_subtype";
  const needsModelList = catalogRefType === "bike_model";
  const { data: bikeTypes = [] } = useBikeTypesCatalog(needsBikeTypeList);
  const { data: bikeSubtypes = [] } = useBikeSubtypesCatalog(needsSubtypeList);
  const { data: bikeModels = [] } = useBikeModelsCatalog(needsModelList);

  const [questionType, setQuestionType] = useState<QuestionType>("yes_no");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [options, setOptions] = useState([emptyOption(), emptyOption()]);
  const [correctIndex, setCorrectIndex] = useState("0");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setQuestionType(existing.question_type);
    setCatalogRefType(existing.catalog_ref_type ?? null);
    setCatalogRefId(existing.catalog_ref_id ?? null);
    setTitleAr(existing.title_ar);
    setTitleEn(existing.title_en);
    setImageUrl(existing.image_url);
    setSortOrder(existing.sort_order);
    setIsActive(existing.is_active !== false);
    const rawOpts = (existing.options || []).length
      ? existing.options!.map((o, i) => ({ ...o, sort_order: o.sort_order ?? i }))
      : [emptyOption(), emptyOption()];
    const opts = rawOpts.slice(0, MAX_MC_OPTIONS);
    setOptions(
      opts.map((o, i) => ({
        id: o.id,
        label_ar: o.label_ar,
        label_en: o.label_en,
        image_url: o.image_url,
        is_correct: o.is_correct,
        sort_order: o.sort_order ?? i,
      })),
    );
    const ci = opts.findIndex((o) => o.is_correct);
    setCorrectIndex(String(ci >= 0 ? ci : 0));
  }, [existing]);

  const newQuestionDefaultsKey = useRef<string | null>(null);
  useEffect(() => {
    if (existing || !survey || !isNew || !surveyId) {
      if (existing) newQuestionDefaultsKey.current = null;
      return;
    }
    const key = `${surveyId}:new`;
    if (newQuestionDefaultsKey.current === key) return;
    newQuestionDefaultsKey.current = key;
    setCatalogRefType(defaultCatalogRefForSurvey(survey.type));
    setCatalogRefId(null);
  }, [existing, survey, isNew, surveyId]);

  useEffect(() => {
    if (existing) return;
    const max = questions.reduce((m, q) => Math.max(m, q.sort_order), 0);
    setSortOrder(max + 1);
  }, [existing, questions]);

  const handleQImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadSurveyImage(file);
      setImageUrl(url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  const handleOptImage = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadSurveyImage(file);
      setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, image_url: url } : o)));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  const addOption = () => {
    if (options.length >= MAX_MC_OPTIONS) return;
    setOptions((o) => [...o, emptyOption()]);
  };

  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions((o) => o.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!surveyId) return;
    if (!titleAr.trim() || !titleEn.trim()) {
      toast.error(t("validation.required"));
      return;
    }
    let payloadOptions = options.map((o, i) => ({
      ...o,
      sort_order: i,
      is_correct: false,
    }));
    if (questionType === "multiple_choice") {
      if (payloadOptions.length < 2) {
        toast.error(t("survey.min_options_warning"));
        return;
      }
      const idx = Math.min(payloadOptions.length - 1, Math.max(0, Number.parseInt(correctIndex, 10) || 0));
      payloadOptions = payloadOptions.map((o, i) => ({ ...o, is_correct: i === idx }));
      const correctCount = payloadOptions.filter((o) => o.is_correct).length;
      if (correctCount !== 1) {
        toast.error(t("survey.one_correct_warning"));
        return;
      }
      for (const o of payloadOptions) {
        if (!o.label_ar.trim() || !o.label_en.trim()) {
          toast.error(t("validation.required"));
          return;
        }
      }
    }

    const needsCatalogId =
      catalogRefType === "bike_type" || catalogRefType === "bike_subtype" || catalogRefType === "bike_model";
    if (needsCatalogId && !catalogRefId) {
      toast.error(t("survey.catalog_entity_required"));
      return;
    }

    const payload: SurveyQuestionUpsert = {
      id: isNew ? undefined : questionId,
      survey_id: surveyId,
      question_type: questionType,
      title_ar: titleAr.trim(),
      title_en: titleEn.trim(),
      image_url: imageUrl,
      catalog_ref_id: catalogRefType && catalogRefType !== "brand" ? catalogRefId : null,
      catalog_ref_type: catalogRefType,
      sort_order: sortOrder,
      is_active: isActive,
      options: questionType === "multiple_choice" ? payloadOptions : [],
    };

    try {
      await upsert.mutateAsync(payload);
      toast.success(t("common.success"));
      navigate(`/admin/surveys/${surveyId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };

  if (!surveyId) return null;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="gap-1 -ms-2 text-muted-foreground hover:text-foreground">
            <Link to={`/admin/surveys/${surveyId}`}>
              <ArrowLeft className={cn("w-4 h-4", isRTL && "rotate-180")} />
              {t("survey.survey_detail")}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? t("survey.add_question") : t("common.edit")}
          </h1>
        </div>

        {isLoading && !isNew ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-9 h-9 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. Question type */}
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>
                <ToggleLeft className="w-4 h-4 shrink-0" aria-hidden />
                {t("survey.section_question_type")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["yes_no", "multiple_choice"] as QuestionType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setQuestionType(type)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-start sm:text-center",
                      questionType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 bg-muted/10 text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    {type === "yes_no" ? (
                      <ToggleLeft className="w-6 h-6 shrink-0" />
                    ) : (
                      <ListChecks className="w-6 h-6 shrink-0" />
                    )}
                    <span className="text-sm font-semibold">
                      {type === "yes_no" ? t("survey.question_type_yesno") : t("survey.question_type_mc")}
                    </span>
                    <span className="text-xs opacity-70 leading-snug">
                      {type === "yes_no" ? t("survey.yesno_hint") : t("survey.mc_hint")}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Question text */}
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>
                <Type className="w-4 h-4 shrink-0" aria-hidden />
                {t("survey.section_question_text")}
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {t("survey.badge_ar")}
                    </span>
                    {t("survey.title_ar")}
                  </Label>
                  <Input
                    value={titleAr}
                    onChange={(e) => setTitleAr(e.target.value)}
                    dir="rtl"
                    className="text-right h-11"
                    placeholder={t("survey.placeholder_title_ar")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {t("survey.badge_en")}
                    </span>
                    {t("survey.title_en")}
                  </Label>
                  <Input
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    dir="ltr"
                    className="text-left h-11"
                    placeholder={t("survey.placeholder_title_en")}
                  />
                </div>
              </div>
            </div>

            {/* 3. Question image */}
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>
                <ImageIcon className="w-4 h-4 shrink-0" aria-hidden />
                {t("survey.section_question_image")}
              </h3>
              <div className="space-y-3">
                {!imageUrl ? (
                  <label
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 h-36 rounded-xl border-2 border-dashed border-border/50",
                      "bg-muted/10 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group",
                      uploading && "pointer-events-none opacity-60",
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="text-center px-2">
                      <p className="text-sm font-medium">{t("survey.upload_image")}</p>
                      <p className="text-xs text-muted-foreground">{t("survey.image_formats")}</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleQImage} disabled={uploading} />
                  </label>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-border/60 bg-muted/10">
                    <img src={imageUrl} alt="" className="w-full max-h-56 object-contain p-3" />
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="absolute top-2 end-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-destructive transition-colors"
                      aria-label={t("survey.remove_image")}
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                )}
                {uploading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    {t("survey.uploading_image")}
                  </div>
                ) : null}
              </div>
            </div>

            {/* 4. Catalog link */}
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>
                <Link2 className="w-4 h-4 shrink-0" aria-hidden />
                {t("survey.section_catalog_link")}
              </h3>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{t("survey.catalog_link_hint")}</p>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t("survey.catalog_ref_type")}</Label>
                  <Select
                    value={catalogRefType ?? NONE}
                    onValueChange={(v) => {
                      if (v === NONE) {
                        setCatalogRefType(null);
                        setCatalogRefId(null);
                        return;
                      }
                      setCatalogRefType(v as NonNullable<SurveyQuestion["catalog_ref_type"]>);
                      setCatalogRefId(null);
                    }}
                    dir={selectDir}
                  >
                    <SelectTrigger className="h-11" dir={selectDir}>
                      <SelectValue placeholder={t("survey.catalog_ref_none")} />
                    </SelectTrigger>
                    <SelectContent dir={selectDir}>
                      {catOpts.map((o) => (
                        <SelectItem key={o} value={o === "none" ? NONE : o}>
                          {o === "none"
                            ? t("survey.catalog_ref_none")
                            : o === "brand"
                              ? t("survey.catalog_ref_brand")
                              : o === "bike_type"
                                ? t("survey.catalog_ref_bike_type")
                                : o === "bike_subtype"
                                  ? t("survey.catalog_ref_bike_subtype")
                                  : t("survey.catalog_ref_bike_model")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {catalogRefType === "brand" ? (
                  <p className="text-xs text-muted-foreground">{t("survey.catalog_brand_hint")}</p>
                ) : null}

                {needsBikeTypeList || needsSubtypeList || needsModelList ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("survey.catalog_pick_entity")}</Label>
                    <Select value={catalogRefId ?? NONE} onValueChange={(v) => setCatalogRefId(v === NONE ? null : v)} dir={selectDir}>
                      <SelectTrigger className="h-11" dir={selectDir}>
                        <SelectValue placeholder={t("survey.catalog_pick_entity_placeholder")} />
                      </SelectTrigger>
                      <SelectContent dir={selectDir}>
                        <SelectItem value={NONE}>{t("survey.catalog_pick_entity_placeholder")}</SelectItem>
                        {needsBikeTypeList &&
                          bikeTypes.map((bt) => (
                            <SelectItem key={bt.id} value={bt.id} dir={selectDir}>
                              {isRTL ? bt.name_ar : bt.name_en}
                            </SelectItem>
                          ))}
                        {needsSubtypeList &&
                          bikeSubtypes.map((bs) => (
                            <SelectItem key={bs.id} value={bs.id} dir={selectDir}>
                              {isRTL ? bs.name_ar : bs.name_en}
                            </SelectItem>
                          ))}
                        {needsModelList &&
                          bikeModels.map((bm) => (
                            <SelectItem key={bm.id} value={bm.id} dir="ltr">
                              {bm.brand} {bm.model_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </div>

            {/* 5. Multiple choice options */}
            {questionType === "multiple_choice" ? (
              <div className={sectionClass} dir={isRTL ? "rtl" : "ltr"}>
                <h3 className={sectionTitleClass}>
                  <ListOrdered className="w-4 h-4 shrink-0" aria-hidden />
                  {t("survey.section_options")}
                </h3>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {t("survey.options_count", { count: options.length, max: MAX_MC_OPTIONS })}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addOption}
                      disabled={options.length >= MAX_MC_OPTIONS}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      {t("survey.add_option")}
                    </Button>
                  </div>

                  <RadioGroup value={correctIndex} onValueChange={setCorrectIndex} className="space-y-3">
                    {options.map((o, i) => {
                      const isCorrect = correctIndex === String(i);
                      return (
                        <div
                          key={o.id ?? `opt-${i}`}
                          className={cn(
                            "rounded-xl border-2 p-4 space-y-3 transition-all",
                            isCorrect ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/40 bg-muted/5",
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <RadioGroupItem value={String(i)} id={`c-${i}`} className="shrink-0" />
                              <Label
                                htmlFor={`c-${i}`}
                                className={cn(
                                  "text-sm cursor-pointer",
                                  isCorrect ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground",
                                )}
                              >
                                {isCorrect ? t("survey.mark_correct_selected") : t("survey.mark_correct")}
                              </Label>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-muted-foreground">{t("survey.option_number", { n: i + 1 })}</span>
                              {options.length > 2 ? (
                                <button
                                  type="button"
                                  onClick={() => removeOption(i)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                  aria-label={t("common.delete")}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                {t("survey.option_label_ar")}
                              </span>
                              <Input
                                dir="rtl"
                                className="text-right h-10"
                                value={o.label_ar}
                                placeholder={t("survey.placeholder_option_ar")}
                                onChange={(e) =>
                                  setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, label_ar: e.target.value } : x)))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                {t("survey.option_label_en")}
                              </span>
                              <Input
                                dir="ltr"
                                className="text-left h-10"
                                value={o.label_en}
                                placeholder={t("survey.placeholder_option_en")}
                                onChange={(e) =>
                                  setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, label_en: e.target.value } : x)))
                                }
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <label
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/20 cursor-pointer text-xs",
                                "hover:border-primary/40 hover:bg-primary/5 transition-all",
                                uploading && "opacity-50 pointer-events-none",
                              )}
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              {o.image_url ? t("survey.change_image") : t("survey.add_option_image")}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => void handleOptImage(i, e)}
                                disabled={uploading}
                              />
                            </label>
                            {o.image_url ? (
                              <div className="relative shrink-0">
                                <img
                                  src={o.image_url}
                                  alt=""
                                  className="h-10 w-10 rounded-lg object-cover border border-border/60"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, image_url: null } : x)))
                                  }
                                  className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
                                  aria-label={t("survey.remove_option_image")}
                                >
                                  <X className="w-2.5 h-2.5 text-white" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </RadioGroup>

                  {options.length >= MAX_MC_OPTIONS ? (
                    <p className="text-xs text-muted-foreground text-center">{t("survey.max_options_reached")}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* 6. Settings */}
            <div className={sectionClass}>
              <h3 className={sectionTitleClass}>
                <Settings2 className="w-4 h-4 shrink-0" aria-hidden />
                {t("survey.section_settings")}
              </h3>
              <div className="grid sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("survey.sort_order")}</Label>
                  <Input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="h-11 max-w-[120px]"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">{t("survey.sort_order_hint")}</p>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl border border-border/40 bg-muted/10">
                  <Switch checked={isActive} onCheckedChange={setIsActive} id="active" className="mt-0.5" />
                  <div className="space-y-0.5 min-w-0">
                    <Label htmlFor="active" className="text-sm font-medium cursor-pointer">
                      {isActive ? t("survey.active") : t("survey.inactive")}
                    </Label>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {isActive ? t("survey.active_hint") : t("survey.inactive_hint")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border/40">
              <Button type="button" variant="outline" onClick={() => navigate(`/admin/surveys/${surveyId}`)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={upsert.isPending || uploading}
                className="gap-2 min-w-[120px]"
              >
                {upsert.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Save className="w-4 h-4 shrink-0" />
                )}
                {t("survey.save_question")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminQuestionEdit;
