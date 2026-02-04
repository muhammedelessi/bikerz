import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Shield, Lock, Eye, Database, UserCheck, Mail, Clock, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const PrivacyPolicy: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const { data: pageContent, isLoading } = useQuery({
    queryKey: ['privacy-page-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'privacy_page')
        .eq('category', 'landing')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.value || null;
    },
  });

  const defaultSections = [
    {
      icon: Database,
      title_en: 'Information We Collect',
      title_ar: 'المعلومات التي نجمعها',
      content_en: 'We collect information you provide directly to us, such as when you create an account, enroll in a course, or contact us for support. This includes your name, email address, phone number, and payment information.',
      content_ar: 'نجمع المعلومات التي تقدمها لنا مباشرة، مثل عندما تنشئ حساباً أو تسجل في دورة أو تتواصل معنا للحصول على الدعم. يشمل ذلك اسمك وبريدك الإلكتروني ورقم هاتفك ومعلومات الدفع.'
    },
    {
      icon: Eye,
      title_en: 'How We Use Your Information',
      title_ar: 'كيف نستخدم معلوماتك',
      content_en: 'We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, and respond to your comments and questions.',
      content_ar: 'نستخدم المعلومات التي نجمعها لتوفير خدماتنا وصيانتها وتحسينها ومعالجة المعاملات وإرسال الإشعارات التقنية ورسائل الدعم والرد على تعليقاتك وأسئلتك.'
    },
    {
      icon: Lock,
      title_en: 'Information Security',
      title_ar: 'أمان المعلومات',
      content_en: 'We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. Your data is encrypted and stored securely.',
      content_ar: 'نطبق إجراءات أمنية مناسبة لحماية معلوماتك الشخصية من الوصول غير المصرح به أو التعديل أو الإفصاح أو التدمير. يتم تشفير بياناتك وتخزينها بشكل آمن.'
    },
    {
      icon: UserCheck,
      title_en: 'Your Rights',
      title_ar: 'حقوقك',
      content_en: 'You have the right to access, update, or delete your personal information at any time. You can also opt out of receiving promotional communications from us.',
      content_ar: 'لديك الحق في الوصول إلى معلوماتك الشخصية أو تحديثها أو حذفها في أي وقت. يمكنك أيضاً إلغاء الاشتراك في تلقي الرسائل الترويجية منا.'
    },
    {
      icon: Mail,
      title_en: 'Third-Party Services',
      title_ar: 'خدمات الطرف الثالث',
      content_en: 'We may share your information with third-party service providers who perform services on our behalf, such as payment processing and email delivery. These providers are obligated to protect your information.',
      content_ar: 'قد نشارك معلوماتك مع مزودي خدمات الطرف الثالث الذين يقدمون خدمات نيابة عنا، مثل معالجة الدفع وتسليم البريد الإلكتروني. هؤلاء المزودون ملزمون بحماية معلوماتك.'
    },
    {
      icon: Clock,
      title_en: 'Data Retention',
      title_ar: 'الاحتفاظ بالبيانات',
      content_en: 'We retain your personal information for as long as necessary to fulfill the purposes for which it was collected, including to satisfy any legal, accounting, or reporting requirements.',
      content_ar: 'نحتفظ بمعلوماتك الشخصية طالما كان ذلك ضرورياً لتحقيق الأغراض التي جمعت من أجلها، بما في ذلك تلبية أي متطلبات قانونية أو محاسبية أو إعداد التقارير.'
    }
  ];

  const contentData = pageContent as { sections?: typeof defaultSections; last_updated?: string } | null;
  const sections = contentData?.sections || defaultSections;
  const lastUpdated = contentData?.last_updated || '2024-01-01';

  return (
    <div className={`min-h-screen bg-background ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      
      <main className="pt-24 pb-16">
        {/* Header */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                {t('legal.privacy.title')}
              </h1>
              <p className="text-lg text-muted-foreground">
                {t('legal.privacy.subtitle')}
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                {t('legal.lastUpdated')}: {lastUpdated}
              </p>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-48 mb-4" />
                      <Skeleton className="h-20 w-full" />
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
                          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <IconComponent className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h2 className="text-xl font-semibold text-foreground mb-3">
                              {isRTL ? section.title_ar : section.title_en}
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
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6 text-center">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t('legal.privacy.questions')}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {t('legal.privacy.contactUs')}
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

export default PrivacyPolicy;
