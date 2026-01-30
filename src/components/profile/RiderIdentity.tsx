import React, { useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Edit2, Check, X, Loader2 } from 'lucide-react';
import { ExtendedProfile } from '@/hooks/useUserProfile';

interface RiderIdentityProps {
  profile: ExtendedProfile;
  onUpdate: (updates: Partial<ExtendedProfile>) => Promise<void>;
  onAvatarUpload: (file: File) => Promise<string | null>;
  isUpdating: boolean;
}

const EXPERIENCE_LEVEL_COLORS: Record<string, string> = {
  'FUTURE RIDER': 'bg-muted text-muted-foreground',
  'TRAINEE': 'bg-blue-500/20 text-blue-400',
  '1500KM Builder': 'bg-green-500/20 text-green-400',
  'Safe Rider': 'bg-emerald-500/20 text-emerald-400',
  'Champion': 'bg-yellow-500/20 text-yellow-400',
  'Trainer': 'bg-orange-500/20 text-orange-400',
  'Master': 'bg-purple-500/20 text-purple-400',
  'Legend': 'bg-primary/20 text-primary',
};

export const RiderIdentity: React.FC<RiderIdentityProps> = ({
  profile,
  onUpdate,
  onAvatarUpload,
  isUpdating,
}) => {
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

  const levelColor = EXPERIENCE_LEVEL_COLORS[profile.experience_level] || EXPERIENCE_LEVEL_COLORS['FUTURE RIDER'];

  return (
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
              {profile.full_name || (isRTL ? 'مستخدم' : 'User')}
            </h2>
            
            {/* Rider Nickname */}
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
              {isEditingNickname ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={isRTL ? 'اللقب' : 'Nickname'}
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
                    {profile.rider_nickname || (isRTL ? 'أضف لقب' : 'Add nickname')}
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

          {/* Experience Level Badge */}
          <div className={`inline-flex items-center px-4 py-2 rounded-full font-semibold text-sm ${levelColor}`}>
            {profile.experience_level}
          </div>
          
          <p className="text-xs text-muted-foreground">
            {isRTL 
              ? 'مستوى الخبرة يُحسب تلقائياً بناءً على تقدمك في التعلم' 
              : 'Experience level is automatically calculated based on your learning progress'}
          </p>
        </div>
      </div>
    </div>
  );
};
