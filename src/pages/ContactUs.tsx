import React, { useState } from 'react';
import SEOHead from '@/components/common/SEOHead';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FormField } from '@/components/ui/form-field';
import {
  Mail, Phone, MapPin, Clock, MessageSquare, Send,
  Loader2, CheckCircle, HelpCircle, CreditCard, BookOpen, User, RefreshCw, Award, MoreHorizontal
} from 'lucide-react';
import { useGHLFormWebhook } from '@/hooks/useGHLFormWebhook';
import { resolveCountryEnglish, resolveCityEnglish, getUserCourseStatuses } from '@/services/ghl.service';

const ContactUs: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { sendFormData } = useGHLFormWebhook();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'other' as 'technical' | 'billing' | 'course_content' | 'account' | 'refund' | 'other',
    subject: '',
    message: ''
  });
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');

  const categories = [
    { value: 'technical', icon: HelpCircle, label_en: 'Technical Issue', label_ar: 'مشكلة تقنية' },
    { value: 'billing', icon: CreditCard, label_en: 'Billing & Payments', label_ar: 'الفواتير والمدفوعات' },
    { value: 'course_content', icon: BookOpen, label_en: 'Course Content', label_ar: 'محتوى الدورة' },
    { value: 'account', icon: User, label_en: 'Account Issues', label_ar: 'مشاكل الحساب' },
    { value: 'refund', icon: RefreshCw, label_en: 'Refund Request', label_ar: 'طلب استرداد' },
    { value: 'other', icon: MoreHorizontal, label_en: 'Other', label_ar: 'أخرى' }
  ];

  const submitTicketMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error(t('contact.loginToSubmit'));
      }

      const ticketNum = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          ticket_number: ticketNum,
          category: formData.category,
          subject: formData.subject,
          description: formData.message,
          priority: 'medium',
          status: 'open'
        })
        .select('ticket_number')
        .single();

      if (error) throw error;
      return data.ticket_number;
    },
    onSuccess: (ticketNum) => {
      setTicketNumber(ticketNum);
      setIsSubmitted(true);
      toast.success(t('contact.requestSubmitted'));

      // Send to GHL form webhook (fire-and-forget)
      const countryEn = resolveCountryEnglish(user?.user_metadata?.country || '');
      const cityEn = resolveCityEnglish(countryEn, user?.user_metadata?.city || '');

      // Fetch course statuses async, then send webhook
      (async () => {
        let coursesJson = '[]';
        let totalPurchased = 0;
        try {
          if (user?.id) {
            const statuses = await getUserCourseStatuses(user.id);
            coursesJson = statuses.coursesJson;
            totalPurchased = statuses.totalPurchased;
          }
        } catch {}

        sendFormData({
          full_name: formData.name || user?.user_metadata?.full_name || '',
          email: formData.email || user?.email || '',
          phone: user?.user_metadata?.phone || '',
          country: countryEn,
          city: cityEn,
          address: [cityEn, countryEn].filter(Boolean).join(', '),
          courseName: isRTL ? 'تواصل معنا / دعم' : 'Contact / support',
          amount: '',
          currency: '',
          orderStatus: totalPurchased > 0 ? 'purchased' : 'not purchased',
          courses: coursesJson,
          totalPurchased,
          dateOfBirth: user?.user_metadata?.date_of_birth || '',
          gender: user?.user_metadata?.gender || '',
          ticket_subject: formData.subject,
          ticket_message: formData.message,
          ticket_category: formData.category,
          isRTL,
        });
      })();
    },
    onError: () => {
      toast.error(t('contact.failedToSubmit'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error(t('contact.loginToSubmit'));
      navigate('/login');
      return;
    }

    const nextErrors: typeof fieldErrors = {};
    if (!formData.subject.trim()) {
      nextErrors.subject = t('contact.form.errors.subjectRequired');
    }
    if (!formData.message.trim()) {
      nextErrors.message = t('contact.form.errors.messageRequired');
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    submitTicketMutation.mutate();
  };

  const contactInfo = [
    {
      icon: MapPin,
      title_en: 'Our Location',
      title_ar: 'موقعنا',
      value_en: 'Jeddah, Saudi Arabia',
      value_ar: 'جدة، المملكة العربية السعودية'
    },
    {
      icon: Phone,
      title_en: 'Phone',
      title_ar: 'الهاتف',
      value_en: '+966 56 256 2368',
      value_ar: '+966 56 256 2368'
    },
    {
      icon: Mail,
      title_en: 'Email',
      title_ar: 'البريد الإلكتروني',
      value_en: 'info@bikerz.com',
      value_ar: 'info@bikerz.com'
    },
    {
      icon: Clock,
      title_en: 'Working Hours',
      title_ar: 'ساعات العمل',
      value_en: 'Sun - Thu: 9AM - 6PM',
      value_ar: 'الأحد - الخميس: 9 صباحاً - 6 مساءً'
    }
  ];

  if (isSubmitted) {
    return (
      <div className={`min-h-screen bg-background ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <SEOHead title="Contact Us" description="Get in touch with BIKERZ Academy. We're here to help with course inquiries, technical support, and partnership opportunities." canonical="/contact" breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'Contact', url: '/contact' }]} />
        <Navbar />
        <main className="pt-[var(--navbar-h)] pb-16">
          <div className="page-container">
            <div className="max-w-lg mx-auto">
              <Card className="text-center">
                <CardContent className="pt-12 pb-8">
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    {t('contact.success.title')}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {t('contact.success.description')}
                  </p>
                  <div className="bg-muted/50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-muted-foreground mb-1">
                      {t('contact.success.ticketNumber')}
                    </p>
                    <p className="text-xl font-mono font-bold text-primary">
                      {ticketNumber}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">
                    {t('contact.success.checkDashboard')}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => navigate('/dashboard')}>
                      {t('nav.dashboard')}
                    </Button>
                    <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                      {t('contact.success.submitAnother')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <SEOHead title="Contact Us" description="Get in touch with BIKERZ Academy. We're here to help with course inquiries, technical support, and partnership opportunities." canonical="/contact" breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'Contact', url: '/contact' }]} />
      <Navbar />

      <main className="pt-[var(--navbar-h)] pb-16">
        {/* Header */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-16 sm:py-20">
          <div className="page-container">
            <div className="max-w-3xl mx-auto text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                {t('contact.title')}
              </h1>
              <p className="text-lg text-muted-foreground">
                {t('contact.subtitle')}
              </p>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-16 sm:py-20">
          <div className="page-container">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Contact Info */}
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    {t('contact.info.title')}
                  </h2>
                  {contactInfo.map((info, index) => (
                    <Card key={index} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <info.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">
                            {isRTL ? info.title_ar : info.title_en}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isRTL ? info.value_ar : info.value_en}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                </div>

                {/* Contact Form */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Send className="w-5 h-5" />
                        {t('contact.form.title')}
                      </CardTitle>
                      <CardDescription>
                        {user
                          ? t('contact.form.loggedInDescription')
                          : t('contact.form.guestDescription')
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form noValidate onSubmit={handleSubmit} className="space-y-6">
                        {!user && (
                          <div className="grid md:grid-cols-2 gap-4">
                            <FormField label={t('fields.fullName.label')} error={fieldErrors.name}>
                              <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => {
                                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                                  setFormData({ ...formData, name: e.target.value });
                                }}
                                placeholder={t('fields.fullName.placeholder')}
                              />
                            </FormField>
                            <FormField label={t('fields.email.label')} error={fieldErrors.email}>
                              <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => {
                                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                                  setFormData({ ...formData, email: e.target.value });
                                }}
                                placeholder={t('fields.email.placeholder')}
                              />
                            </FormField>
                          </div>
                        )}

                        <FormField label={t('contact.form.category')}>
                          <Select
                            value={formData.category}
                            onValueChange={(value: typeof formData.category) => setFormData({ ...formData, category: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('contact.form.categoryPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  <div className="flex items-center gap-2">
                                    <cat.icon className="w-4 h-4" />
                                    {isRTL ? cat.label_ar : cat.label_en}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormField>

                        <FormField label={t('contact.form.subject')} required error={fieldErrors.subject}>
                          <Input
                            id="subject"
                            value={formData.subject}
                            onChange={(e) => {
                              setFieldErrors((prev) => ({ ...prev, subject: undefined }));
                              setFormData({ ...formData, subject: e.target.value });
                            }}
                            placeholder={t('contact.form.subjectPlaceholder')}
                            className={fieldErrors.subject ? 'border-destructive' : undefined}
                          />
                        </FormField>

                        <FormField label={t('contact.form.message')} required error={fieldErrors.message}>
                          <Textarea
                            id="message"
                            value={formData.message}
                            onChange={(e) => {
                              setFieldErrors((prev) => ({ ...prev, message: undefined }));
                              setFormData({ ...formData, message: e.target.value });
                            }}
                            placeholder={t('contact.form.messagePlaceholder')}
                            rows={6}
                            className={fieldErrors.message ? 'border-destructive' : undefined}
                          />
                        </FormField>

                        {!user && (
                          <div className="bg-muted border border-border rounded-lg p-4">
                            <p className="text-sm text-muted-foreground">
                              {t('contact.form.loginRequired')}
                            </p>
                            <Button
                              type="button"
                              variant="link"
                              className="p-0 h-auto text-primary"
                              onClick={() => navigate('/login')}
                            >
                              {t('nav.login')}
                            </Button>
                          </div>
                        )}

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={submitTicketMutation.isPending || !user}
                        >
                          {submitTicketMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 me-2 animate-spin" />
                              {t('common.loading')}
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 me-2" />
                              {t('contact.form.submit')}
                            </>
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ContactUs;
