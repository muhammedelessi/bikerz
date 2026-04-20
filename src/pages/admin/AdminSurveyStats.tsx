import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAllSurveys } from "@/hooks/survey/useSurveys";
import { useSurveyQuestions } from "@/hooks/survey/useSurveyQuestions";
import { useSurveyStats } from "@/hooks/survey/useSurveyStats";
import { useAdminSurveyStats } from "@/hooks/survey/useAdminSurveyStats";
import ResultBar from "@/components/ui/survey/ResultBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const AdminSurveyStats: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { data: surveys = [] } = useAdminAllSurveys();
  const [tab, setTab] = useState<string>("");

  const ordered = useMemo(() => [...surveys].sort((a, b) => a.sort_order - b.sort_order), [surveys]);

  React.useEffect(() => {
    if (!tab && ordered[0]) setTab(ordered[0].id);
  }, [ordered, tab]);

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
        <h1 className="text-2xl font-bold">{t("survey.survey_statistics")}</h1>

        {ordered.length === 0 ? (
          <p className="text-muted-foreground">{t("common.noResults")}</p>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-1">
              {ordered.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className="text-xs sm:text-sm">
                  {isRTL ? s.title_ar : s.title_en}
                </TabsTrigger>
              ))}
            </TabsList>
            {ordered.map((s) => (
              <TabsContent key={s.id} value={s.id} className="space-y-8">
                <SurveyStatsPanel surveyId={s.id} isRTL={isRTL} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
};

const SurveyStatsPanel: React.FC<{ surveyId: string; isRTL: boolean }> = ({ surveyId, isRTL }) => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useSurveyStats(surveyId);
  const { data: questions = [] } = useSurveyQuestions(surveyId);
  const { data: completions = [], isLoading: loadingStudents } = useAdminSurveyStats(surveyId);

  const qTitle = (qid: string) => {
    const q = questions.find((x) => x.id === qid);
    if (!q) return qid;
    return isRTL ? q.title_ar : q.title_en;
  };

  const ranked = useMemo(() => {
    if (!stats?.question_stats.length) return { best: null as string | null, worst: null as string | null };
    const metric = (x: (typeof stats.question_stats)[number]) => x.correct_percent ?? x.yes_percent;
    const sorted = [...stats.question_stats].sort((a, b) => metric(b) - metric(a));
    const best = sorted[0]?.question_id ?? null;
    const worst = sorted[sorted.length - 1]?.question_id ?? null;
    return { best, worst };
  }, [stats]);

  if (isLoading) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  if (!stats) return null;

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">{t("survey.total_participants")}</p>
          <p className="text-2xl font-black">{stats.total_participants}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">{t("survey.average_score")}</p>
          <p className="text-2xl font-black tabular-nums">
            {stats.max_score > 0 ? `${stats.avg_score ?? 0} / ${stats.max_score}` : t("common.none")}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4 space-y-1">
          <p className="text-xs text-muted-foreground">{t("survey.most_known")}</p>
          <p className="text-sm font-semibold">{ranked.best ? qTitle(ranked.best) : t("common.none")}</p>
          <p className="text-xs text-muted-foreground">{t("survey.least_known")}</p>
          <p className="text-sm font-semibold">{ranked.worst ? qTitle(ranked.worst) : t("common.none")}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">{t("survey.statistics_tab")}</h2>
        <div className="rounded-xl border border-border divide-y divide-border/60">
          {stats.question_stats.map((qs) => {
            const q = questions.find((x) => x.id === qs.question_id);
            const isMc = q?.question_type === "multiple_choice";
            const max = isMc ? 100 : Math.max(qs.yes_count + qs.no_count, 1);
            return (
              <div key={qs.question_id} className="p-4 space-y-2">
                <p className="text-sm font-semibold">{qTitle(qs.question_id)}</p>
                {isMc ? (
                  <ResultBar label={t("survey.community_correct")} value={qs.correct_percent ?? 0} max={100} color="bg-primary/50" />
                ) : (
                  <>
                    <ResultBar label={t("survey.yes")} value={qs.yes_count} max={max} color="bg-emerald-500/50" />
                    <ResultBar label={t("survey.no")} value={qs.no_count} max={max} color="bg-red-500/40" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">{t("survey.score_distribution")}</h2>
        <div className="space-y-1 max-w-md">
          {stats.score_distribution.map((b) => (
            <ResultBar
              key={b.range}
              label={b.range}
              value={b.count}
              max={Math.max(...stats.score_distribution.map((x) => x.count), 1)}
              color="bg-primary/50"
              rightLabel={t("survey.distribution_bucket", { count: b.count, percent: b.percent })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">{t("survey.students_tab")}</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.user")}</TableHead>
                <TableHead>{t("survey.score_label")}</TableHead>
                <TableHead>{t("survey.completed_at")}</TableHead>
                <TableHead className="text-end">{t("survey.view_student")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingStudents ? (
                <TableRow>
                  <TableCell colSpan={4}>{t("common.loading")}</TableCell>
                </TableRow>
              ) : (
                completions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.profile?.full_name || row.user_id}</TableCell>
                    <TableCell className="tabular-nums">
                      {row.score} / {row.max_score}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(row.completed_at).toLocaleString()}</TableCell>
                    <TableCell className="text-end">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/surveys/statistics/${row.user_id}`}>{t("survey.view_student")}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default AdminSurveyStats;
