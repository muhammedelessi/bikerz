import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Trash2, ChevronDown, Star } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { COUNTRIES, OTHER_OPTION } from '@/data/countryCityData';
import {
  parseAssignmentLocation,
  buildTrainerCourseLocation,
  courseLocationDisplayLine,
} from '@/components/admin/trainerProfileLocationHelpers';
import { useCurrency } from '@/contexts/CurrencyContext';

export type TrainerCourseRow = {
  id: string;
  trainer_id: string;
  training_id: string;
  price: number | string;
  sessions_count?: number | string | null;
  duration_hours: number | string;
  location: string | null;
  trainings?: { name_ar: string; name_en: string } | null;
};

export type TrainingStudentRow = {
  id: string;
  training_id: string;
  full_name: string;
  phone: string;
  email: string;
  enrolled_at: string;
};

export type TrainerReviewRow = {
  id: string;
  training_id: string | null;
  student_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export const ProfileSectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-4 flex items-center gap-2">
    <div className="h-0.5 w-8 shrink-0 rounded bg-primary" aria-hidden />
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
  </div>
);

export const TrainerCourseEditDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tc: TrainerCourseRow | null;
  isRTL: boolean;
}> = ({ open, onOpenChange, tc, isRTL }) => {
  const queryClient = useQueryClient();
  const cardDir = isRTL ? 'rtl' : 'ltr';
  const [editPrice, setEditPrice] = useState('');
  const [editSessions, setEditSessions] = useState('');
  const [editDur, setEditDur] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editCity, setEditCity] = useState('');

  useEffect(() => {
    if (!tc || !open) return;
    const { countryCode, city } = parseAssignmentLocation(tc.location || '');
    setEditPrice(String(tc.price ?? ''));
    setEditSessions(String(Math.max(1, Number(tc.sessions_count ?? 1))));
    setEditDur(String(tc.duration_hours ?? ''));
    setEditCountry(countryCode);
    setEditCity(city);
  }, [tc, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tc) return;
      const location = buildTrainerCourseLocation(editCountry, editCity);
      const { error } = await supabase
        .from('trainer_courses')
        .update({
          price: parseFloat(editPrice) || 0,
          sessions_count: Math.max(1, parseInt(editSessions, 10) || 1),
          duration_hours: Math.max(0.25, parseFloat(editDur) || 0.25),
          location,
        })
        .eq('id', tc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!tc) return;
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-courses', tc.trainer_id] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-view', tc.trainer_id] });
      queryClient.invalidateQueries({ queryKey: ['trainer-admin-bookings', tc.trainer_id] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-bookings', tc.trainer_id] });
      queryClient.invalidateQueries({ queryKey: ['admin-trainer-courses-summary'] });
      onOpenChange(false);
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    },
    onError: (e) => toast.error(String((e as Error)?.message || 'Error')),
  });

  const selectedCountry = COUNTRIES.find((c) => c.code === editCountry);
  const cityList = selectedCountry ? [...selectedCountry.cities, OTHER_OPTION] : [];
  const cityInList =
    !!selectedCountry && (cityList.some((c) => c.en === editCity || c.ar === editCity) || !editCity);

  if (!tc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={cardDir}>
        <DialogHeader>
          <DialogTitle>{isRTL ? 'تعديل التعيين' : 'Edit assignment'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{isRTL ? 'السعر (ر.س)' : 'Price (SAR)'}</Label>
            <Input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} dir="ltr" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isRTL ? 'عدد الجلسات' : 'Sessions'}</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={editSessions}
              onChange={(e) => setEditSessions(e.target.value)}
              dir="ltr"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isRTL ? 'مدة كل جلسة (ساعات)' : 'Hours / session'}</Label>
            <Input type="number" min={0.25} step={0.25} value={editDur} onChange={(e) => setEditDur(e.target.value)} dir="ltr" className="h-10" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{isRTL ? 'الدولة' : 'Country'}</Label>
            <Select value={editCountry} onValueChange={(v) => setEditCountry(v)}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder={isRTL ? 'الدولة' : 'Country'} />
              </SelectTrigger>
              <SelectContent dir={cardDir}>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {isRTL ? c.ar : c.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isRTL ? 'المدينة' : 'City'}</Label>
            {selectedCountry ? (
              cityInList ? (
                <Select value={editCity} onValueChange={(v) => setEditCity(v)}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder={isRTL ? 'المدينة' : 'City'} />
                  </SelectTrigger>
                  <SelectContent dir={cardDir}>
                    {cityList.map((c) => (
                      <SelectItem key={c.en} value={c.en}>
                        {isRTL ? c.ar : c.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input className="h-10 text-sm" value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder={isRTL ? 'المدينة' : 'City'} />
              )
            ) : (
              <Input className="h-10 text-sm" value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder={isRTL ? 'المدينة' : 'City'} />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? '...' : isRTL ? 'حفظ' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const TrainingCourseAccordionRow: React.FC<{
  tc: TrainerCourseRow;
  isRTL: boolean;
  students: TrainingStudentRow[];
  reviews: TrainerReviewRow[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}> = ({ tc, isRTL, students, reviews, isExpanded, onToggle, onEdit, onDeleted }) => {
  const { formatPriceValueThenCurrencyName } = useCurrency();
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<'students' | 'reviews'>('students');
  const cardDir = isRTL ? 'rtl' : 'ltr';
  const trainingStudents = students.filter((s) => s.training_id === tc.training_id);
  const trainingReviews = reviews.filter((r) => r.training_id === tc.training_id);
  const trainingName = isRTL ? tc.trainings?.name_ar : tc.trainings?.name_en;
  const locLine = courseLocationDisplayLine(tc.location, isRTL) || (tc.location || '').trim() || '—';
  const sess = Math.max(1, Number(tc.sessions_count ?? 1));
  const durH = Number(tc.duration_hours);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('trainer_courses').delete().eq('id', tc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-courses', tc.trainer_id] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-view', tc.trainer_id] });
      queryClient.invalidateQueries({ queryKey: ['trainer-admin-bookings', tc.trainer_id] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-bookings', tc.trainer_id] });
      queryClient.invalidateQueries({ queryKey: ['admin-trainer-courses-summary'] });
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      onDeleted();
    },
    onError: () => toast.error(isRTL ? 'خطأ' : 'Error'),
  });

  const subTabBtn = (tabKey: 'students' | 'reviews', labelAr: string, labelEn: string, count: number) => (
    <button
      type="button"
      onClick={() => setSubTab(tabKey)}
      className={cn(
        'border-b-2 px-2 py-1.5 text-xs font-medium transition-colors sm:text-sm',
        subTab === tabKey ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {isRTL ? labelAr : labelEn} ({count})
    </button>
  );

  return (
    <div className="border-b border-border/40" dir={cardDir}>
      <div className="flex flex-wrap items-stretch gap-1 py-2 sm:items-center sm:gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-md py-1 text-start hover:bg-muted/30"
        >
          <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="mt-0.5 shrink-0">
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug text-foreground" lang={isRTL ? 'ar' : 'en'}>
              {trainingName || '—'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span
                className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
                dir={isRTL ? 'rtl' : 'ltr'}
                lang={isRTL ? 'ar' : 'en'}
              >
                {formatPriceValueThenCurrencyName(
                  {
                    originalPrice: Math.ceil(Number(tc.price)),
                    discountPct: 0,
                    finalPrice: Math.ceil(Number(tc.price)),
                    currency: 'SAR',
                    isCountryPrice: false,
                    vatPct: 0,
                  },
                  isRTL,
                )}
              </span>
              <span className="mx-1.5 text-border">·</span>
              {sess} {isRTL ? 'جلسات' : 'sessions'}
              <span className="mx-1.5 text-border">·</span>
              {durH} {isRTL ? 'س/جلسة' : 'h/sess'}
              <span className="mx-1.5 text-border">·</span>
              <span className="line-clamp-1">{locLine}</span>
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 self-center">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label={isRTL ? 'تعديل' : 'Edit'}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            disabled={deleteMutation.isPending}
            aria-label={isRTL ? 'حذف' : 'Delete'}
            onClick={() => {
              if (!window.confirm(isRTL ? 'حذف هذا التدريب من المدرب؟' : 'Remove this training assignment?')) return;
              deleteMutation.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border/30 pb-4 pt-3">
              <div className="flex gap-1 border-b border-border/40">
                {subTabBtn('students', 'الطلاب', 'Students', trainingStudents.length)}
                {subTabBtn('reviews', 'التقييمات', 'Reviews', trainingReviews.length)}
              </div>

              {subTab === 'students' ? (
                trainingStudents.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {isRTL ? 'لا يوجد طلاب.' : 'No students.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-0 hover:bg-transparent">
                          <TableHead className="h-9 text-xs font-semibold">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                          <TableHead className="h-9 text-xs font-semibold">{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                          <TableHead className="h-9 text-xs font-semibold">{isRTL ? 'البريد' : 'Email'}</TableHead>
                          <TableHead className="h-9 text-xs font-semibold">{isRTL ? 'التسجيل' : 'Enrolled'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trainingStudents.map((s, idx) => (
                          <TableRow key={s.id} className={cn('border-0 text-xs', idx % 2 === 1 ? 'bg-muted/25' : '')}>
                            <TableCell className="py-2">{s.full_name}</TableCell>
                            <TableCell className="py-2" dir="ltr">
                              {s.phone}
                            </TableCell>
                            <TableCell className="max-w-[140px] truncate py-2">{s.email}</TableCell>
                            <TableCell className="py-2 tabular-nums" dir="ltr">
                              {format(new Date(s.enrolled_at), 'yyyy-MM-dd')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : trainingReviews.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{isRTL ? 'لا توجد تقييمات.' : 'No reviews.'}</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {trainingReviews.map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{r.student_name}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums" dir="ltr">
                          {format(new Date(r.created_at), 'yyyy-MM-dd')}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn('h-3.5 w-3.5', i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25')}
                          />
                        ))}
                      </div>
                      {r.comment ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{r.comment}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
