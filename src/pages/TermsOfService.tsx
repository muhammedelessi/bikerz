import React from 'react';
import SEOHead from '@/components/common/SEOHead';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { FileText, Users, CreditCard, Ban, AlertTriangle, Scale, RefreshCw, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const TermsOfService: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const { data: pageContent, isLoading } = useQuery({
    queryKey: ['terms-page-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'terms_page')
        .eq('category', 'landing')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.value || null;
    },
  });

  const defaultSections = [
    {
      icon: Users,
      title_en: t('legal.terms.sections.registration.title'),
      title_ar: t('legal.terms.sections.registration.title'),
      content_en: t('legal.terms.sections.registration.content'),
      content_ar: t('legal.terms.sections.registration.content'),
    },
    {
      icon: CreditCard,
      title_en: t('legal.terms.sections.payments.title'),
      title_ar: t('legal.terms.sections.payments.title'),
      content_en: t('legal.terms.sections.payments.content'),
      content_ar: t('legal.terms.sections.payments.content'),
    },
    {
      icon: FileText,
      title_en: t('legal.terms.sections.intellectual.title'),
      title_ar: t('legal.terms.sections.intellectual.title'),
      content_en: t('legal.terms.sections.intellectual.content'),
      content_ar: t('legal.terms.sections.intellectual.content'),
    },
    {
      icon: Ban,
      title_en: t('legal.terms.sections.prohibited.title'),
      title_ar: t('legal.terms.sections.prohibited.title'),
      content_en: t('legal.terms.sections.prohibited.content'),
      content_ar: t('legal.terms.sections.prohibited.content'),
    },
    {
      icon: AlertTriangle,
      title_en: t('legal.terms.sections.disclaimer.title'),
      title_ar: t('legal.terms.sections.disclaimer.title'),
      content_en: t('legal.terms.sections.disclaimer.content'),
      content_ar: t('legal.terms.sections.disclaimer.content'),
    },
    {
      icon: Scale,
      title_en: t('legal.terms.sections.governing.title'),
      title_ar: t('legal.terms.sections.governing.title'),
      content_en: t('legal.terms.sections.governing.content'),
      content_ar: t('legal.terms.sections.governing.content'),
    },
    {
      icon: RefreshCw,
      title_en: t('legal.terms.sections.changes.title'),
      title_ar: t('legal.terms.sections.changes.title'),
      content_en: t('legal.terms.sections.changes.content'),
      content_ar: t('legal.terms.sections.changes.content'),
    }
  ];

  const contentData = pageContent as { sections?: typeof defaultSections; last_updated?: string } | null;
  const sections = contentData?.sections || defaultSections;
  const lastUpdated = contentData?.last_updated || '2024-01-01';

  return (
    <div className={`min-h-screen bg-background ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <SEOHead title="Terms of Service" description="Read BIKERZ Academy's terms of service. Understand the rules and guidelines governing your use of our motorcycle riding platform." canonical="/terms" breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'Terms of Service', url: '/terms' }]} />
      <Navbar />
      
      <main className="pt-[var(--navbar-h)] pb-16">
        {/* Header */}
        <section className="bg-gradient-to-br from-secondary/10 via-background to-primary/10 py-16 sm:py-20">
          <div className="page-container">
            <div className="max-w-3xl mx-auto text-center">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Scale className="w-8 h-8 text-secondary-foreground" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                {t('legal.terms.title')}
              </h1>
              <p className="text-lg text-muted-foreground">
                {t('legal.terms.subtitle')}
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                {t('legal.lastUpdated')}: {lastUpdated}
              </p>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-16 sm:py-20">
          <div className="page-container">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Introduction */}
              <Card className="bg-muted/30">
                <CardContent className="p-6">
                  <p className="text-muted-foreground leading-relaxed">
                    {t('legal.terms.welcome')}
                  </p>
                </CardContent>
              </Card>

              {isLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-48 mb-4" />
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                sections.map((section: { icon?: React.ElementType; title_en: string; title_ar: string; content_en: string; content_ar: string }, index: number) => {
                  const IconComponent = section.icon || FileText;
                  return (
                    <Card key={index} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <IconComponent className="w-6 h-6 text-secondary-foreground" />
                          </div>
                          <div className="flex-1">
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                              {index + 1}. {isRTL ? section.title_ar : section.title_en}
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                              {isRTL ? section.content_ar : section.content_en}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}

              {/* Contact Section */}
              <Card className="bg-secondary/5 border-secondary/20">
                <CardContent className="p-6 text-center">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t('legal.terms.questions')}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {t('legal.terms.contactUs')}
                  </p>
                  <a 
                    href="/contact" 
                    className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                  >
                    <Mail className="w-4 h-4" />
                    {t('footer.contact')}
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfService;
