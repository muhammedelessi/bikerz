import React from "react";
import SEOHead from "@/components/common/SEOHead";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
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
import { Gamepad2, LayoutDashboard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ProfileHome: React.FC = () => {
  const { t } = useTranslation();
  const { user, isInstructor } = useAuth();
  const navigate = useNavigate();
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

            {isInstructor ? (
              <section aria-labelledby="trainer-dashboard-cta-heading">
                <Card className="rounded-xl border-primary/25 bg-gradient-to-br from-primary/8 to-transparent">
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                    <div className="rounded-lg bg-primary/15 p-2.5 shrink-0">
                      <LayoutDashboard className="h-6 w-6 text-primary" aria-hidden />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <CardTitle id="trainer-dashboard-cta-heading" className="text-lg font-bold tracking-tight">
                        {t("trainerDashboard.instructorCardTitle")}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {t("trainerDashboard.instructorCardDescription")}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button asChild className="gap-2">
                      <Link to="/dashboard/trainer">
                        {t("trainerDashboard.instructorCardCta")}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </section>
            ) : null}

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
