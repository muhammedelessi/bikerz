import React from 'react';
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
      title_en: 'Account Registration',
      title_ar: 'تسجيل الحساب',
      content_en: 'To access our courses, you must register for an account. You agree to provide accurate and complete information during registration and to keep your account information updated. You are responsible for maintaining the confidentiality of your account credentials.',
      content_ar: 'للوصول إلى دوراتنا، يجب عليك التسجيل للحصول على حساب. توافق على تقديم معلومات دقيقة وكاملة أثناء التسجيل والحفاظ على تحديث معلومات حسابك. أنت مسؤول عن الحفاظ على سرية بيانات اعتماد حسابك.'
    },
    {
      icon: CreditCard,
      title_en: 'Payments and Refunds',
      title_ar: 'المدفوعات والاسترداد',
      content_en: 'Course fees are clearly displayed at the time of purchase. Payment must be made in full before accessing paid content. Refund requests may be considered within 14 days of purchase if you have not completed more than 30% of the course content.',
      content_ar: 'يتم عرض رسوم الدورة بوضوح وقت الشراء. يجب دفع المبلغ كاملاً قبل الوصول إلى المحتوى المدفوع. يمكن النظر في طلبات الاسترداد خلال 14 يوماً من الشراء إذا لم تكن قد أكملت أكثر من 30% من محتوى الدورة.'
    },
    {
      icon: FileText,
      title_en: 'Intellectual Property',
      title_ar: 'الملكية الفكرية',
      content_en: 'All course content, including videos, text, images, and materials, is owned by BIKERZ or our content creators. You may not copy, distribute, modify, or create derivative works from our content without express written permission.',
      content_ar: 'جميع محتويات الدورة، بما في ذلك مقاطع الفيديو والنصوص والصور والمواد، مملوكة لـ BIKERZ أو منشئي المحتوى لدينا. لا يجوز لك نسخ أو توزيع أو تعديل أو إنشاء أعمال مشتقة من محتوانا دون إذن كتابي صريح.'
    },
    {
      icon: Ban,
      title_en: 'Prohibited Activities',
      title_ar: 'الأنشطة المحظورة',
      content_en: 'You agree not to: share your account with others, use automated tools to access our services, attempt to bypass our security measures, post harmful or offensive content, or use our platform for any illegal activities.',
      content_ar: 'توافق على عدم: مشاركة حسابك مع الآخرين، استخدام أدوات آلية للوصول إلى خدماتنا، محاولة تجاوز إجراءاتنا الأمنية، نشر محتوى ضار أو مسيء، أو استخدام منصتنا لأي أنشطة غير قانونية.'
    },
    {
      icon: AlertTriangle,
      title_en: 'Disclaimer',
      title_ar: 'إخلاء المسؤولية',
      content_en: 'Our courses provide educational content about motorcycle riding. We are not responsible for any injuries, accidents, or damages that may occur while riding. Always practice safety and follow local traffic laws.',
      content_ar: 'توفر دوراتنا محتوى تعليمياً حول ركوب الدراجات النارية. لسنا مسؤولين عن أي إصابات أو حوادث أو أضرار قد تحدث أثناء الركوب. مارس السلامة دائماً واتبع قوانين المرور المحلية.'
    },
    {
      icon: Scale,
      title_en: 'Governing Law',
      title_ar: 'القانون الحاكم',
      content_en: 'These terms are governed by the laws of the Kingdom of Saudi Arabia. Any disputes will be resolved through the appropriate courts in Jeddah, Saudi Arabia.',
      content_ar: 'تخضع هذه الشروط لقوانين المملكة العربية السعودية. سيتم حل أي نزاعات من خلال المحاكم المختصة في جدة، المملكة العربية السعودية.'
    },
    {
      icon: RefreshCw,
      title_en: 'Changes to Terms',
      title_ar: 'التغييرات على الشروط',
      content_en: 'We reserve the right to modify these terms at any time. We will notify you of significant changes via email or through our platform. Your continued use of our services after changes constitutes acceptance of the new terms.',
      content_ar: 'نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سنخطرك بالتغييرات المهمة عبر البريد الإلكتروني أو من خلال منصتنا. استمرارك في استخدام خدماتنا بعد التغييرات يعني قبولك للشروط الجديدة.'
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
        <section className="bg-gradient-to-br from-secondary/10 via-background to-primary/10 py-16">
          <div className="container mx-auto px-4">
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
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Introduction */}
              <Card className="bg-muted/30">
                <CardContent className="p-6">
                  <p className="text-muted-foreground leading-relaxed">
                    {isRTL 
                      ? 'مرحباً بك في بايكرز. باستخدام منصتنا، فإنك توافق على الالتزام بهذه الشروط والأحكام. يرجى قراءتها بعناية قبل استخدام خدماتنا.'
                      : 'Welcome to BIKERZ. By using our platform, you agree to be bound by these terms and conditions. Please read them carefully before using our services.'
                    }
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
