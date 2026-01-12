import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Star, Clock, Bike, Award, Users, MessageCircle } from 'lucide-react';
import instructorImage from '@/assets/instructor.jpg';

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
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

const Mentors: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMentors = async () => {
      const { data, error } = await supabase
        .from('mentors')
        .select(`
          *,
          profile:profiles!mentors_user_id_fkey(full_name, avatar_url)
        `)
        .eq('is_available', true);

      if (!error && data) {
        setMentors(data as unknown as Mentor[]);
      }
      setIsLoading(false);
    };

    fetchMentors();
  }, []);

  // Sample mentors for demo (will be replaced by real data)
  const sampleMentors: Mentor[] = [
    {
      id: '1',
      user_id: '1',
      experience_years: 12,
      motorbike_type: 'Sport Bike',
      motorbike_brand: 'Kawasaki Ninja ZX-10R',
      license_type: 'A',
      fees_per_hour: 150,
      bio: isRTL 
        ? 'مدرب محترف متخصص في الدراجات الرياضية مع خبرة تزيد عن 12 عاماً في تدريب الراكبين على مهارات القيادة المتقدمة والسلامة على الطرق.'
        : 'Professional instructor specializing in sport bikes with over 12 years of experience training riders on advanced riding skills and road safety.',
      specializations: isRTL 
        ? ['القيادة الرياضية', 'الانعطاف المتقدم', 'السلامة'] 
        : ['Sport Riding', 'Advanced Cornering', 'Safety'],
      is_available: true,
      rating: 4.9,
      total_students: 234,
      profile: {
        full_name: isRTL ? 'محمد الراشد' : 'Mohammed Al-Rashid',
        avatar_url: null,
      },
    },
    {
      id: '2',
      user_id: '2',
      experience_years: 8,
      motorbike_type: 'Adventure',
      motorbike_brand: 'BMW R 1250 GS',
      license_type: 'A',
      fees_per_hour: 180,
      bio: isRTL
        ? 'خبير في دراجات المغامرات والقيادة على الطرق الوعرة. قاد في أكثر من 15 دولة ومتخصص في رحلات الصحراء.'
        : 'Adventure bike expert and off-road riding specialist. Has ridden in 15+ countries and specializes in desert touring.',
      specializations: isRTL 
        ? ['قيادة المغامرات', 'الطرق الوعرة', 'رحلات الصحراء'] 
        : ['Adventure Riding', 'Off-Road', 'Desert Touring'],
      is_available: true,
      rating: 4.8,
      total_students: 156,
      profile: {
        full_name: isRTL ? 'خالد العتيبي' : 'Khalid Al-Otaibi',
        avatar_url: null,
      },
    },
    {
      id: '3',
      user_id: '3',
      experience_years: 15,
      motorbike_type: 'Cruiser',
      motorbike_brand: 'Harley-Davidson Road King',
      license_type: 'A',
      fees_per_hour: 120,
      bio: isRTL
        ? 'مدرب هارلي ديفيدسون معتمد مع شغف لتعليم الراكبين الجدد. متخصص في القيادة المريحة والرحلات الطويلة.'
        : 'Certified Harley-Davidson instructor with a passion for teaching new riders. Specializes in comfortable cruising and long-distance touring.',
      specializations: isRTL 
        ? ['دراجات الكروزر', 'الرحلات الطويلة', 'المبتدئين'] 
        : ['Cruiser Bikes', 'Long-Distance', 'Beginners'],
      is_available: true,
      rating: 4.7,
      total_students: 312,
      profile: {
        full_name: isRTL ? 'فهد السعيد' : 'Fahad Al-Saeed',
        avatar_url: null,
      },
    },
  ];

  const displayMentors = mentors.length > 0 ? mentors : sampleMentors;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24">
        {/* Header */}
        <section className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h1 className="section-title text-foreground mb-4">
              {isRTL ? 'المدربون الخبراء' : 'Expert Mentors'}
            </h1>
            <p className="section-subtitle">
              {isRTL 
                ? 'تعلم من مدربين محترفين معتمدين بخبرات متنوعة في مختلف أنواع الدراجات'
                : 'Learn from certified professional instructors with diverse expertise across all bike types'}
            </p>
          </motion.div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {displayMentors.map((mentor, index) => (
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
                      <div className="absolute top-4 end-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-sm">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-bold text-foreground">{mentor.rating || 0}</span>
                      </div>

                      {/* Name */}
                      <div className="absolute bottom-4 start-4 end-4">
                        <h3 className="text-xl font-bold text-foreground">
                          {mentor.profile?.full_name || (isRTL ? 'مدرب' : 'Mentor')}
                        </h3>
                        <p className="text-sm text-primary font-medium">
                          {mentor.experience_years} {isRTL ? 'سنوات خبرة' : 'years experience'}
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
                          <p className="text-muted-foreground text-xs">{mentor.motorbike_brand}</p>
                        </div>
                      </div>

                      {/* Bio */}
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {mentor.bio}
                      </p>

                      {/* Specializations */}
                      {mentor.specializations && (
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
                          <div className="flex items-center gap-1.5">
                            <Award className="w-4 h-4" />
                            <span>{mentor.license_type}</span>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className="text-lg font-bold text-primary">
                            {mentor.fees_per_hour} {isRTL ? 'ر.س' : 'SAR'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isRTL ? 'للساعة' : 'per hour'}
                          </p>
                        </div>
                      </div>

                      {/* CTA */}
                      <Button variant="cta" className="w-full group-hover:shadow-glow-lg">
                        <MessageCircle className="w-4 h-4" />
                        {isRTL ? 'تواصل مع المدرب' : 'Contact Mentor'}
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
