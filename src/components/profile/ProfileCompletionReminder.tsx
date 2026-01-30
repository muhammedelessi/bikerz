import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Gift, X, User, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProfileCompletionWizard from './ProfileCompletionWizard';

interface ProfileCompletionReminderProps {
  variant?: 'banner' | 'card';
}

const ProfileCompletionReminder: React.FC<ProfileCompletionReminderProps> = ({ 
  variant = 'banner' 
}) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [showReminder, setShowReminder] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return;
      
      // Check if profile was already completed
      const isCompleted = localStorage.getItem('profile_completed') === 'true';
      if (isCompleted) {
        setShowReminder(false);
        return;
      }
      
      // Check if dismissed recently (within 24 hours for banner, 1 hour for session)
      const dismissedTime = localStorage.getItem('profile_reminder_dismissed');
      if (dismissedTime) {
        const timeSinceDismiss = Date.now() - parseInt(dismissedTime);
        const dismissDuration = variant === 'banner' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
        if (timeSinceDismiss < dismissDuration) {
          setShowReminder(false);
          return;
        }
      }
      
      // Fetch profile and check for missing fields
      const { data: profile } = await supabase
        .from('profiles')
        .select('rider_nickname, phone, bike_brand, bike_model, engine_size_cc, riding_experience_years, avatar_url')
        .eq('user_id', user.id)
        .single();
      
      if (!profile) return;
      
      const missing: string[] = [];
      if (!profile.rider_nickname) missing.push(isRTL ? 'لقب الراكب' : 'Rider Nickname');
      if (!profile.bike_brand) missing.push(isRTL ? 'ماركة الدراجة' : 'Bike Brand');
      if (!profile.bike_model) missing.push(isRTL ? 'موديل الدراجة' : 'Bike Model');
      if (!profile.engine_size_cc) missing.push(isRTL ? 'حجم المحرك' : 'Engine Size');
      if (!profile.avatar_url) missing.push(isRTL ? 'صورة الملف' : 'Profile Photo');
      
      if (missing.length > 0) {
        setMissingFields(missing);
        setShowReminder(true);
      } else {
        localStorage.setItem('profile_completed', 'true');
        setShowReminder(false);
      }
    };
    
    checkProfile();
  }, [user, isRTL, variant]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('profile_reminder_dismissed', Date.now().toString());
    setTimeout(() => setShowReminder(false), 300);
  };

  const handleComplete = () => {
    setShowReminder(false);
    localStorage.setItem('profile_completed', 'true');
  };

  if (!showReminder) return null;

  if (variant === 'banner') {
    return (
      <>
        <AnimatePresence>
          {!dismissed && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-b border-primary/20"
            >
              <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-full bg-primary/20">
                      <Gift className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm sm:text-base">
                        {isRTL 
                          ? '🎁 أكمل ملفك الشخصي واحصل على خصم 10%!' 
                          : '🎁 Complete your profile and get 10% off!'}
                      </p>
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {isRTL 
                          ? `متبقي: ${missingFields.slice(0, 3).join('، ')}${missingFields.length > 3 ? ' ...' : ''}`
                          : `Missing: ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? '...' : ''}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => setShowWizard(true)}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isRTL ? 'إكمال' : 'Complete'}
                      <Arrow className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={handleDismiss}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Animated gradient border */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>

        <ProfileCompletionWizard 
          open={showWizard} 
          onOpenChange={setShowWizard}
          onComplete={handleComplete}
        />
      </>
    );
  }

  // Card variant for dashboard/profile page
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-primary/20">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold mb-1">
              {isRTL ? 'أكمل ملفك الشخصي' : 'Complete Your Profile'}
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              {isRTL 
                ? 'أضف بياناتك واحصل على خصم 10% على أول دورة!' 
                : 'Add your details and get 10% off your first course!'}
            </p>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {missingFields.map((field, i) => (
                <span 
                  key={i}
                  className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                >
                  {field}
                </span>
              ))}
            </div>
            
            <Button onClick={() => setShowWizard(true)} className="w-full sm:w-auto">
              <Gift className="w-4 h-4" />
              {isRTL ? 'إكمال والحصول على الخصم' : 'Complete & Get Discount'}
            </Button>
          </div>
        </div>
      </motion.div>

      <ProfileCompletionWizard 
        open={showWizard} 
        onOpenChange={setShowWizard}
        onComplete={handleComplete}
      />
    </>
  );
};

export default ProfileCompletionReminder;
