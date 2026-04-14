import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

interface AddInstructorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddInstructorDialog: React.FC<AddInstructorDialogProps> = ({ open, onOpenChange }) => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    email: '',
    motorbikeType: '',
    motorbikeBrand: '',
    experienceYears: 0,
    feesPerHour: 0,
    licenseType: '',
    bio: '',
    revenueSharePercentage: 70,
    isAvailable: true,
  });

  const resetForm = () => {
    setForm({
      email: '',
      motorbikeType: '',
      motorbikeBrand: '',
      experienceYears: 0,
      feesPerHour: 0,
      licenseType: '',
      bio: '',
      revenueSharePercentage: 70,
      isAvailable: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email.trim() || !form.motorbikeType.trim()) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'يرجى ملء الحقول المطلوبة' : 'Please fill in required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Find user by email
      const { data: emailData, error: emailError } = await supabase
        .rpc('get_all_user_emails');

      if (emailError) throw emailError;

      const matchedUser = emailData?.find(
        (u: { email: string }) => u.email.toLowerCase() === form.email.trim().toLowerCase()
      );

      if (!matchedUser) {
        toast({
          title: isRTL ? 'خطأ' : 'Error',
          description: isRTL
            ? 'لم يتم العثور على مستخدم بهذا البريد الإلكتروني'
            : 'No user found with this email address',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Check if already a mentor
      const { data: existingMentor } = await supabase
        .from('mentors')
        .select('id')
        .eq('user_id', matchedUser.user_id)
        .maybeSingle();

      if (existingMentor) {
        toast({
          title: isRTL ? 'خطأ' : 'Error',
          description: isRTL
            ? 'هذا المستخدم مسجل كمدرب بالفعل'
            : 'This user is already registered as an instructor',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Insert mentor record
      const { error: insertError } = await supabase.from('mentors').insert({
        user_id: matchedUser.user_id,
        motorbike_type: form.motorbikeType,
        motorbike_brand: form.motorbikeBrand || null,
        experience_years: form.experienceYears,
        fees_per_hour: form.feesPerHour,
        license_type: form.licenseType || null,
        bio: form.bio || null,
        revenue_share_percentage: form.revenueSharePercentage,
        is_available: form.isAvailable,
      });

      if (insertError) throw insertError;

      // Assign instructor role
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: matchedUser.user_id,
        role: 'instructor',
      });

      if (roleError && !roleError.message.includes('duplicate')) {
        console.warn('Could not assign instructor role:', roleError.message);
      }

      toast({
        title: isRTL ? 'تم بنجاح' : 'Success',
        description: isRTL ? 'تمت إضافة المدرب بنجاح' : 'Instructor added successfully',
      });

      queryClient.invalidateQueries({ queryKey: ['admin-instructors'] });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error adding instructor:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message || (isRTL ? 'حدث خطأ أثناء الإضافة' : 'An error occurred'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="text-start">{isRTL ? 'إضافة مدرب جديد' : 'Add New Instructor'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label>{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={isRTL ? 'بريد المستخدم المسجل' : 'Registered user email'}
              dir="ltr"
              className={isRTL ? 'text-right' : ''}
              required
            />
            <p className="text-xs text-muted-foreground text-start">
              {isRTL
                ? 'يجب أن يكون المستخدم مسجلاً في المنصة'
                : 'User must already be registered on the platform'}
            </p>
          </div>

          {/* Motorbike Type */}
          <div className="space-y-2">
            <Label>{isRTL ? 'نوع الدراجة *' : 'Motorbike Type *'}</Label>
            <Select
              value={form.motorbikeType}
              onValueChange={(v) => setForm({ ...form, motorbikeType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sport">{isRTL ? 'رياضية' : 'Sport'}</SelectItem>
                <SelectItem value="Cruiser">{isRTL ? 'كروزر' : 'Cruiser'}</SelectItem>
                <SelectItem value="Adventure">{isRTL ? 'مغامرة' : 'Adventure'}</SelectItem>
                <SelectItem value="Touring">{isRTL ? 'سياحية' : 'Touring'}</SelectItem>
                <SelectItem value="Naked">{isRTL ? 'نيكد' : 'Naked'}</SelectItem>
                <SelectItem value="Dual Sport">{isRTL ? 'ثنائية الاستخدام' : 'Dual Sport'}</SelectItem>
                <SelectItem value="Scooter">{isRTL ? 'سكوتر' : 'Scooter'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Motorbike Brand */}
          <div className="space-y-2">
            <Label>{isRTL ? 'ماركة الدراجة' : 'Motorbike Brand'}</Label>
            <Input
              value={form.motorbikeBrand}
              onChange={(e) => setForm({ ...form, motorbikeBrand: e.target.value })}
              placeholder={isRTL ? 'مثال: Yamaha' : 'e.g. Yamaha'}
            />
          </div>

          {/* Experience & Fees */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'سنوات الخبرة' : 'Experience (years)'}</Label>
              <Input
                type="number"
                min={0}
                max={50}
                value={form.experienceYears}
                onChange={(e) => setForm({ ...form, experienceYears: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'الرسوم / ساعة' : 'Fees / Hour'}</Label>
              <Input
                type="number"
                min={0}
                value={form.feesPerHour}
                onChange={(e) => setForm({ ...form, feesPerHour: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* License Type */}
          <div className="space-y-2">
            <Label>{isRTL ? 'نوع الرخصة' : 'License Type'}</Label>
            <Input
              value={form.licenseType}
              onChange={(e) => setForm({ ...form, licenseType: e.target.value })}
              placeholder={isRTL ? 'مثال: A2' : 'e.g. A2'}
            />
          </div>

          {/* Revenue Share */}
          <div className="space-y-2">
            <Label>{isRTL ? 'نسبة الأرباح (%)' : 'Revenue Share (%)'}</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.revenueSharePercentage}
              onChange={(e) => setForm({ ...form, revenueSharePercentage: parseInt(e.target.value) || 0 })}
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label>{isRTL ? 'نبذة' : 'Bio'}</Label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder={isRTL ? 'نبذة مختصرة عن المدرب' : 'Short bio about the instructor'}
              rows={3}
            />
          </div>

          {/* Available */}
          <div className="flex items-center justify-between">
            <Label>{isRTL ? 'متاح' : 'Available'}</Label>
            <Switch
              checked={form.isAvailable}
              onCheckedChange={(v) => setForm({ ...form, isAvailable: v })}
            />
          </div>

          {/* Submit */}
          <div className="flex flex-row-reverse gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {isRTL ? 'إضافة المدرب' : 'Add Instructor'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddInstructorDialog;
