import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Star, Bike, Award, Users, MessageCircle, UserX } from 'lucide-react';
import instructorImage from '@/assets/instructor.jpg';
import SEOHead from '@/components/common/SEOHead';

interface Mentor {
  id: string;
  user_id: string;
  experience_years: number;
  motorbike_type: string;
  motorbike_brand: string | null;
  license_type: string | null;
  fees_per_hour: number;
  bio: string | null;
  specializations: string[] | null;
  is_available: boolean;
  rating: number | null;
  total_students: number | null;
}

interface MentorWithProfile extends Mentor {
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

const Mentors: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const { data: mentors = [], isLoading, error } = useQuery({
    queryKey: ['mentors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mentors')
        .select('*')
        .eq('is_available', true)
        .order('rating', { ascending: false });

      if (error) throw error;

      // Fetch profiles for each mentor
      const mentorsWithProfiles = await Promise.all(
        (data || []).map(async (mentor) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('user_id', mentor.user_id)
            .maybeSingle();

          return {
            ...mentor,
            profile,
          } as MentorWithProfile;
        })
      );

      return mentorsWithProfiles;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Expert Motorcycle Riding Mentors"
        description="Meet our certified motorcycle riding mentors. Experienced instructors ready to guide you from beginner to confident rider."
        canonical="/mentors"
        breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'Mentors', url: '/mentors' }]}
      />
      <Navbar />
      
      <main className="pt-[var(--navbar-h)]">
        {/* Header */}
        <section className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h1 className="section-title text-foreground mb-4">
              {t('mentors.title')}
            </h1>
            <p className="section-subtitle">
              {t('mentors.subtitle')}
            </p>
          </motion.div>

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card-premium overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <p className="text-destructive">
                {t('mentors.loadingError')}
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && mentors.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                <UserX className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {t('mentors.noMentors')}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t('mentors.noMentorsDescription')}
              </p>
            </div>
          )}

          {/* Mentors Grid */}
          {!isLoading && !error && mentors.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mentors.map((mentor, index) => (
                <motion.div
                  key={mentor.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group"
                >
                  <div className="card-premium overflow-hidden transition-all duration-500 hover:border-primary/40">
                    {/* Header with Avatar */}
                    <div className="relative h-48 bg-gradient-to-br from-secondary to-secondary/60">
                      <img
                        src={mentor.profile?.avatar_url || instructorImage}
                        alt={mentor.profile?.full_name || 'Mentor'}
                        className="w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                      
                      {/* Rating Badge */}
                      {mentor.rating !== null && mentor.rating > 0 && (
                        <div className="absolute top-4 end-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-sm">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-bold text-foreground">{mentor.rating}</span>
                        </div>
                      )}

                      {/* Name */}
                      <div className="absolute bottom-4 start-4 end-4">
                        <h3 className="text-xl font-bold text-foreground">
                          {mentor.profile?.full_name || t('mentors.mentor')}
                        </h3>
                        <p className="text-sm text-primary font-medium">
                          {mentor.experience_years} {t('mentors.yearsExperience')}
                        </p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                      {/* Bike Info */}
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center">
                          <Bike className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{mentor.motorbike_type}</p>
                          {mentor.motorbike_brand && (
                            <p className="text-muted-foreground text-xs">{mentor.motorbike_brand}</p>
                          )}
                        </div>
                      </div>

                      {/* Bio */}
                      {mentor.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {mentor.bio}
                        </p>
                      )}

                      {/* Specializations */}
                      {mentor.specializations && mentor.specializations.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {mentor.specializations.slice(0, 3).map((spec, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 rounded-full bg-secondary/20 text-secondary-foreground text-xs font-medium"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Stats Row */}
                      <div className="flex items-center justify-between pt-4 border-t border-border/30">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            <span>{mentor.total_students || 0}</span>
                          </div>
                          {mentor.license_type && (
                            <div className="flex items-center gap-1.5">
                              <Award className="w-4 h-4" />
                              <span>{mentor.license_type}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-end">
                          <p className="text-lg font-bold text-primary">
                            {mentor.fees_per_hour} {t('common.sar')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('common.perHour')}
                          </p>
                        </div>
                      </div>

                      {/* CTA */}
                      <Button variant="cta" className="w-full group-hover:shadow-glow-lg">
                        <MessageCircle className="w-4 h-4" />
                        {t('mentors.contactMentor')}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Mentors;
