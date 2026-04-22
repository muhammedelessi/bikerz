import React, { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import ResultBar from "./ResultBar";
import { useSurveyQuestions } from "@/hooks/survey/useSurveyQuestions";
import { useSurveyAnswers } from "@/hooks/survey/useSurveyAnswers";
import { useSurveyStats } from "@/hooks/survey/useSurveyStats";
import { useSurveyCompletionsList } from "@/hooks/survey/useSurveyStats";
import { supabase } from "@/integrations/supabase/client";
import type { QuestionStats, Survey, SurveyQuestion } from "@/types/survey";
interface SurveyResultsSectionProps {
  survey: Survey;
  userId: string;
  isRTL: boolean;
}

type AnswerRow = { question_id: string; answer: string };

const SurveyResultsSection: React.FC<SurveyResultsSectionProps> = ({ survey, userId, isRTL }) => {
  const { t } = useTranslation();
  const mode = survey.survey_mode ?? "scored";
  const { data: questions = [] } = useSurveyQuestions(survey.id);
  const { answers = [] } = useSurveyAnswers(userId, survey.id);
  const { data: stats } = useSurveyStats(survey.id);
  const { data: allCompletions = [] } = useSurveyCompletionsList(survey.id);

  const { data: preferenceAnswers = [] } = useQuery({
    queryKey: ["survey-all-answers-results", survey.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("survey_answers").select("question_id, answer").eq("survey_id", survey.id);
      if (error) throw error;
      return (data ?? []) as AnswerRow[];
    },
    enabled: mode === "preference",
  });

  const myCompletion = useMemo(() => allCompletions.find((c) => c.user_id === userId), [allCompletions, userId]);

  const betterPercent = useMemo(() => {
    if (mode !== "scored" || !myCompletion || !allCompletions.length) return null;
    const myRatio = myCompletion.max_score > 0 ? myCompletion.score / myCompletion.max_score : 0;
    let lower = 0;
    for (const c of allCompletions) {
      const r = c.max_score > 0 ? c.score / c.max_score : 0;
      if (r < myRatio) lower++;
    }
    return Math.round((lower / allCompletions.length) * 100);
  }, [allCompletions, myCompletion, mode]);

  const statsByQuestion = useMemo(() => {
    const m = new Map<string, QuestionStats>();
    stats?.question_stats.forEach((s) => m.set(s.question_id, s));
    return m;
  }, [stats]);

  const answerByQuestion = useMemo(() => {
    const m = new Map<string, (typeof answers)[number]>();
    answers.forEach((a) => m.set(a.question_id, a));
    return m;
  }, [answers]);

  const preferenceAnswersFor = useCallback(
    (qid: string) => preferenceAnswers.filter((a) => a.question_id === qid),
    [preferenceAnswers],
  );

  const renderPreferenceMc = (q: SurveyQuestion, title: string) => {
    const rows = preferenceAnswersFor(q.id);
    const total = Math.max(rows.length, 1);
    const opts = q.options || [];
    const userAns = answerByQuestion.get(q.id)?.answer;
    return (
      <div key={q.id} className="space-y-3 rounded-xl border border-border/40 bg-muted/5 p-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs font-medium text-muted-foreground">{t("survey.preference_results_vs_community")}</p>
        <div className="space-y-2">
          {opts.map((opt) => {
            const c = rows.filter((r) => r.answer === opt.id).length;
            const pct = Math.round((c / total) * 100);
            const you = userAns === opt.id;
            const label = isRTL ? opt.label_ar : opt.label_en;
            return (
              <div key={opt.id} className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="min-w-[6rem] font-medium">{label}</span>
                <span className="flex w-8 shrink-0 items-center justify-center" aria-hidden>
                  {you ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <X className="h-4 w-4 text-muted-foreground/40" />}
                </span>
                <span className="text-muted-foreground">{t("survey.you_mark")}</span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="h-2 min-w-[4rem] flex-1 overflow-hidden rounded-full bg-muted/40">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground" dir="ltr">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!questions.length) {
    return <p className="text-sm text-muted-foreground">{t("survey.no_questions")}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-black">{t("survey.results_title")}</h2>
        {mode === "scored" && myCompletion ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("survey.score_label")}: {myCompletion.score} / {myCompletion.max_score}
          </p>
        ) : mode === "preference" ? (
          <p className="text-sm text-muted-foreground">{t("survey.preference_results_intro")}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("survey.no_results_yet")}</p>
        )}
      </div>

      {stats && stats.total_participants > 0 && mode === "scored" ? (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/30 p-4">
          <h3 className="text-lg font-bold">{t("survey.community_comparison")}</h3>
          {betterPercent !== null ? (
            <p className="text-sm font-medium text-primary">{t("survey.better_than", { percent: betterPercent })}</p>
          ) : null}
          {stats.max_score > 0 ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{t("survey.average_score")}:</span>{" "}
              <span className="tabular-nums" dir="ltr">
                {stats.avg_score ?? 0} / {stats.max_score}
              </span>
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">{t("survey.participants", { count: stats.total_participants })}</p>

          <div className="space-y-1 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("survey.score_distribution")}</p>
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
      ) : null}

      {stats && stats.total_participants > 0 && mode === "preference" ? (
        <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
          <p className="text-sm text-muted-foreground">{t("survey.participants", { count: stats.total_participants })}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-base font-bold">{t("survey.per_question_title")}</h3>
        {questions.map((q) => {
          const st = statsByQuestion.get(q.id);
          const ans = answerByQuestion.get(q.id);
          const title = isRTL ? q.title_ar : q.title_en;
          if (q.question_type === "yes_no") {
            const yes = st?.yes_count ?? 0;
            const no = st?.no_count ?? 0;
            const max = Math.max(yes + no, 1);
            const userYes = ans?.answer === "yes";
            return (
              <div key={q.id} className="space-y-2 rounded-xl border border-border/40 bg-muted/5 p-3">
                <p className="text-sm font-semibold">{title}</p>
                <ResultBar label={t("survey.yes")} value={yes} max={max} color="bg-emerald-500/50" userMark={userYes} />
                <ResultBar label={t("survey.no")} value={no} max={max} color="bg-red-500/40" userMark={ans?.answer === "no"} />
              </div>
            );
          }
          if (mode === "preference") {
            return renderPreferenceMc(q, title);
          }
          const correctOpt = (q.options || []).find((o) => o.is_correct);
          const userOpt = (q.options || []).find((o) => o.id === ans?.answer);
          const pct = st?.correct_percent ?? 0;
          return (
            <div key={q.id} className="space-y-2 rounded-xl border border-border/40 bg-muted/5 p-3">
              <p className="text-sm font-semibold">{title}</p>
              <ResultBar
                label={t("survey.community_correct")}
                value={pct}
                max={100}
                color="bg-primary/50"
                rightLabel={`${pct}%`}
              />
              {ans ? (
                <p className="text-xs text-muted-foreground">
                  {t("survey.your_answer")}: {isRTL ? userOpt?.label_ar : userOpt?.label_en} —{" "}
                  {ans.is_correct ? t("survey.correct") : t("survey.wrong")}
                </p>
              ) : null}
              {correctOpt ? (
                <p className="text-xs text-emerald-600">
                  {t("survey.correct_answer")}: {isRTL ? correctOpt.label_ar : correctOpt.label_en}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SurveyResultsSection;
