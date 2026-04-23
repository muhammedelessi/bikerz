import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExtendedProfile, BikeEntry } from '@/hooks/useUserProfile';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertTriangle, Bike, Plus } from 'lucide-react';
import { BikeGarage, type BikeGarageHandle } from './BikeGarage';

interface BikeInformationProps {
  profile: ExtendedProfile;
  onUpdate: (updates: Partial<ExtendedProfile>) => Promise<void>;
  isUpdating: boolean;
}

export const BikeInformation: React.FC<BikeInformationProps> = ({ profile, onUpdate, isUpdating }) => {
  const { isRTL } = useLanguage();
  const garageRef = useRef<BikeGarageHandle>(null);

  const [entries, setEntries] = useState<BikeEntry[]>(() =>
    Array.isArray(profile.bike_entries) ? profile.bike_entries : []);

  useEffect(() => {
    setEntries(Array.isArray(profile.bike_entries) ? profile.bike_entries : []);
  }, [profile.bike_entries]);

  const hasLegacyBike = entries.length === 0 && Boolean(profile.bike_brand);

  const handleChange = async (updated: BikeEntry[]) => {
    setEntries(updated);
    await onUpdate({
      bike_entries: updated,
      bike_brand: updated[0]?.brand || null,
      bike_model: updated[0]?.model || null,
    });
  };

  return (
    <div className="card-premium" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground">{isRTL ? 'الجراج' : 'Garage'}</h3>
              {entries.length > 0 && (
                <p className="text-xs text-muted-foreground truncate">
                  {entries.length} {isRTL ? (entries.length === 1 ? 'دراجة مسجلة' : 'دراجات مسجلة') : (entries.length === 1 ? 'bike registered' : 'bikes registered')}
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => garageRef.current?.openAddPage()}
            className="gap-1.5 text-xs h-8 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {isRTL ? 'إضافة' : 'Add Bike'}
          </Button>
        </div>

        {/* Legacy banner */}
        {hasLegacyBike && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{isRTL ? 'لديك دراجة مسجلة لكن نوعها غير محدد' : 'You have a registered bike without a type'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? 'يرجى تحديث بيانات دراجتك' : 'Update your bike details'}</p>
            </div>
          </div>
        )}

        {/* Garage */}
        <BikeGarage
          ref={garageRef}
          entries={entries}
          onChange={handleChange}
          userId={profile.user_id}
          isUpdating={isUpdating}
        />
      </div>
    </div>
  );
};
