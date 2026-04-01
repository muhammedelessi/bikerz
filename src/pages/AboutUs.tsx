import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import * as LucideIcons from 'lucide-react';
import SEOHead from '@/components/common/SEOHead';
import {
  Target,
  Users,
  Shield,
  Award,
  MapPin,
  Phone,
  Mail,
  Clock
} from 'lucide-react';
import heroImage from '@/assets/community-ride.webp';

const AboutUs: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const { data: aboutData } = useQuery({
    queryKey: ['about-page-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'about_page')
        .eq('category', 'landing')
        .maybeSingle();

      if (error) throw error;
      return (data?.value as Record<string, string>) || {};
    },
  });

  const d = aboutData || {};

  const getIcon = (iconName: string, fallback: React.ElementType) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Icon = (LucideIcons as any)[iconName];
    return Icon || fallback;
  };

  const defaultIcons = [Shield, Users, Award, Target];
  const values = [0, 1, 2, 3].map((i) => ({
    icon: getIcon(d[`value${i}_icon`] || '', defaultIcons[i]),
    title: isRTL
      ? (d[`value${i}_title_ar`] || t(`aboutUs.values.${['safety', 'community', 'excellence', 'passion'][i]}.title`))
      : (d[`value${i}_title_en`] || t(`aboutUs.values.${['safety', 'community', 'excellence', 'passion'][i]}.title`)),
    description: isRTL
      ? (d[`value${i}_desc_ar`] || t(`aboutUs.values.${['safety', 'community', 'excellence', 'passion'][i]}.description`))
      : (d[`value${i}_desc_en`] || t(`aboutUs.values.${['safety', 'community', 'excellence', 'passion'][i]}.description`)),
  }));

  const contactInfo = [
    {
      icon: MapPin,
      label: t('aboutUs.contact.location'),
      value: isRTL ? (d.location_ar || t('footer.location')) : (d.location_en || t('footer.location')),
    },
    {
      icon: Phone,
      label: t('aboutUs.contact.phone'),
      value: d.phone || '+966 50 111 1111',
    },
    {
      icon: Mail,
      label: t('aboutUs.contact.email'),
      value: d.email || 'info@bikerz.sa',
    },
    {
      icon: Clock,
      label: t('aboutUs.contact.hours'),
      value: isRTL ? (d.hours_ar || t('aboutUs.contact.hoursValue')) : (d.hours_en || t('aboutUs.contact.hoursValue')),
    },
  ];

  const bgImage = d.hero_image || heroImage;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="About Us - Our Mission & Story"
        description="Learn about BIKERZ Academy's mission to make motorcycle riding safe and accessible. Meet our team of certified instructors and discover our training philosophy."
        canonical="/about"
        breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'About Us', url: '/about' }]}
      />
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-[var(--navbar-h)] pb-16 sm:pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <picture>
            <source srcSet={bgImage} type="image/webp" />
            <img
              src={bgImage}
              alt="Motorcycle riders"
              width={1920}
              height={1080}
              className="w-full h-full object-cover opacity-30"
              loading="eager"
              decoding="async"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        </div>

        <div className="relative section-container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground">
              {isRTL ? (d.title_ar || t('aboutUs.title')) : (d.title_en || t('aboutUs.title'))}
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
              {isRTL ? (d.subtitle_ar || t('aboutUs.subtitle')) : (d.subtitle_en || t('aboutUs.subtitle'))}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 sm:py-20 bg-card/30">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6 text-center">
              {isRTL ? (d.story_title_ar || t('aboutUs.story.title')) : (d.story_title_en || t('aboutUs.story.title'))}
            </h2>
            <div className="prose prose-lg dark:prose-invert mx-auto text-center">
              <p className="text-muted-foreground leading-relaxed">
                {isRTL ? (d.story_p1_ar || t('aboutUs.story.paragraph1')) : (d.story_p1_en || t('aboutUs.story.paragraph1'))}
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                {isRTL ? (d.story_p2_ar || t('aboutUs.story.paragraph2')) : (d.story_p2_en || t('aboutUs.story.paragraph2'))}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 sm:py-20">
        <div className="section-container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 30 : -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                {isRTL ? (d.mission_title_ar || t('aboutUs.mission.title')) : (d.mission_title_en || t('aboutUs.mission.title'))}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {isRTL ? (d.mission_desc_ar || t('aboutUs.mission.description')) : (d.mission_desc_en || t('aboutUs.mission.description'))}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: isRTL ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                {isRTL ? (d.vision_title_ar || t('aboutUs.vision.title')) : (d.vision_title_en || t('aboutUs.vision.title'))}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {isRTL ? (d.vision_desc_ar || t('aboutUs.vision.description')) : (d.vision_desc_en || t('aboutUs.vision.description'))}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 sm:py-20 bg-card/30">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              {isRTL ? (d.values_title_ar || t('aboutUs.values.title')) : (d.values_title_en || t('aboutUs.values.title'))}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {isRTL ? (d.values_subtitle_ar || t('aboutUs.values.subtitle')) : (d.values_subtitle_en || t('aboutUs.values.subtitle'))}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-card/50 backdrop-blur-sm border border-border/30 rounded-xl p-6 text-center hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  {value.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Info Section */}
      <section className="py-16 sm:py-20">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              {isRTL ? (d.contact_title_ar || t('aboutUs.contact.title')) : (d.contact_title_en || t('aboutUs.contact.title'))}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {isRTL ? (d.contact_subtitle_ar || t('aboutUs.contact.subtitle')) : (d.contact_subtitle_en || t('aboutUs.contact.subtitle'))}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {contactInfo.map((info, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <info.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  {info.label}
                </p>
                <p className="font-semibold text-foreground" style={{ unicodeBidi: 'plaintext' }}>
                  {info.value}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutUs;