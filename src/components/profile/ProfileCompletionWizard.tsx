import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Bike, 
  Award,
  ChevronRight, 
  ChevronLeft,
  X,
  Gift,
  Sparkles,
  Camera,
  Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useGHLSync } from '@/hooks/useGHLSync';

interface ProfileCompletionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const STEPS = [
  { id: 'rider', icon: User, title: 'Rider Identity', title_ar: 'هوية الراكب' },
  { id: 'bike', icon: Bike, title: 'Your Bike', title_ar: 'دراجتك' },
  { id: 'complete', icon: Award, title: 'Complete!', title_ar: 'اكتمل!' },
];

const BIKE_BRANDS = [
  'Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'Ducati', 'BMW', 'Harley-Davidson',
  'KTM', 'Triumph', 'Aprilia', 'Royal Enfield', 'Benelli', 'CFMoto', 'Other'
];

const ProfileCompletionWizard: React.FC<ProfileCompletionWizardProps> = ({
  open,
  onOpenChange,
  onComplete
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data
  const [riderNickname, setRiderNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [bikeBrand, setBikeBrand] = useState('');
  const [bikeModel, setBikeModel] = useState('');
  const [engineSize, setEngineSize] = useState('');
  const [ridingYears, setRidingYears] = useState('');
  const [noBike, setNoBike] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [couponCopied, setCouponCopied] = useState(false);

  // Pre-fill with existing data if available
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setRiderNickname(data.rider_nickname || '');
        setPhone(data.phone || '');
        setBikeBrand(data.bike_brand || '');
        setBikeModel(data.bike_model || '');
        setEngineSize(data.engine_size_cc?.toString() || '');
        setRidingYears(data.riding_experience_years?.toString() || '');
        if (data.avatar_url) {
          setAvatarPreview(data.avatar_url);
        }
      }
    };
    
    if (open) {
      loadExistingProfile();
    }
  }, [user, open]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;
    
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile, { upsert: true });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleNext = async () => {
    // When moving from bike step (1) to reward step (2), save the profile
    if (currentStep === 1) {
      try {
        await saveProfile();
      } catch (e) {
        console.error('Save failed, still advancing:', e);
      }
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    // Mark as skipped in localStorage to show reminder later
    localStorage.setItem('profile_completion_skipped', 'true');
    localStorage.setItem('profile_completion_skip_time', Date.now().toString());
    onOpenChange(false);
    toast.info(
      isRTL 
        ? 'يمكنك إكمال ملفك الشخصي لاحقاً للحصول على خصم 10%!' 
        : 'You can complete your profile later for 10% off!'
    );
  };

  const saveProfile = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    
    try {
      // Upload avatar if selected
      let avatarUrl = avatarPreview;
      if (avatarFile) {
        const uploadedUrl = await uploadAvatar();
        if (uploadedUrl) avatarUrl = uploadedUrl;
      }
      
      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          rider_nickname: riderNickname || null,
          phone: phone || null,
          bike_brand: bikeBrand || null,
          bike_model: bikeModel || null,
          engine_size_cc: engineSize ? parseInt(engineSize) : null,
          riding_experience_years: ridingYears ? parseInt(ridingYears) : null,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Clear skip flags and store coupon for auto-apply at checkout
      localStorage.removeItem('profile_completion_skipped');
      localStorage.removeItem('profile_completion_skip_time');
      localStorage.setItem('profile_completed', 'true');
      localStorage.setItem('profile_coupon_code', 'PROFILE10');
      
      // Log activity
      await supabase.from('user_activity_timeline').insert({
        user_id: user.id,
        activity_type: 'profile_completed',
        title: 'Profile completed',
        title_ar: 'تم إكمال الملف الشخصي',
        description: 'Earned 10% discount reward',
        description_ar: 'حصل على خصم 10%',
      });
      
      toast.success(
        isRTL 
          ? '🎉 تم إكمال ملفك الشخصي! حصلت على خصم 10%' 
          : '🎉 Profile complete! You earned 10% off'
      );
      
      onComplete?.();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(isRTL ? 'فشل في تحديث الملف الشخصي' : 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigate = useNavigate();

  const handleClaimCoupon = () => {
    navigator.clipboard.writeText('PROFILE10');
    localStorage.setItem('profile_coupon_code', 'PROFILE10');
    toast.success(isRTL ? 'تم نسخ الكوبون! تصفح الدورات الآن' : 'Coupon copied! Browse courses now');
    onOpenChange(false);
    navigate('/courses');
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  
  const ChevronNext = isRTL ? ChevronLeft : ChevronRight;
  const ChevronPrev = isRTL ? ChevronRight : ChevronLeft;
  const isMobile = useIsMobile();

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Rider Identity
        return (
          <motion.div
            key="rider"
            initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
            className="space-y-5"
          >
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-muted border-2 border-dashed border-primary/50 flex items-center justify-center overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <label 
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
                >
                  <Camera className="w-4 h-4 text-primary-foreground" />
                  <input 
                    type="file" 
                    id="avatar-upload"
                    className="hidden" 
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'أضف صورتك الشخصية' : 'Add your profile photo'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">
                {isRTL ? 'لقب الراكب' : 'Rider Nickname'}
              </Label>
              <Input
                id="nickname"
                value={riderNickname}
                onChange={(e) => setRiderNickname(e.target.value)}
                placeholder={isRTL ? 'مثال: النسر الأسود' : 'e.g., Black Eagle'}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                {isRTL ? 'رقم الهاتف' : 'Phone Number'}
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={isRTL ? '+966 5XX XXX XXXX' : '+966 5XX XXX XXXX'}
                className="h-11"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ridingYears">
                {isRTL ? 'سنوات الخبرة في القيادة' : 'Years of Riding Experience'}
              </Label>
              <Input
                id="ridingYears"
                type="number"
                min="0"
                max="50"
                value={ridingYears}
                onChange={(e) => setRidingYears(e.target.value)}
                placeholder={isRTL ? 'عدد السنوات' : 'Number of years'}
                className="h-11"
              />
            </div>
          </motion.div>
        );
        
      case 1: // Bike Info
        return (
          <motion.div
            key="bike"
            initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
            className="space-y-5"
          >
            {/* No bike toggle */}
            <label className="flex items-center gap-3 p-3 rounded-lg border border-input bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={noBike}
                onChange={(e) => {
                  setNoBike(e.target.checked);
                  if (e.target.checked) {
                    setBikeBrand('');
                    setBikeModel('');
                    setEngineSize('');
                  }
                }}
                className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {isRTL ? 'لا أملك دراجة حالياً' : "I don't have a bike yet"}
                </span>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'يمكنك إضافة بيانات الدراجة لاحقاً' : 'You can add bike info later'}
                </p>
              </div>
            </label>

            {!noBike && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bikeBrand">
                    {isRTL ? 'ماركة الدراجة' : 'Bike Brand'}
                  </Label>
                  <select
                    id="bikeBrand"
                    value={bikeBrand}
                    onChange={(e) => setBikeBrand(e.target.value)}
                    className="w-full h-11 px-3 rounded-md border border-input bg-background text-foreground"
                  >
                    <option value="">{isRTL ? 'اختر الماركة' : 'Select brand'}</option>
                    {BIKE_BRANDS.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bikeModel">
                    {isRTL ? 'موديل الدراجة' : 'Bike Model'}
                  </Label>
                  <Input
                    id="bikeModel"
                    value={bikeModel}
                    onChange={(e) => setBikeModel(e.target.value)}
                    placeholder={isRTL ? 'مثال: CBR 600RR' : 'e.g., CBR 600RR'}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="engineSize">
                    {isRTL ? 'حجم المحرك (سي سي)' : 'Engine Size (CC)'}
                  </Label>
                  <Input
                    id="engineSize"
                    type="number"
                    min="50"
                    max="3000"
                    value={engineSize}
                    onChange={(e) => setEngineSize(e.target.value)}
                    placeholder={isRTL ? 'مثال: 600' : 'e.g., 600'}
                    className="h-11"
                  />
                </div>
              </>
            )}
          </motion.div>
        );
        
      case 2: // Complete
        return (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center py-4 sm:py-6"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            
            <h3 className="text-xl font-bold mb-2">
              {isRTL ? '🎉 رائع! ملفك الشخصي مكتمل' : '🎉 Awesome! Profile Complete'}
            </h3>
            
            <p className="text-muted-foreground mb-6">
              {isRTL 
                ? 'حصلت على كوبون خصم 10% على أول دورة!' 
                : 'You earned a 10% discount coupon for your first course!'}
            </p>

            <div className="w-full p-4 rounded-lg bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Gift className="w-5 h-5 text-primary" />
                <span className="font-bold text-lg text-primary">
                  {isRTL ? 'خصم 10%' : '10% OFF'}
                </span>
              </div>
              
              <div className="flex items-center justify-center gap-2 mt-3">
                <code className="px-4 py-2 bg-background border-2 border-dashed border-primary/50 rounded-lg text-lg font-mono font-bold tracking-widest text-foreground">
                  PROFILE10
                </code>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={() => {
                  navigator.clipboard.writeText('PROFILE10');
                  setCouponCopied(true);
                  toast.success(isRTL ? 'تم نسخ الكوبون!' : 'Coupon copied!');
                  setTimeout(() => setCouponCopied(false), 2000);
                }}
              >
                {couponCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    {isRTL ? 'تم النسخ' : 'Copied!'}
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    {isRTL ? 'نسخ الكوبون' : 'Copy Coupon'}
                  </>
                )}
              </Button>
              
              <p className="text-xs text-muted-foreground mt-3">
                {isRTL 
                  ? 'استخدم هذا الكوبون عند الشراء في صفحة الدفع' 
                  : 'Use this coupon at checkout when purchasing a course'}
              </p>
            </div>
          </motion.div>
        );
        
      default:
        return null;
    }
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-3">
        {React.createElement(STEPS[currentStep].icon, {
          className: "w-5 h-5 sm:w-6 sm:h-6 text-primary"
        })}
        <div>
          {isMobile ? (
            <>
              <DrawerTitle className="text-base sm:text-lg">
                {isRTL ? STEPS[currentStep].title_ar : STEPS[currentStep].title}
              </DrawerTitle>
              <DrawerDescription className="text-xs sm:text-sm">
                {isRTL 
                  ? `الخطوة ${currentStep + 1} من ${STEPS.length}` 
                  : `Step ${currentStep + 1} of ${STEPS.length}`}
              </DrawerDescription>
            </>
          ) : (
            <>
              <DialogTitle className="text-lg">
                {isRTL ? STEPS[currentStep].title_ar : STEPS[currentStep].title}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {isRTL 
                  ? `الخطوة ${currentStep + 1} من ${STEPS.length}` 
                  : `Step ${currentStep + 1} of ${STEPS.length}`}
              </DialogDescription>
            </>
          )}
        </div>
      </div>
      <Progress value={progress} className="h-2 mt-3" />
    </>
  );

  const bodyContent = (
    <>
      <div className="mt-3 sm:mt-4 min-h-0 overflow-y-auto max-h-[60vh] sm:max-h-[70vh] px-1">
        <AnimatePresence mode="wait">
          {renderStepContent()}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t">
        {currentStep === 0 ? (
          <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground text-sm">
            {isRTL ? 'تخطي' : 'Skip for now'}
          </Button>
        ) : currentStep === 2 ? (
          null
        ) : (
          <Button variant="outline" onClick={handlePrev} disabled={isSubmitting} size={isMobile ? "sm" : "default"}>
            <ChevronPrev className="w-4 h-4" />
            {isRTL ? 'السابق' : 'Previous'}
          </Button>
        )}

        {currentStep === 0 ? (
          <Button onClick={handleNext} size={isMobile ? "sm" : "default"}>
            {isRTL ? 'التالي' : 'Next'}
            <ChevronNext className="w-4 h-4" />
          </Button>
        ) : currentStep === 1 ? (
          <Button 
            onClick={handleNext} 
            disabled={isSubmitting}
            className="bg-gradient-to-r from-primary to-accent text-sm"
            size={isMobile ? "sm" : "default"}
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isRTL ? 'إكمال و الحصول على خصم' : 'Complete & Get Discount'}
                <Gift className="w-4 h-4" />
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={handleClaimCoupon}
            className="bg-gradient-to-r from-primary to-accent w-full text-sm"
            size={isMobile ? "sm" : "default"}
          >
            <Gift className="w-4 h-4" />
            {isRTL ? 'احصل على كوبون الخصم' : 'Claim Discount Coupon'}
          </Button>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-6 pt-2 max-h-[92vh] overflow-y-auto">
          <DrawerHeader className="px-0 pb-2">
            {headerContent}
          </DrawerHeader>
          {bodyContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {headerContent}
        </DialogHeader>
        {bodyContent}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileCompletionWizard;
