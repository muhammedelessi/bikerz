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
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Eye,
  Loader2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SectionHeading: React.FC<{
  title: string;
  count?: number;
  isRTL: boolean;
}> = ({ title, count, isRTL }) => (
  <div dir={isRTL ? "rtl" : "ltr"} className="flex items-center gap-2 ps-3 border-s-2 border-primary">
    <h2 className="text-base font-bold text-foreground">{title}</h2>
    {count !== undefined ? (
      <span className="text-xs text-muted-foreground tabular-nums">({count})</span>
    ) : null}
  </div>
);

const StatCard: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}> = ({ icon, iconBg, label, value, sub }) => (
  <div className="rounded-2xl border border-border/60 bg-card p-5 flex items-center gap-4 min-w-0">
    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", iconBg)}>{icon}</div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
      <p className="text-3xl font-black tabular-nums leading-tight" dir="ltr">
        {value}
      </p>
      {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
    </div>
  </div>
);

const RankCard: React.FC<{
  dotColor: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  isRTL: boolean;
}> = ({ dotColor, label, value, icon, isRTL }) => (
  <div className="rounded-2xl border border-border/60 bg-card p-5 min-w-0" dir={isRTL ? "rtl" : "ltr"}>
    <div className="flex items-start gap-3">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", dotColor)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-bold leading-snug break-words">{value}</p>
      </div>
    </div>
  </div>
);

const AdminSurveyStats: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { data: surveys = [] } = useAdminAllSurveys();
  const [tab, setTab] = useState<string>("");

  const ordered = useMemo(() => [...surveys].sort((a, b) => a.sort_order - b.sort_order), [surveys]);

  React.useEffect(() => {
    if (!tab && ordered[0]) setTab(ordered[0].id);
  }, [ordered, tab]);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ms-1">
          <Link to="/admin/surveys">
            <BackIcon className="w-4 h-4 shrink-0" />
            {t("survey.all_surveys")}
          </Link>
        </Button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-primary" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t("survey.survey_statistics")}</h1>
            <p className="text-sm text-muted-foreground">{t("survey.statistics_subtitle", { count: ordered.length })}</p>
          </div>
        </div>

        {ordered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 p-12 text-center">
            <p className="text-muted-foreground">{t("common.noResults")}</p>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} dir={isRTL ? "rtl" : "ltr"} className="space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0 justify-start">
              {ordered.map((s) => (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className={cn(
                    "px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all whitespace-nowrap",
                    "data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
                    "data-[state=inactive]:border-border/40 data-[state=inactive]:bg-muted/10 data-[state=inactive]:text-muted-foreground",
                  )}
                >
                  {isRTL ? s.title_ar : s.title_en}
                </TabsTrigger>
              ))}
            </TabsList>

            {ordered.map((s) => (
              <TabsContent key={s.id} value={s.id} className="outline-none focus-visible:ring-0">
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
    return {
      best: sorted[0]?.question_id ?? null,
      worst: sorted[sorted.length - 1]?.question_id ?? null,
    };
  }, [stats]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 p-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!stats) return null;

  const distMaxCount = Math.max(...stats.score_distribution.map((x) => x.count), 1);

  return (
    <div className="space-y-10" dir={isRTL ? "rtl" : "ltr"}>
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <StatCard
          iconBg="bg-blue-500/10"
          icon={<Users className="w-6 h-6 text-blue-500" aria-hidden />}
          label={t("survey.total_participants")}
          value={stats.total_participants}
        />
        <StatCard
          iconBg="bg-amber-500/10"
          icon={<Trophy className="w-6 h-6 text-amber-500" aria-hidden />}
          label={t("survey.average_score")}
          value={stats.max_score > 0 ? (stats.avg_score ?? 0) : "—"}
          sub={stats.max_score > 0 ? t("survey.out_of", { max: stats.max_score }) : undefined}
        />
        <RankCard
          dotColor="bg-emerald-500/10"
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" aria-hidden />}
          label={t("survey.most_known")}
          value={ranked.best ? qTitle(ranked.best) : "—"}
          isRTL={isRTL}
        />
        <RankCard
          dotColor="bg-red-400/10"
          icon={<TrendingDown className="w-4 h-4 text-red-400" aria-hidden />}
          label={t("survey.least_known")}
          value={ranked.worst ? qTitle(ranked.worst) : "—"}
          isRTL={isRTL}
        />
      </div>

      <div className="space-y-3">
        <SectionHeading title={t("survey.statistics_tab")} count={stats.question_stats.length} isRTL={isRTL} />

        {stats.question_stats.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("common.noResults")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.question_stats.map((qs) => {
              const q = questions.find((x) => x.id === qs.question_id);
              const isMc = q?.question_type === "multiple_choice";
              const max = isMc ? 100 : Math.max(qs.yes_count + qs.no_count, 1);
              const noPct = Math.max(0, 100 - (qs.yes_percent ?? 0));

              return (
                <div
                  key={qs.question_id}
                  className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 min-w-0"
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold leading-snug flex-1 min-w-0 text-start">{qTitle(qs.question_id)}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[10px] font-semibold",
                        isMc
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {isMc ? t("survey.question_type_mc") : t("survey.question_type_yesno")}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    {isMc ? (
                      <ResultBar
                        label={t("survey.community_correct")}
                        value={qs.correct_percent ?? 0}
                        max={100}
                        color="bg-primary/50"
                        rightLabel={`${qs.correct_percent ?? 0}%`}
                      />
                    ) : (
                      <>
                        <ResultBar
                          label={t("survey.yes")}
                          value={qs.yes_count}
                          max={max}
                          color="bg-emerald-500/60"
                          rightLabel={`${qs.yes_count} (${qs.yes_percent ?? 0}%)`}
                        />
                        <ResultBar
                          label={t("survey.no")}
                          value={qs.no_count}
                          max={max}
                          color="bg-red-400/60"
                          rightLabel={`${qs.no_count} (${noPct}%)`}
                        />
                      </>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground text-start">{t("survey.participants", { count: qs.total })}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {stats.max_score > 0 && stats.score_distribution.length > 0 ? (
        <div className="space-y-3">
          <SectionHeading title={t("survey.score_distribution")} isRTL={isRTL} />

          <div className="rounded-2xl border border-border/60 p-5 space-y-2.5 bg-card">
            {stats.score_distribution.map((b) => {
              const barPct = Math.round((b.count / distMaxCount) * 100);
              return (
                <div key={b.range} className="flex items-center gap-3" dir="ltr">
                  <span className="text-xs font-mono text-muted-foreground w-14 shrink-0 text-end tabular-nums">{b.range}</span>
                  <div className="flex-1 h-7 bg-muted/20 rounded-lg overflow-hidden min-w-0">
                    <div
                      className="h-full bg-primary/50 rounded-lg transition-all duration-700 flex items-center justify-end pe-2"
                      style={{
                        width: `${barPct}%`,
                        minWidth: b.count > 0 ? "2.5rem" : "0",
                      }}
                    >
                      {b.count > 0 ? (
                        <span className="text-[10px] font-bold text-white drop-shadow-sm tabular-nums">{b.count}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-9 shrink-0 text-start tabular-nums">{b.percent}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <SectionHeading title={t("survey.students_tab")} count={completions.length} isRTL={isRTL} />

        {loadingStudents ? (
          <div className="rounded-2xl border border-border/60 p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : completions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 p-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-muted-foreground/40" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground">{t("survey.no_students_yet")}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 overflow-hidden bg-card" dir={isRTL ? "rtl" : "ltr"}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="w-12 font-semibold text-start">#</TableHead>
                  <TableHead className="font-semibold text-start">{t("common.user")}</TableHead>
                  <TableHead className="font-semibold text-start">{t("survey.score_label")}</TableHead>
                  <TableHead className="font-semibold text-start hidden sm:table-cell">{t("survey.completed_at")}</TableHead>
                  <TableHead className="font-semibold text-end">{t("survey.view_student")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completions.map((row, index) => {
                  const displayName = row.profile?.full_name || row.user_id;
                  const initial = displayName.charAt(0).toUpperCase();
                  const scorePct = row.max_score > 0 ? Math.round((row.score / row.max_score) * 100) : null;

                  return (
                    <TableRow key={row.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="text-start text-sm text-muted-foreground tabular-nums w-12">{index + 1}</TableCell>
                      <TableCell className="text-start">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{initial}</span>
                          </div>
                          <span className="text-sm font-medium truncate">{displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-start">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold tabular-nums" dir="ltr">
                            {row.score}
                            <span className="text-muted-foreground font-normal">/{row.max_score}</span>
                          </span>
                          {scorePct !== null ? (
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums",
                                scorePct >= 80
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : scorePct >= 50
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "bg-red-400/10 text-red-600 dark:text-red-400",
                              )}
                            >
                              {scorePct}%
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-start text-xs text-muted-foreground hidden sm:table-cell">
                        {new Date(row.completed_at).toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-end align-middle">
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 h-8 text-xs hover:bg-primary/10 hover:text-primary"
                        >
                          <Link to={`/admin/surveys/statistics/${row.user_id}`}>
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden sm:inline">{t("survey.view_student")}</span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSurveyStats;
