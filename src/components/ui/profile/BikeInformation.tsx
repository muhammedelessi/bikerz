import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bike, Edit2, Check, X, Loader2 } from 'lucide-react';
import { ExtendedProfile } from '@/hooks/useUserProfile';

interface BikeInformationProps {
  profile: ExtendedProfile;
  onUpdate: (updates: Partial<ExtendedProfile>) => Promise<void>;
  isUpdating: boolean;
}

export const BikeInformation: React.FC<BikeInformationProps> = ({
  profile,
  onUpdate,
  isUpdating,
}) => {
  const { isRTL } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    bike_brand: profile.bike_brand || '',
    bike_model: profile.bike_model || '',
    engine_size_cc: profile.engine_size_cc?.toString() || '',
    riding_experience_years: profile.riding_experience_years?.toString() || '',
  });

  const handleSave = async () => {
    await onUpdate({
      bike_brand: formData.bike_brand || null,
      bike_model: formData.bike_model || null,
      engine_size_cc: formData.engine_size_cc ? parseInt(formData.engine_size_cc) : null,
      riding_experience_years: formData.riding_experience_years ? parseInt(formData.riding_experience_years) : null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      bike_brand: profile.bike_brand || '',
      bike_model: profile.bike_model || '',
      engine_size_cc: profile.engine_size_cc?.toString() || '',
      riding_experience_years: profile.riding_experience_years?.toString() || '',
    });
    setIsEditing(false);
  };

  const fields = [
    { key: 'bike_brand', label: isRTL ? 'العلامة التجارية' : 'Bike Brand', type: 'text' },
    { key: 'bike_model', label: isRTL ? 'الموديل' : 'Bike Model', type: 'text' },
    { key: 'engine_size_cc', label: isRTL ? 'سعة المحرك (سي سي)' : 'Engine Size (cc)', type: 'number' },
    { key: 'riding_experience_years', label: isRTL ? 'سنوات الخبرة' : 'Years of Experience', type: 'number' },
  ];

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bike className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {isRTL ? 'معلومات الدراجة' : 'Bike Information'}
          </h3>
        </div>
        
        {!isEditing ? (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="w-4 h-4 me-2" />
            {isRTL ? 'تعديل' : 'Edit'}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-green-500" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label className="text-sm text-muted-foreground">{field.label}</Label>
            {isEditing ? (
              <Input
                type={field.type}
                value={formData[field.key as keyof typeof formData]}
                onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.label}
                className={field.type === 'number' ? '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' : ''}
              />
            ) : (
              <p className="text-foreground font-medium">
                {formData[field.key as keyof typeof formData] || (isRTL ? 'غير محدد' : 'Not specified')}
                {field.key === 'engine_size_cc' && formData.engine_size_cc && ' cc'}
                {field.key === 'riding_experience_years' && formData.riding_experience_years && (isRTL ? ' سنة' : ' years')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
