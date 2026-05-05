import React from "react";
import SEOHead from "@/components/common/SEOHead";
import { useTranslation } from "react-i18next";
import { useLocalizedNavigate } from "@/hooks/useLocalizedNavigate";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RiderIdentity } from "@/components/ui/profile/RiderIdentity";
import { RankSection } from "@/components/ui/profile/RankSection";
import { BikeInformation } from "@/components/ui/profile/BikeInformation";
import SurveySection from "@/components/ui/survey/SurveySection";
import { LearningProgress } from "@/components/ui/profile/LearningProgress";
import { ProfileAchievements } from "@/components/ui/profile/ProfileAchievements";
import { ActivityTimeline } from "@/components/ui/profile/ActivityTimeline";
import { Gamepad2 } from "lucide-react";

const ProfileHome: React.FC = () => {
  const { t } = useTranslation();
  const { user, isInstructor } = useAuth();
  const navigate = useLocalizedNavigate();
  const {
    profile,
    learningStats,
    activities,
    isLoading,
    isUpdating,
    updateProfile,
    uploadAvatar,
  } = useUserProfile();

  if (!user) {
    return null;
  }

  return (
    <>
      <SEOHead title="My Profile" description="Manage your BIKERZ Academy profile, achievements, and rider identity." noindex />
      <div className="p-4 sm:p-6 space-y-8 safe-area-bottom max-w-6xl mx-auto w-full">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-60 rounded-xl" />
          </div>
        ) : profile ? (
          <>
            {/* 1. Customer Information */}
            <section id="profile-section-customer">
              <RiderIdentity profile={profile} onUpdate={updateProfile} onAvatarUpload={uploadAvatar} isUpdating={isUpdating} />
            </section>

            {/* 2. Your Rank */}
            <section id="profile-section-rank" className="space-y-3" aria-labelledby="profile-heading-rank">
              <h2 id="profile-heading-rank" className="text-xl font-bold text-foreground tracking-tight">
                {t("profile.sectionYourRank")}
              </h2>
              <RankSection profile={profile} enrollments={learningStats?.enrollments ?? []} />
            </section>

            {/* 3. Garage */}
            <div id="profile-section-bike">
              <BikeInformation profile={profile} onUpdate={updateProfile} isUpdating={isUpdating} />
            </div>

            {/* 4. Test Your Knowledge */}
            <section id="profile-section-surveys" className="space-y-4" aria-labelledby="profile-heading-surveys">
              <h2 id="profile-heading-surveys" className="text-lg font-bold flex items-center gap-2 text-foreground">
                <Gamepad2 className="w-5 h-5 text-primary" />
                {t("survey.title")}
              </h2>
              <SurveySection userId={user.id} />
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("/profile/surveys")}>
                {t("survey.start")}
              </Button>
            </section>

            {/* 5–7. Learning progress, achievements, activity */}
            {learningStats && <LearningProgress stats={learningStats} />}

            <ProfileAchievements />

            <ActivityTimeline activities={activities} />
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("profile.notFound")}</p>
          </div>
        )}
      </div>
    </>
  );
};

export default ProfileHome;
