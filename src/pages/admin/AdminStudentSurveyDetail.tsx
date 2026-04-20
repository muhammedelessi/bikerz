import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useStudentAllSurveyAnswerRows, useStudentAllSurveyCompletions } from "@/hooks/survey/useAdminSurveyStats";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

type AnswerRow = {
  id: string;
  survey_id: string;
  question_id: string;
  answer: string;
  is_correct: boolean | null;
  answered_at: string;
  survey: { title_ar: string; title_en: string } | null;
  survey_questions: {
    title_ar: string;
    title_en: string;
    question_type: string;
    survey_question_options: { id: string; label_ar: string; label_en: string; is_correct: boolean }[];
  } | null;
};

const AdminStudentSurveyDetail: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { data: completions = [], isLoading: loadingC } = useStudentAllSurveyCompletions(userId);
  const { data: answers = [], isLoading: loadingA } = useStudentAllSurveyAnswerRows(userId);

  const grouped = useMemo(() => {
    const m = new Map<string, AnswerRow[]>();
    (answers as AnswerRow[]).forEach((a) => {
      const list = m.get(a.survey_id) || [];
      list.push(a);
      m.set(a.survey_id, list);
    });
    return m;
  }, [answers]);

  if (!userId) return null;

  return (
    <AdminLayout>
      <div className="p-6 space-y-8 max-w-3xl" dir={isRTL ? "rtl" : "ltr"}>
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link to="/admin/surveys/statistics">
            <ArrowLeft className="w-4 h-4" />
            {t("survey.back_to_stats")}
          </Link>
        </Button>

        <h1 className="text-2xl font-bold">{t("survey.student_detail_title")}</h1>
        <p className="text-sm text-muted-foreground font-mono">{userId}</p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("survey.completed")}</h2>
          {loadingC ? (
            <p>{t("common.loading")}</p>
          ) : completions.length === 0 ? (
            <p className="text-muted-foreground">{t("survey.no_results_yet")}</p>
          ) : (
            <ul className="space-y-2">
              {(completions as { id: string; survey_id: string; score: number; max_score: number; completed_at: string; survey: { title_ar: string; title_en: string } | null }[]).map((c) => (
                <li key={c.id} className="rounded-lg border border-border px-3 py-2 flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{c.survey ? (isRTL ? c.survey.title_ar : c.survey.title_en) : c.survey_id}</span>
                  <span className="text-sm tabular-nums">
                    {c.score} / {c.max_score}
                  </span>
                  <span className="text-xs text-muted-foreground w-full">{new Date(c.completed_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t("survey.student_answers")}</h2>
          {loadingA ? (
            <p>{t("common.loading")}</p>
          ) : answers.length === 0 ? (
            <p className="text-muted-foreground">{t("survey.no_answers")}</p>
          ) : (
            [...grouped.entries()].map(([sid, rows]) => {
              const title = rows[0]?.survey ? (isRTL ? rows[0].survey.title_ar : rows[0].survey.title_en) : sid;
              return (
                <div key={sid} className="rounded-xl border border-border p-4 space-y-3">
                  <h3 className="font-bold">{title}</h3>
                  <ul className="space-y-3">
                    {rows.map((row) => {
                      const q = row.survey_questions;
                      const qtitle = q ? (isRTL ? q.title_ar : q.title_en) : row.question_id;
                      const opts = q?.survey_question_options || [];
                      if (q?.question_type === "yes_no") {
                        return (
                          <li key={row.id} className="text-sm border-b border-border/40 pb-2">
                            <p className="font-medium">{qtitle}</p>
                            <p className="text-muted-foreground">
                              {row.answer === "yes" ? t("survey.yes") : t("survey.no")}
                            </p>
                          </li>
                        );
                      }
                      const picked = opts.find((o) => o.id === row.answer);
                      const correct = opts.find((o) => o.is_correct);
                      return (
                        <li key={row.id} className="text-sm border-b border-border/40 pb-2 space-y-1">
                          <p className="font-medium">{qtitle}</p>
                          <p>
                            {t("survey.your_answer")}: {picked ? (isRTL ? picked.label_ar : picked.label_en) : row.answer}
                          </p>
                          {correct ? (
                            <p className="text-xs text-emerald-600">
                              {t("survey.correct_answer")}: {isRTL ? correct.label_ar : correct.label_en}
                            </p>
                          ) : null}
                          <Badge variant={row.is_correct ? "default" : "destructive"}>{row.is_correct ? t("survey.correct") : t("survey.wrong")}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </section>
      </div>
    </AdminLayout>
  );
};

export default AdminStudentSurveyDetail;
