import React, { useCallback, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAllSurveys } from "@/hooks/survey/useSurveys";
import { useAdminSurveyQuestions } from "@/hooks/survey/useSurveyQuestions";
import { useDeleteSurveyQuestion, useImportCatalogQuestions } from "@/hooks/survey/useSurveyAdminMutations";
import { SURVEY_TYPES_WITH_CATALOG_IMPORT } from "@/constants/surveyTypeOptions";
import { SURVEY_TYPE_META } from "@/constants/surveyTypeMeta";
import { Button } from "@/components/ui/button";
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
  ArrowLeft,
  ArrowRight,
  Download,
  Hash,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AdminSurveyDetail: React.FC = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { data: surveys, isLoading: surveysLoading } = useAdminAllSurveys();
  const survey = useMemo(() => surveys?.find((s) => s.id === surveyId), [surveys, surveyId]);
  const { data: questions = [], isLoading } = useAdminSurveyQuestions(surveyId);
  const deleteQ = useDeleteSurveyQuestion();
  const importCatalog = useImportCatalogQuestions();
  const [pendingDelete, setPendingDelete] = React.useState<{ id: string } | null>(null);

  const showImportCatalog = survey ? SURVEY_TYPES_WITH_CATALOG_IMPORT.includes(survey.type) : false;

  const handleImport = useCallback(async () => {
    if (!surveyId) return;
    try {
      await importCatalog.mutateAsync(surveyId);
      toast.success(t("common.success"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "IMPORT_NOT_SUPPORTED") toast.error(t("survey.import_not_supported"));
      else toast.error(msg || t("common.error"));
    }
  }, [importCatalog, surveyId, t]);

  const meta = SURVEY_TYPE_META[survey?.type ?? "custom"] ?? SURVEY_TYPE_META.custom;
  const MetaIcon = meta.icon;
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  if (!surveyId) return null;

  return (
    <AdminLayout>
      <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
        <Button asChild variant="ghost" size="sm" className="-ms-1 gap-1.5">
          <Link to="/admin/surveys">
            <BackIcon className="h-4 w-4 shrink-0" />
            {t("survey.all_surveys")}
          </Link>
        </Button>

        {surveysLoading ? (
          <div className="flex min-h-[8rem] items-center justify-center rounded-2xl border border-border/60">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : survey ? (
          <div className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-5" dir={isRTL ? "rtl" : "ltr"}>
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", meta.bg)}>
              <MetaIcon className={cn("h-6 w-6", meta.color)} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-start gap-2">
                <h1 className="text-xl font-black leading-snug sm:text-2xl">{isRTL ? survey.title_ar : survey.title_en}</h1>
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    survey.is_active
                      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border border-border/40 bg-muted/30 text-muted-foreground",
                  )}
                >
                  {survey.is_active ? t("survey.active") : t("survey.inactive")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", meta.bg, meta.color)}>
                  <MetaIcon className="h-3.5 w-3.5" />
                  {isRTL ? meta.label_ar : meta.label_en}
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Hash className="h-3.5 w-3.5" />
                  {t("survey.order")} {survey.sort_order}
                </span>
                {(isRTL ? survey.description_ar : survey.description_en) ? (
                  <span className="max-w-xs truncate text-xs">{isRTL ? survey.description_ar : survey.description_en}</span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        )}

        <div className="flex flex-wrap items-center gap-2" dir={isRTL ? "rtl" : "ltr"}>
          {showImportCatalog ? (
            <Button type="button" size="sm" variant="outline" className="h-9 gap-2" disabled={importCatalog.isPending} onClick={() => void handleImport()}>
              {importCatalog.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("survey.import_from_catalog")}
            </Button>
          ) : null}
          <Button type="button" size="sm" className="h-9 gap-2" onClick={() => navigate(`/admin/surveys/${surveyId}/questions/new`)}>
            <Plus className="h-4 w-4" />
            {t("survey.add_question")}
          </Button>
        </div>

        <div dir={isRTL ? "rtl" : "ltr"}>
          <div className="flex items-center gap-2 border-s-2 border-primary ps-3">
            <h2 className="text-base font-bold">{t("survey.questions_section")}</h2>
            <span className="tabular-nums text-xs text-muted-foreground">({questions.length})</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border/60 p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/40 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/30">
              <HelpCircle className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-bold">{t("survey.no_questions_title")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("survey.no_questions_hint")}</p>
            </div>
            <Button type="button" size="sm" className="mt-1 gap-2" onClick={() => navigate(`/admin/surveys/${surveyId}/questions/new`)}>
              <Plus className="h-4 w-4" />
              {t("survey.add_first_question")}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card" dir={isRTL ? "rtl" : "ltr"}>
            {questions.map((q) => {
              const isMc = q.question_type === "multiple_choice";
              const title = isRTL ? q.title_ar : q.title_en;
              const optCount = q.options?.length ?? 0;
              return (
                <div key={q.id} className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/10 sm:p-5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/30 text-xs font-black tabular-nums text-muted-foreground">
                    {q.sort_order}
                  </div>
                  {q.image_url ? (
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                      <img src={q.image_url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/40 bg-muted/10">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-semibold leading-snug">{title}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          isMc
                            ? "border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {isMc ? t("survey.question_type_mc") : t("survey.question_type_yesno")}
                      </span>
                      {isMc && optCount > 0 ? (
                        <span className="text-[10px] text-muted-foreground">{t("survey.options_count_short", { count: optCount })}</span>
                      ) : null}
                      {q.is_active === false ? (
                        <span className="rounded-full bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">{t("survey.inactive")}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                    <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary">
                      <Link to={`/admin/surveys/${surveyId}/questions/${q.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingDelete({ id: q.id })}
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
            <AlertDialogTitle>{t("survey.confirm_delete_question")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingDelete || !surveyId) return;
                try {
                  await deleteQ.mutateAsync({ questionId: pendingDelete.id, surveyId });
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

export default AdminSurveyDetail;
