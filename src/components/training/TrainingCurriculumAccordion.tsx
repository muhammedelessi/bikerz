import React, { useState } from 'react';
import { Check, ChevronDown, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TrainingSessionCurriculum } from '@/lib/trainingSessionCurriculum';

type Props = {
  sessions: TrainingSessionCurriculum[];
  isRTL: boolean;
  className?: string;
};

const TrainingCurriculumAccordion: React.FC<Props> = ({ sessions, isRTL, className }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!sessions.length) return null;

  const totalHours = sessions.reduce((t, s) => t + s.duration_hours, 0);

  return (
    <Card className={cn('border-border/60', className)}>
      <CardContent className="p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-bold">
          {isRTL ? `الجلسات (${sessions.length})` : `Sessions (${sessions.length})`}
        </h2>
        <div className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden">
          {sessions.map((session, idx) => {
            const expanded = openIdx === idx;
            const title = isRTL ? session.title_ar || session.title_en : session.title_en || session.title_ar;
            return (
              <div key={`${session.session_number}-${idx}`} className="bg-card">
                <button
                  type="button"
                  onClick={() => setOpenIdx(expanded ? null : idx)}
                  className="flex w-full items-center gap-2 px-3 py-3 text-start hover:bg-muted/30 transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      expanded && 'rotate-180',
                    )}
                  />
                  <span className="font-semibold text-primary shrink-0">
                    {isRTL ? `الجلسة ${session.session_number}` : `Session ${session.session_number}`}
                  </span>
                  {title ? (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="truncate min-w-0 flex-1 text-sm">{title}</span>
                    </>
                  ) : null}
                  <span className="text-muted-foreground shrink-0 text-xs hidden sm:inline">·</span>
                  <span className="flex items-center gap-1 text-muted-foreground text-xs shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {session.duration_hours}
                    {isRTL ? 'س' : 'h'}
                  </span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="flex items-center gap-1 text-amber-600 text-xs shrink-0">
                    <Trophy className="w-3.5 h-3.5" />
                    {session.points}
                    {isRTL ? 'ن' : 'pts'}
                  </span>
                </button>
                {expanded ? (
                  <div className="px-4 pb-3 pt-0 border-t border-border/40 bg-muted/10">
                    {session.objectives.some((o) => String(o.ar || o.en).trim()) ? (
                      <ul className="space-y-2 pt-3">
                        {session.objectives.map((obj, oi) => {
                          const line = isRTL ? obj.ar || obj.en : obj.en || obj.ar;
                          if (!line.trim()) return null;
                          return (
                            <li key={oi} className="flex justify-start gap-2 text-sm">
                              <Check className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                              <span dir={isRTL ? 'rtl' : 'ltr'}>{line}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground py-3">
                        {isRTL ? 'لا توجد أهداف تعليمية مذكورة لهذه الجلسة.' : 'No learning objectives listed for this session.'}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground pt-1 border-t border-border/40">
          <span>
            {isRTL ? 'الإجمالي:' : 'Total:'}{' '}
            <span className="text-foreground font-medium">
              {totalHours} {isRTL ? 'ساعات' : 'hrs'}
            </span>
            <span className="mx-1">·</span>
            <span className="text-amber-600 font-semibold inline-flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" />
              {totalPts} {isRTL ? 'نقطة' : 'pts'}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrainingCurriculumAccordion;
