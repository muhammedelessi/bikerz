import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Wrench, ChevronRight, ChevronLeft, Users, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

const TrainingsSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const { data: trainings, isLoading, isError } = useQuery({
    queryKey: ['public-trainings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainings').select('*').eq('status', 'active');
      if (error) throw error;
      return data;
    },
  });

  const { data: trainerCourses } = useQuery({
    queryKey: ['public-trainer-courses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainer_courses').select('*, trainers(*)');
      if (error) throw error;
      return data;
    },
  });

  const levelConfig: Record<string, { color: string; label: { en: string; ar: string } }> = {
    beginner: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', label: { en: 'Beginner', ar: 'مبتدئ' } },
    intermediate: { color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', label: { en: 'Intermediate', ar: 'متوسط' } },
    advanced: { color: 'bg-red-500/10 text-red-600 border-red-500/20', label: { en: 'Advanced', ar: 'متقدم' } },
  };

  const getTrainersForTraining = (trainingId: string) => trainerCourses?.filter(tc => tc.training_id === trainingId) || [];

  const practicalTrainings = useMemo(
    () => (trainings || []).filter((t) => t.type === 'practical'),
    [trainings],
  );
  const theoryTrainings = useMemo(
    () => (trainings || []).filter((t) => t.type === 'theory'),
    [trainings],
  );

  const renderTrainingGrid = (list: typeof practicalTrainings, sectionKey: string) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {list.map((t) => {
        const level = levelConfig[t.level] || levelConfig.beginner;
        const trainersCount = getTrainersForTraining(t.id).length;

        return (
          <div
            key={`${sectionKey}-${t.id}`}
            onClick={() => navigate(`/trainings/${t.id}`)}
            className={cn(
              'group relative bg-card rounded-2xl border border-border/60 overflow-hidden cursor-pointer flex flex-col',
              'transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30',
            )}
          >
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary text-primary-foreground shadow-md shadow-primary/20">
                  {t.type === 'theory' ? <GraduationCap className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                </div>
                <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border', level.color)}>
                  {isRTL ? level.label.ar : level.label.en}
                </span>
              </div>

              <h3 className="text-base font-bold text-foreground mb-1.5 line-clamp-1">
                {isRTL ? t.name_ar : t.name_en}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                {isRTL ? t.description_ar : t.description_en}
              </p>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted font-medium">
                  {t.type === 'theory' ? (isRTL ? 'نظري' : 'Theory') : isRTL ? 'عملي' : 'Practical'}
                </span>
                {t.type === 'practical' && trainersCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted font-medium">
                    <Users className="w-3 h-3" />
                    {trainersCount} {isRTL ? 'مدرب' : 'trainers'}
                  </span>
                )}
              </div>
            </div>

            <div className="px-5 pb-5">
              <button
                type="button"
                className="w-full flex items-center justify-center gap-1 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
              >
                {isRTL ? 'عرض التفاصيل' : 'View Details'}
                <Arrow className="w-4 h-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (isLoading) return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4 max-w-[1200px]">
        <Skeleton className="h-10 w-60 mx-auto mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[240px] rounded-2xl" />)}
        </div>
      </div>
    </section>
  );

  const Arrow = isRTL ? ChevronLeft : ChevronRight;
  const hasAny = !isError && (practicalTrainings.length > 0 || theoryTrainings.length > 0);

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4 max-w-[1200px]">
        <div className="text-center mb-10">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full" />
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
            {isRTL ? 'التدريبات المتاحة' : 'Available Training Programs'}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            {isRTL
              ? 'التدريب العملي والنظري منفصلان؛ كل برنامج عملي له معرّف (ID) خاص به في النظام.'
              : 'Practical and theory programs are listed separately. Each practical program has its own unique ID in the system.'}
          </p>
        </div>

        {isError && (
          <div className="text-center py-14 px-4">
            <p className="text-muted-foreground">
              {isRTL ? 'تعذر تحميل التدريبات. حاول مرة أخرى لاحقاً.' : 'Could not load training programs. Please try again later.'}
            </p>
          </div>
        )}

        {!isError && !hasAny && (
          <div className="text-center py-14 px-4">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <GraduationCap className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {isRTL ? 'لا توجد تدريبات متاحة حالياً' : 'No training programs yet'}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
              {isRTL ? 'سيتم إضافة برامج تدريبية قريباً. تابعنا للمزيد.' : 'New programs will appear here soon. Check back later.'}
            </p>
          </div>
        )}

        {hasAny && (
          <div className="space-y-14">
            {practicalTrainings.length > 0 && (
              <div>
                <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-border/70 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div className="text-start">
                      <h3 className="text-lg font-bold text-foreground">
                        {isRTL ? 'التدريب العملي' : 'Practical training'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isRTL
                          ? 'حجز جلسات مع مدربين معتمدين — كل برنامج عملي له معرّف فريد.'
                          : 'Book sessions with certified trainers — each practical program has a unique ID.'}
                      </p>
                    </div>
                  </div>
                </div>
                {renderTrainingGrid(practicalTrainings, 'p')}
              </div>
            )}

            {theoryTrainings.length > 0 && (
              <div>
                <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-border/70 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="text-start">
                      <h3 className="text-lg font-bold text-foreground">
                        {isRTL ? 'التدريب النظري' : 'Theory training'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isRTL
                          ? 'محتوى تعليمي نظري منفصل عن البرامج العملية.'
                          : 'Classroom-style theory content, separate from practical programs.'}
                      </p>
                    </div>
                  </div>
                </div>
                {renderTrainingGrid(theoryTrainings, 't')}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default TrainingsSection;
