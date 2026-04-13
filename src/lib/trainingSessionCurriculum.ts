export type TrainingSessionObjective = { ar: string; en: string };

export type TrainingSessionCurriculum = {
  session_number: number;
  title_ar: string;
  title_en: string;
  duration_hours: number;
  points: number;
  objectives: TrainingSessionObjective[];
};

export function parseTrainingSessions(raw: unknown): TrainingSessionCurriculum[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((x, i) => {
    const o = x as Record<string, unknown>;
    const objs = Array.isArray(o.objectives) ? o.objectives : [];
    return {
      session_number: Number(o.session_number) > 0 ? Number(o.session_number) : i + 1,
      title_ar: String(o.title_ar ?? ''),
      title_en: String(o.title_en ?? ''),
      duration_hours: Number.isFinite(Number(o.duration_hours)) ? Number(o.duration_hours) : 1,
      points: Number.isFinite(Number(o.points)) ? Math.max(0, Math.floor(Number(o.points))) : 0,
      objectives: objs.map((ob) => {
        const obo = ob as Record<string, unknown>;
        return { ar: String(obo.ar ?? ''), en: String(obo.en ?? '') };
      }),
    };
  });
}
