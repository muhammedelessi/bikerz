import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ResultBar from "./ResultBar";
import { useSurveyQuestions } from "@/hooks/survey/useSurveyQuestions";
import { useSurveyAnswers } from "@/hooks/survey/useSurveyAnswers";
import { useSurveyStats } from "@/hooks/survey/useSurveyStats";
import { useSurveyCompletionsList } from "@/hooks/survey/useSurveyStats";
import type { QuestionStats, Survey } from "@/types/survey";

interface SurveyResultsSectionProps {
  survey: Survey;
  userId: string;
  isRTL: boolean;
}

const SurveyResultsSection: React.FC<SurveyResultsSectionProps> = ({ survey, userId, isRTL }) => {
  const { t } = useTranslation();
  const { data: questions = [] } = useSurveyQuestions(survey.id);
  const { answers = [] } = useSurveyAnswers(userId, survey.id);
  const { data: stats } = useSurveyStats(survey.id);
  const { data: allCompletions = [] } = useSurveyCompletionsList(survey.id);

  const myCompletion = useMemo(() => allCompletions.find((c) => c.user_id === userId), [allCompletions, userId]);

  const betterPercent = useMemo(() => {
    if (!myCompletion || !allCompletions.length) return null;
    const myRatio = myCompletion.max_score > 0 ? myCompletion.score / myCompletion.max_score : 0;
    let lower = 0;
    for (const c of allCompletions) {
      const r = c.max_score > 0 ? c.score / c.max_score : 0;
      if (r < myRatio) lower++;
    }
    return Math.round((lower / allCompletions.length) * 100);
  }, [allCompletions, myCompletion]);

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

  if (!questions.length) {
    return <p className="text-sm text-muted-foreground">{t("survey.no_questions")}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-black">{t("survey.results_title")}</h2>
        {myCompletion ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("survey.score_label")}: {myCompletion.score} / {myCompletion.max_score}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("survey.no_results_yet")}</p>
        )}
      </div>

      {stats && stats.total_participants > 0 ? (
        <div className="rounded-2xl border border-border/60 p-4 space-y-4 bg-card/30">
          <h3 className="text-lg font-bold">{t("survey.community_comparison")}</h3>
          {betterPercent !== null ? (
            <p className="text-sm font-medium text-primary">{t("survey.better_than", { percent: betterPercent })}</p>
          ) : null}
          {stats.max_score > 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("survey.average_score", { score: stats.avg_score ?? 0, max: stats.max_score })}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">{t("survey.participants", { count: stats.total_participants })}</p>

          <div className="space-y-1 pt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("survey.score_distribution")}</p>
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
              <div key={q.id} className="rounded-xl border border-border/40 p-3 space-y-2 bg-muted/5">
                <p className="text-sm font-semibold">{title}</p>
                <ResultBar label={t("survey.yes")} value={yes} max={max} color="bg-emerald-500/50" userMark={userYes} />
                <ResultBar label={t("survey.no")} value={no} max={max} color="bg-red-500/40" userMark={ans?.answer === "no"} />
              </div>
            );
          }
          const correctOpt = (q.options || []).find((o) => o.is_correct);
          const userOpt = (q.options || []).find((o) => o.id === ans?.answer);
          const pct = st?.correct_percent ?? 0;
          return (
            <div key={q.id} className="rounded-xl border border-border/40 p-3 space-y-2 bg-muted/5">
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
