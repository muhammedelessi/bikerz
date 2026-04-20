import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAllSurveys } from "@/hooks/survey/useSurveys";
import { useAdminSurveyQuestions } from "@/hooks/survey/useSurveyQuestions";
import { useDeleteSurveyQuestion, useImportBikeTypeQuestions } from "@/hooks/survey/useSurveyAdminMutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { ArrowLeft, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

const AdminSurveyDetail: React.FC = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { data: surveys } = useAdminAllSurveys();
  const survey = useMemo(() => surveys?.find((s) => s.id === surveyId), [surveys, surveyId]);
  const { data: questions = [], isLoading } = useAdminSurveyQuestions(surveyId);
  const deleteQ = useDeleteSurveyQuestion();
  const importTypes = useImportBikeTypeQuestions();
  const [pendingDelete, setPendingDelete] = React.useState<{ id: string } | null>(null);

  if (!surveyId) return null;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/admin/surveys">
              <ArrowLeft className="w-4 h-4" />
              {t("survey.all_surveys")}
            </Link>
          </Button>
        </div>

        {survey ? (
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{isRTL ? survey.title_ar : survey.title_en}</h1>
            <p className="text-muted-foreground text-sm">{survey.type}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="gap-2">
            <Link to={`/admin/surveys/${surveyId}/questions/new`}>
              <Plus className="w-4 h-4" />
              {t("survey.add_question")}
            </Link>
          </Button>
          {survey?.type === "bike_types" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={importTypes.isPending}
              onClick={async () => {
                try {
                  await importTypes.mutateAsync(surveyId);
                  toast.success(t("common.success"));
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : t("common.error"));
                }
              }}
            >
              <Download className="w-4 h-4" />
              {t("survey.import_from_catalog")}
            </Button>
          ) : null}
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("survey.table_title")}</TableHead>
                <TableHead>{t("survey.type_label")}</TableHead>
                <TableHead>{t("survey.sort_order")}</TableHead>
                <TableHead className="text-end">{t("common.delete")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>{t("common.loading")}</TableCell>
                </TableRow>
              ) : (
                questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link className="font-medium text-primary hover:underline" to={`/admin/surveys/${surveyId}/questions/${q.id}`}>
                        {isRTL ? q.title_ar : q.title_en}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {q.question_type === "yes_no" ? t("survey.question_type_yesno") : t("survey.question_type_mc")}
                      </Badge>
                    </TableCell>
                    <TableCell>{q.sort_order}</TableCell>
                    <TableCell className="text-end">
                      <Button type="button" size="icon" variant="ghost" onClick={() => setPendingDelete({ id: q.id })} aria-label={t("common.delete")}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
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
