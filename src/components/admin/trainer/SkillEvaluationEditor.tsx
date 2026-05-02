import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { parseTrainingSkills, type TrainingSkill } from '@/lib/trainingExtras';

type EvalRow = {
  id: string;
  booking_id: string;
  trainer_id: string;
  skill_index: number;
  score: number;
  note: string | null;
};

interface Props {
  bookingId: string;
  trainerId: string;
  trainingId: string;
  isRTL: boolean;
}

export const SkillEvaluationEditor: React.FC<Props> = ({ bookingId, trainerId, trainingId, isRTL }) => {
  const qc = useQueryClient();

  const { data: training } = useQuery({
    queryKey: ['training-skills-for-eval', trainingId],
    enabled: !!trainingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainings')
        .select('skills')
        .eq('id', trainingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const skills: TrainingSkill[] = useMemo(
    () => parseTrainingSkills((training as { skills?: unknown } | null)?.skills),
    [training],
  );

  const { data: evals } = useQuery({
    queryKey: ['booking-skill-evals', bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: EvalRow[] | null; error: unknown }> } };
      })
        .from('training_booking_skill_evaluations')
        .select('id, booking_id, trainer_id, skill_index, score, note')
        .eq('booking_id', bookingId);
      if (error) throw error;
      return (data || []) as EvalRow[];
    },
  });

  const saveScore = useMutation({
    mutationFn: async ({ skillIndex, score, skill }: { skillIndex: number; score: number; skill: TrainingSkill }) => {
      const payload = {
        booking_id: bookingId,
        trainer_id: trainerId,
        skill_index: skillIndex,
        skill_name_ar: skill.name_ar,
        skill_name_en: skill.name_en,
        score,
      };
      const { error } = await (supabase as unknown as {
        from: (t: string) => {
          upsert: (v: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: unknown }>;
        };
      })
        .from('training_booking_skill_evaluations')
        .upsert(payload, { onConflict: 'booking_id,skill_index' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking-skill-evals', bookingId] });
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    },
    onError: (e) => {
      console.error(e);
      toast.error(isRTL ? 'تعذر الحفظ' : 'Save failed');
    },
  });

  if (skills.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
        {isRTL
          ? 'لم يتم تحديد مهارات لهذا التدريب بعد. يضيفها المسؤول من إدارة التدريبات.'
          : 'No skills defined for this training yet. Admin can add them in Trainings management.'}
      </div>
    );
  }

  const scoreFor = (idx: number) => evals?.find((e) => e.skill_index === idx)?.score ?? 0;

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 text-primary" />
        {isRTL ? 'تقييم المهارات (1–5)' : 'Skill evaluation (1–5)'}
      </p>
      <ul className="space-y-2">
        {skills.map((s, idx) => {
          const current = scoreFor(idx);
          const name = isRTL ? s.name_ar || s.name_en : s.name_en || s.name_ar;
          return (
            <li key={`${name}-${idx}`} className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-foreground flex-1 min-w-[120px]">{name}</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="icon"
                    variant={current >= n ? 'default' : 'outline'}
                    className="h-7 w-7"
                    disabled={saveScore.isPending}
                    onClick={() => saveScore.mutate({ skillIndex: idx, score: n, skill: s })}
                    aria-label={`${name} ${n}/5`}
                  >
                    <Star className={`h-3.5 w-3.5 ${current >= n ? 'fill-current' : ''}`} />
                  </Button>
                ))}
                <span className="ms-1 text-xs tabular-nums text-muted-foreground w-8 text-end">
                  {current ? `${current}/5` : '—'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
