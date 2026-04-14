import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Edit2, Check, X, Loader2, Star, Award, Trophy, Crown, Shield, Zap, Target, Rocket } from 'lucide-react';
import { ExtendedProfile } from '@/hooks/useUserProfile';

interface RiderIdentityProps {
  profile: ExtendedProfile;
  onUpdate: (updates: Partial<ExtendedProfile>) => Promise<void>;
  onAvatarUpload: (file: File) => Promise<string | null>;
  isUpdating: boolean;
}

const RANKS = [
  { 
    name: 'FUTURE LEADER', 
    name_ar: 'القائد القادم',
    icon: Rocket, 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    activeColor: 'text-slate-400',
    activeBg: 'bg-slate-500/20 border-slate-500/50',
    stars: 0
  },
  { 
    name: 'TRAINEE', 
    name_ar: 'متدرب',
    icon: Target, 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    activeColor: 'text-blue-400',
    activeBg: 'bg-blue-500/20 border-blue-500/50',
    stars: 1
  },
  { 
    name: '1500KM Builder', 
    name_ar: 'بطل 1500 كم',
    icon: Zap, 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    activeColor: 'text-green-400',
    activeBg: 'bg-green-500/20 border-green-500/50',
    stars: 2
  },
  { 
    name: 'Safe Rider', 
    name_ar: 'راكب آمن',
    icon: Shield, 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    activeColor: 'text-emerald-400',
    activeBg: 'bg-emerald-500/20 border-emerald-500/50',
    stars: 3
  },
  { 
    name: 'Champion', 
    name_ar: 'بطل',
    icon: Trophy, 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    activeColor: 'text-yellow-400',
    activeBg: 'bg-yellow-500/20 border-yellow-500/50',
    stars: 4
  },
  { 
    name: 'Trainer', 
    name_ar: 'مدرب',
    icon: Award, 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    activeColor: 'text-orange-400',
    activeBg: 'bg-orange-500/20 border-orange-500/50',
    stars: 5
  },
  { 
    name: 'Master', 
    name_ar: 'محترف',
    icon: Crown, 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    activeColor: 'text-purple-400',
    activeBg: 'bg-purple-500/20 border-purple-500/50',
    stars: 6
  },
  { 
    name: 'Legend', 
    name_ar: 'أسطورة',
    icon: Star, 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    activeColor: 'text-primary',
    activeBg: 'bg-primary/20 border-primary/50',
    stars: 7
  },
];

// Check if profile is complete
const isProfileComplete = (profile: ExtendedProfile): boolean => {
  return !!(
    profile.full_name &&
    profile.rider_nickname &&
    profile.bike_brand &&
    profile.bike_model &&
    profile.engine_size_cc &&
    profile.riding_experience_years !== null &&
    profile.avatar_url
  );
};

// Get missing fields
const getMissingFields = (profile: ExtendedProfile, t: any): string[] => {
  const missing: string[] = [];
  if (!profile.full_name) missing.push(t('profile.fullName'));
  if (!profile.rider_nickname) missing.push(t('profile.riderNickname'));
  if (!profile.bike_brand) missing.push(t('profile.bikeBrand'));
  if (!profile.bike_model) missing.push(t('profile.bikeModel'));
  if (!profile.engine_size_cc) missing.push(t('profile.engineSize'));
  if (profile.riding_experience_years === null) missing.push(t('profile.experienceYears'));
  if (!profile.avatar_url) missing.push(t('profile.profilePhoto'));
  return missing;
};

export const RiderIdentity: React.FC<RiderIdentityProps> = ({
  profile,
  onUpdate,
  onAvatarUpload,
  isUpdating,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nickname, setNickname] = useState(profile.rider_nickname || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    await onAvatarUpload(file);
    setIsUploadingAvatar(false);
  };

  const handleSaveNickname = async () => {
    await onUpdate({ rider_nickname: nickname || null });
    setIsEditingNickname(false);
  };

  const currentRankIndex = RANKS.findIndex(r => r.name === profile.experience_level);
  const profileComplete = isProfileComplete(profile);
  const missingFields = getMissingFields(profile, t);

  return (
    <div className="space-y-4">

      <div className="card-premium p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar Section */}
          <div className="relative">
            <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || 'User'} />
              <AvatarFallback className="text-2xl sm:text-3xl bg-primary/10 text-primary">
                {profile.full_name?.charAt(0) || profile.rider_nickname?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            
            <Button
              size="icon"
              variant="secondary"
              className="absolute bottom-0 end-0 rounded-full w-8 h-8 sm:w-10 sm:h-10"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Info Section */}
          <div className="flex-1 text-center sm:text-start space-y-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                {profile.full_name || t('common.user')}
              </h2>
              
              {/* Rider Nickname */}
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                {isEditingNickname ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder={t('profile.riderNickname')}
                      className="h-8 w-40"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={handleSaveNickname}
                      disabled={isUpdating}
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-green-500" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setNickname(profile.rider_nickname || '');
                        setIsEditingNickname(false);
                      }}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {profile.rider_nickname || t('profile.addNickname')}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setIsEditingNickname(true)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ranking System */}
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 text-center">
            {t('profile.rankingSystem')}
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {RANKS.map((rank, index) => {
              const isActive = rank.name === profile.experience_level;
              const isPast = index < currentRankIndex;
              const Icon = rank.icon;
              
              return (
                <div
                  key={rank.name}
                  className={`relative flex flex-col items-center p-3 rounded-xl border transition-all duration-300 ${
                    isActive 
                      ? `${rank.activeBg} border-2 shadow-lg scale-105` 
                      : isPast
                        ? 'bg-muted/30 border-muted/50 opacity-60'
                        : 'bg-muted/20 border-muted/30 opacity-40'
                  }`}
                >
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: rank.stars || 1 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          isActive || isPast 
                            ? 'text-yellow-400 fill-yellow-400' 
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                  
                  {/* Icon */}
                  <div className={`p-2 rounded-full mb-2 ${
                    isActive 
                      ? `bg-gradient-to-br from-white/10 to-white/5`
                      : 'bg-muted/30'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      isActive 
                        ? rank.activeColor 
                        : isPast 
                          ? 'text-muted-foreground/70' 
                          : 'text-muted-foreground/30'
                    }`} />
                  </div>
                  
                  {/* Rank Name */}
                  <span className={`text-xs font-medium text-center leading-tight ${
                    isActive 
                      ? rank.activeColor 
                      : isPast 
                        ? 'text-muted-foreground/70' 
                        : 'text-muted-foreground/40'
                  }`}>
                    {isRTL ? rank.name_ar : rank.name}
                  </span>
                  
                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute -top-1 -end-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <p className="text-xs text-muted-foreground text-center mt-4">
            {t('profile.experienceLevelDesc')}
          </p>
        </div>
      </div>
    </div>
  );
};
