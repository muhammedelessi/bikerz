import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { QuestionStats, SurveyStats } from "@/types/survey";

function buildScoreDistribution(
  completions: { score: number; max_score: number }[],
  maxScore: number,
): SurveyStats["score_distribution"] {
  if (!completions.length || maxScore <= 0) return [];

  const bucketCount = Math.min(5, maxScore + 1);
  const bucketSize = Math.max(1, Math.ceil((maxScore + 1) / bucketCount));
  const buckets: { range: string; count: number }[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const lo = i * bucketSize;
    const hi = Math.min(maxScore, (i + 1) * bucketSize - 1);
    if (lo > maxScore) break;
    buckets.push({ range: `${lo}-${hi}`, count: 0 });
  }

  for (const c of completions) {
    const s = Math.min(c.score, maxScore);
    const idx = Math.min(buckets.length - 1, Math.floor(s / bucketSize));
    if (buckets[idx]) buckets[idx].count += 1;
  }

  const total = completions.length;
  return buckets.map((b) => ({
    range: b.range,
    count: b.count,
    percent: total ? Math.round((b.count / total) * 100) : 0,
  }));
}

export function useSurveyCompletionsList(surveyId: string | undefined) {
  return useQuery({
    queryKey: ["survey-completions-list", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("survey_completions").select("*").eq("survey_id", surveyId!);
      if (error) throw error;
      return (data || []) as { user_id: string; score: number; max_score: number }[];
    },
    enabled: !!surveyId,
  });
}

export function useSurveyStats(surveyId: string | undefined) {
  return useQuery({
    queryKey: ["survey-stats", surveyId],
    queryFn: async () => {
      const { data: answers, error: ansErr } = await supabase
        .from("survey_answers")
        .select("question_id, answer, is_correct")
        .eq("survey_id", surveyId!);
      if (ansErr) throw ansErr;

      const { data: completions, error: compErr } = await supabase
        .from("survey_completions")
        .select("score, max_score")
        .eq("survey_id", surveyId!);
      if (compErr) throw compErr;

      const statsMap: Record<string, { yes: number; no: number; correct: number; total: number }> = {};

      answers?.forEach((a) => {
        if (!statsMap[a.question_id]) {
          statsMap[a.question_id] = { yes: 0, no: 0, correct: 0, total: 0 };
        }
        const s = statsMap[a.question_id];
        s.total++;
        if (a.answer === "yes") s.yes++;
        if (a.answer === "no") s.no++;
        if (a.is_correct === true) s.correct++;
      });

      const question_stats: QuestionStats[] = Object.entries(statsMap).map(([qId, s]) => ({
        question_id: qId,
        yes_count: s.yes,
        no_count: s.no,
        total: s.total,
        yes_percent: s.total ? Math.round((s.yes / s.total) * 100) : 0,
        correct_percent: s.total ? Math.round((s.correct / s.total) * 100) : null,
      }));

      const maxScore = completions?.[0]?.max_score ?? 0;
      const total_participants = completions?.length || 0;
      const avg_score =
        total_participants && completions?.length
          ? Math.round(completions.reduce((acc, c) => acc + c.score, 0) / completions.length)
          : null;

      const score_distribution = buildScoreDistribution(completions || [], maxScore);

      return {
        total_participants,
        avg_score,
        max_score: maxScore,
        question_stats,
        score_distribution,
      } satisfies SurveyStats;
    },
    enabled: !!surveyId,
  });
}
