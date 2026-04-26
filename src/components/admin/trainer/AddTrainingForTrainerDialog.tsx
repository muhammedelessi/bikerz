import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES } from '@/data/countryCityData';
import { CountryCityPicker } from '@/components/ui/fields';
import { toast } from 'sonner';

export type AddTrainingForTrainerDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trainerId: string;
  existingTrainingIds: string[];
  isRTL: boolean;
  /** Reserved for parity with admin/self flows; same UI for both */
  mode?: 'admin' | 'self';
};

type TrainingCatalogRow = {
  id: string;
  name_ar: string;
  name_en: string;
  type?: string | null;
  default_sessions_count?: number | null;
  default_session_duration_hours?: number | null;
};

const emptyForm = {
  training_id: '',
  price: 0,
  sessions_count: 1,
  duration_hours: 2,
  location: '',
  location_detail: '',
};

/**
 * Shared “add training assignment” dialog — same fields as admin trainer profile
 * (catalog defaults for sessions/duration, price, country/city, location detail).
 */
export const AddTrainingForTrainerDialog: React.FC<AddTrainingForTrainerDialogProps> = ({
  open,
  onOpenChange,
  trainerId,
  existingTrainingIds,
  isRTL,
}) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: allTrainings } = useQuery({
    queryKey: ['all-trainings-catalog'],
    queryFn: async () => {
      const { data } = await supabase
        .from('trainings')
        .select('id, name_ar, name_en, type, default_sessions_count, default_session_duration_hours');
      return (data || []) as TrainingCatalogRow[];
    },
  });

  const availableTrainings = allTrainings?.filter((tr) => !existingTrainingIds.includes(tr.id)) || [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('trainer_courses').insert({
        trainer_id: trainerId,
        training_id: form.training_id,
        price: form.price,
        sessions_count: form.sessions_count,
        duration_hours: form.duration_hours,
        location: form.location || '',
        location_detail: form.location_detail?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-courses', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-view', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-bookings', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['trainer-profile-students', trainerId] });
      queryClient.invalidateQueries({ queryKey: ['admin-trainer-courses-summary'] });
      queryClient.invalidateQueries({ queryKey: ['current-trainer'] });
      onOpenChange(false);
      setForm(emptyForm);
      toast.success(isRTL ? 'تم إضافة التدريب' : 'Training added');
    },
    onError: () => toast.error(isRTL ? 'خطأ' : 'Error'),
  });

  const locationParts = form.location.split(' - ');
  const countryPart = locationParts[0] || '';
  const cityPart = locationParts[1] || '';
  const selectedCountryForLoc = COUNTRIES.find((c) => c.en === countryPart);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{isRTL ? 'إضافة تدريب' : 'Add Training'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'التدريب' : 'Training'}</Label>
            <Select
              value={form.training_id}
              onValueChange={(v) => {
                const tr = allTrainings?.find((x) => x.id === v);
                setForm((f) => ({
                  ...f,
                  training_id: v,
                  sessions_count: Math.max(1, Number(tr?.default_sessions_count ?? 1)),
                  duration_hours: Math.max(0.25, Number(tr?.default_session_duration_hours ?? 2)),
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'اختر تدريب' : 'Select training'} />
              </SelectTrigger>
              <SelectContent>
                {availableTrainings.map((tr) => (
                  <SelectItem key={tr.id} value={tr.id}>
                    {isRTL ? tr.name_ar : tr.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{isRTL ? 'السعر (ر.س)' : 'Price (SAR)'}</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'عدد الجلسات' : 'Sessions'}</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={form.sessions_count}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sessions_count: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'مدة كل جلسة (ساعات)' : 'Hours / session'}</Label>
              <Input
                type="number"
                min={0.25}
                step={0.25}
                value={form.duration_hours}
                onChange={(e) =>
                  setForm((f) => ({ ...f, duration_hours: Math.max(0.25, parseFloat(e.target.value) || 0.25) }))
                }
              />
            </div>
          </div>
          <CountryCityPicker
            country={selectedCountryForLoc?.code || ''}
            city={cityPart}
            onCountryChange={(code) => {
              const c = COUNTRIES.find((x) => x.code === code);
              if (c) setForm((f) => ({ ...f, location: c.en }));
            }}
            onCityChange={(v) => {
              const cName = selectedCountryForLoc?.en || countryPart;
              setForm((f) => ({ ...f, location: cName + ' - ' + v }));
            }}
          />
          <div className="space-y-2">
            <Label>{isRTL ? 'تفاصيل الموقع' : 'Location Details'}</Label>
            <Input
              value={form.location_detail}
              onChange={(e) => setForm((f) => ({ ...f, location_detail: e.target.value }))}
              placeholder={isRTL ? 'أدخل العنوان التفصيلي للموقع' : 'Enter the detailed location address'}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.training_id}>
            {saveMutation.isPending ? '...' : isRTL ? 'حفظ' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
