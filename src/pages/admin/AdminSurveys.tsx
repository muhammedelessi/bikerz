import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAllSurveys } from "@/hooks/survey/useSurveys";
import { useAdminSurveyQuestions } from "@/hooks/survey/useSurveyQuestions";
import { useSurveyStats } from "@/hooks/survey/useSurveyStats";
import { useCreateSurvey, useDeleteSurvey, useUpdateSurveyMeta } from "@/hooks/survey/useSurveyAdminMutations";
import { getSurveyTypeLabels, SURVEY_TYPE_OPTIONS } from "@/constants/surveyTypeOptions";
import { SURVEY_TYPE_META } from "@/constants/surveyTypeMeta";
import { type Survey, type SurveyMode, type SurveyType, defaultSurveyModeForType } from "@/types/survey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BarChart2,
  BarChart3,
  Check,
  Gamepad2,
  HelpCircle,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  AlertTriangle,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FormState = {
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  type: SurveyType;
  survey_mode: SurveyMode;
  sort_order: number;
  is_active: boolean;
};

const defaultForm = (nextSort: number): FormState => ({
  title_ar: "",
  title_en: "",
  description_ar: "",
  description_en: "",
  type: "custom",
  survey_mode: defaultSurveyModeForType("custom"),
  sort_order: nextSort,
  is_active: true,
});

const surveyFromRow = (s: Survey): FormState => ({
  title_ar: s.title_ar,
  title_en: s.title_en,
  description_ar: s.description_ar ?? "",
  description_en: s.description_en ?? "",
  type: s.type,
  survey_mode: s.survey_mode ?? defaultSurveyModeForType(s.type),
  sort_order: s.sort_order,
  is_active: s.is_active,
});

const SurveyQuestionCount: React.FC<{ surveyId: string }> = ({ surveyId }) => {
  const { t } = useTranslation();
  const { data: questions = [], isLoading } = useAdminSurveyQuestions(surveyId);
  if (isLoading) {
    return <span className="tabular-nums text-muted-foreground/70">—</span>;
  }
  return <span className="tabular-nums">{t("survey.question_count", { count: questions.length })}</span>;
};

const SurveyParticipantCount: React.FC<{ surveyId: string }> = ({ surveyId }) => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useSurveyStats(surveyId);
  if (isLoading) {
    return <span className="tabular-nums text-muted-foreground/70">—</span>;
  }
  return (
    <span className="tabular-nums">{t("survey.participant_count", { count: stats?.total_participants ?? 0 })}</span>
  );
};

const AdminSurveys: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { data: surveys, isLoading } = useAdminAllSurveys();
  const createSurvey = useCreateSurvey();
  const updateSurveyMeta = useUpdateSurveyMeta();
  const deleteSurvey = useDeleteSurvey();

  const ordered = useMemo(() => [...(surveys || [])].sort((a, b) => a.sort_order - b.sort_order), [surveys]);

  const nextSortOrder = useMemo(() => {
    const list = surveys || [];
    if (!list.length) return 1;
    return Math.max(...list.map((s) => s.sort_order), 0) + 1;
  }, [surveys]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => defaultForm(nextSortOrder));
  const [pendingDelete, setPendingDelete] = useState<Survey | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultForm(nextSortOrder));
    setOpen(true);
  };

  const openEdit = (survey: Survey) => {
    setEditingId(survey.id);
    setForm(surveyFromRow(survey));
    setOpen(true);
  };

  const submit = async () => {
    if (!form.title_ar.trim() || !form.title_en.trim()) {
      toast.error(t("common.error"));
      return;
    }
    try {
      if (editingId) {
        await updateSurveyMeta.mutateAsync({
          id: editingId,
          title_ar: form.title_ar.trim(),
          title_en: form.title_en.trim(),
          description_ar: form.description_ar.trim() || null,
          description_en: form.description_en.trim() || null,
          is_active: form.is_active,
          sort_order: form.sort_order,
          survey_mode: form.survey_mode,
        });
        toast.success(t("common.success"));
        setOpen(false);
        setEditingId(null);
        return;
      }
      const { id } = await createSurvey.mutateAsync({
        title_ar: form.title_ar.trim(),
        title_en: form.title_en.trim(),
        description_ar: form.description_ar.trim() || null,
        description_en: form.description_en.trim() || null,
        type: form.type,
        survey_mode: form.survey_mode,
        sort_order: form.sort_order,
        is_active: form.is_active,
      });
      toast.success(t("common.success"));
      setOpen(false);
      navigate(`/admin/surveys/${id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const pending = createSurvey.isPending || updateSurveyMeta.isPending;

  const EmptyState = () => (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/50 p-12 text-center sm:p-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30">
        <Gamepad2 className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div>
        <p className="font-bold">{t("survey.no_surveys_title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("survey.no_surveys_hint")}</p>
      </div>
      <Button type="button" size="sm" className="mt-2 gap-1.5" onClick={openAdd}>
        <Plus className="h-4 w-4" />
        {t("survey.add_first_survey")}
      </Button>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Gamepad2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">{t("survey.knowledge_tests")}</h1>
              <p className="text-sm text-muted-foreground">{t("survey.manage_surveys_subtitle", { count: ordered.length })}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/admin/surveys/statistics">
                <BarChart3 className="h-4 w-4" />
                {t("survey.survey_statistics")}
              </Link>
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              {t("survey.add_survey")}
            </Button>
          </div>
        </div>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditingId(null);
          }}
        >
          <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle>{editingId ? t("survey.edit_survey_title") : t("survey.create_survey_title")}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sv-title-ar">{t("survey.survey_title_ar")}</Label>
                  <Input
                    id="sv-title-ar"
                    value={form.title_ar}
                    onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
                    placeholder="..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sv-title-en">{t("survey.survey_title_en")}</Label>
                  <Input
                    id="sv-title-en"
                    value={form.title_en}
                    onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
                    placeholder="..."
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sv-desc-ar">{t("survey.survey_description_ar")}</Label>
                  <Textarea
                    id="sv-desc-ar"
                    rows={2}
                    className="resize-none"
                    value={form.description_ar}
                    onChange={(e) => setForm((f) => ({ ...f, description_ar: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sv-desc-en">{t("survey.survey_description_en")}</Label>
                  <Textarea
                    id="sv-desc-en"
                    rows={2}
                    className="resize-none"
                    value={form.description_en}
                    onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))}
                  />
                </div>
              </div>

              {editingId ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{t("survey.survey_type")}</p>
                  <p className="mt-1 text-sm font-semibold">{getSurveyTypeLabels(form.type, isRTL).label}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>{t("survey.survey_type")}</Label>
                  <div className="grid max-h-[min(50vh,22rem)] grid-cols-1 gap-2 overflow-y-auto pr-0.5">
                    {SURVEY_TYPE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              type: opt.value,
                              survey_mode: defaultSurveyModeForType(opt.value),
                            }))
                          }
                          className={cn(
                            "flex items-center gap-3 rounded-xl border-2 p-3 text-start transition-all",
                            form.type === opt.value
                              ? "border-primary bg-primary/10"
                              : "border-border/40 bg-muted/10 hover:border-primary/30",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              form.type === opt.value ? "bg-primary/10" : "bg-muted/30",
                            )}
                          >
                            <Icon className={cn("h-4 w-4", form.type === opt.value ? "text-primary" : "text-muted-foreground")} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-sm font-semibold", form.type === opt.value ? "text-primary" : "text-foreground")}>
                              {isRTL ? opt.label_ar : opt.label_en}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{isRTL ? opt.description_ar : opt.description_en}</p>
                          </div>
                          {form.type === opt.value ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("survey.survey_mode_label")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, survey_mode: "scored" }))}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
                      form.survey_mode === "scored"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    <Trophy className="h-5 w-5" />
                    <div className="text-center">
                      <p className="text-sm font-semibold">{t("survey.mode_scored")}</p>
                      <p className="text-xs opacity-70">{t("survey.mode_scored_hint")}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, survey_mode: "preference" }))}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
                      form.survey_mode === "preference"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    <BarChart2 className="h-5 w-5" />
                    <div className="text-center">
                      <p className="text-sm font-semibold">{t("survey.mode_preference")}</p>
                      <p className="text-xs opacity-70">{t("survey.mode_preference_hint")}</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sv-sort">{t("survey.sort_order")}</Label>
                <Input
                  id="sv-sort"
                  type="number"
                  min={1}
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 1 }))}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 px-3 py-2">
                <Label htmlFor="sv-active" className="text-sm font-medium">
                  {t("survey.active")}
                </Label>
                <Switch id="sv-active" checked={form.is_active} onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c }))} />
              </div>

              {!editingId && form.type === "custom" ? (
                <>
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>{t("survey.custom_chain_hint")}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("survey.custom_survey_hint")}</p>
                </>
              ) : null}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="button" disabled={pending} onClick={() => void submit()}>
                  {editingId ? t("common.save") : t("survey.create_survey_submit")}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : ordered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card divide-y divide-border/40">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-muted/20 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:gap-4 sm:px-5">
              <span>{t("survey.order")}</span>
              <span>{t("survey.survey_title")}</span>
              <span className="text-end">{t("survey.actions")}</span>
            </div>
            {ordered.map((survey) => {
              const meta = SURVEY_TYPE_META[survey.type] ?? SURVEY_TYPE_META.custom;
              const Icon = meta.icon;
              const title = isRTL ? survey.title_ar : survey.title_en;
              const desc = isRTL ? survey.description_ar : survey.description_en;
              return (
                <div
                  key={survey.id}
                  className="group flex flex-col gap-4 p-4 transition-colors hover:bg-muted/10 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-border/50 bg-muted/20 text-sm font-black text-muted-foreground">
                      {survey.sort_order}
                    </div>
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", meta.bg)}>
                      <Icon className={cn("h-5 w-5", meta.color)} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold leading-snug sm:text-base">{title}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            survey.is_active
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted/30 text-muted-foreground",
                          )}
                        >
                          {survey.is_active ? t("survey.active") : t("survey.inactive")}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", meta.bg, meta.color)}>
                          <Icon className="h-3 w-3" />
                          {isRTL ? meta.label_ar : meta.label_en}
                        </span>
                        <span className="flex items-center gap-1">
                          <HelpCircle className="h-3 w-3" />
                          <SurveyQuestionCount surveyId={survey.id} />
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <SurveyParticipantCount surveyId={survey.id} />
                        </span>
                      </div>
                      {desc ? <p className="max-w-lg truncate text-xs text-muted-foreground">{desc}</p> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-1.5 ps-0 sm:ps-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                      <Link to={`/admin/surveys/${survey.id}`}>
                        <Settings2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t("survey.manage")}</span>
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                      onClick={() => openEdit(survey)}
                      aria-label={t("common.edit")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingDelete(survey)}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("survey.confirm_delete_survey")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (isRTL ? pendingDelete.title_ar : pendingDelete.title_en) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!pendingDelete) return;
                try {
                  await deleteSurvey.mutateAsync(pendingDelete.id);
                  toast.success(t("common.success"));
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : t("common.error"));
                } finally {
                  setPendingDelete(null);
                }
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminSurveys;
