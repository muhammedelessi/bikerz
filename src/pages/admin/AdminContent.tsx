import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Save, Loader2, Eye, Home, Target, Route, BookOpen, Megaphone, Users,
  Settings2, Palette, LayoutGrid, Type, MousePointer,
  Sparkles, PanelLeftClose, PanelLeft, Menu, ExternalLink, Share2,
  FileText, Shield, Scale, MessageSquare, LogIn, UserPlus, ChevronDown
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import IconSelector from '@/components/admin/content/IconSelector';
import ImageUploader from '@/components/admin/content/ImageUploader';
import SortableList from '@/components/admin/content/SortableList';
import BilingualInput from '@/components/admin/content/BilingualInput';
import LivePreview from '@/components/admin/content/LivePreview';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContentValue = any;

interface ContentSection {
  key: string;
  value: ContentValue;
}

interface MenuItem {
  id: string;
  title_en: string;
  title_ar: string;
  link: string;
  is_visible: boolean;
  open_in_new_tab: boolean;
}

interface FeatureCard {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  icon: string;
}

interface JourneyStep {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  icon: string;
}

interface Skill {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  icon: string;
}

interface TrustBadge {
  text_en: string;
  text_ar: string;
  icon: string;
}

const AdminContent: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [editedContent, setEditedContent] = useState<Record<string, ContentValue>>({});
  const [activeSection, setActiveSection] = useState('header');
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: landingContent, isLoading } = useQuery({
    queryKey: ['admin-landing-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .eq('category', 'landing');

      if (error) throw error;
      return data as ContentSection[];
    },
  });

  useEffect(() => {
    if (landingContent) {
      const content: Record<string, ContentValue> = {};
      landingContent.forEach(item => {
        content[item.key] = item.value;
      });
      setEditedContent(content);
      setHasChanges(false);
    }
  }, [landingContent]);

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: ContentValue }) => {
      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          { key, value, category: 'landing', updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-landing-content'] });
      queryClient.invalidateQueries({ queryKey: ['landing-content'] });
      queryClient.invalidateQueries({ queryKey: ['header-content'] });
      queryClient.invalidateQueries({ queryKey: ['about-page-content'] });
      setHasChanges(false);
      toast.success(isRTL ? 'تم حفظ التغييرات' : 'Changes saved successfully');
    },
    onError: () => {
      toast.error(isRTL ? 'فشل في حفظ التغييرات' : 'Failed to save changes');
    },
  });

  const handleSave = (key: string) => {
    if (editedContent[key]) {
      updateMutation.mutate({ key, value: editedContent[key] });
    }
  };

  const handleSaveAll = async () => {
    const promises = Object.keys(editedContent).map(key =>
      updateMutation.mutateAsync({ key, value: editedContent[key] })
    );
    await Promise.all(promises);
  };

  const updateField = (section: string, field: string, value: string | boolean) => {
    setEditedContent(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
    setHasChanges(true);
  };

  const updateNestedField = (section: string, parentKey: string, field: string, value: string | boolean) => {
    setEditedContent(prev => {
      const sectionData = JSON.parse(JSON.stringify(prev[section] || {}));
      if (!sectionData[parentKey]) sectionData[parentKey] = {};
      sectionData[parentKey][field] = value;
      return { ...prev, [section]: sectionData };
    });
    setHasChanges(true);
  };

  const updateArrayItem = (section: string, arrayKey: string, index: number, field: string, value: string | boolean) => {
    setEditedContent(prev => {
      const sectionData = JSON.parse(JSON.stringify(prev[section] || {}));
      const array = sectionData[arrayKey] || [];
      if (array[index]) {
        array[index][field] = value;
      }
      sectionData[arrayKey] = array;
      return { ...prev, [section]: sectionData };
    });
    setHasChanges(true);
  };

  const updateArray = (section: string, arrayKey: string, newArray: ContentValue[]) => {
    setEditedContent(prev => ({
      ...prev,
      [section]: { ...prev[section], [arrayKey]: newArray }
    }));
    setHasChanges(true);
  };

  const addArrayItem = (section: string, arrayKey: string, template: ContentValue) => {
    setEditedContent(prev => {
      const sectionData = JSON.parse(JSON.stringify(prev[section] || {}));
      const array = sectionData[arrayKey] || [];
      array.push(template);
      sectionData[arrayKey] = array;
      return { ...prev, [section]: sectionData };
    });
    setHasChanges(true);
  };

  const removeArrayItem = (section: string, arrayKey: string, index: number) => {
    setEditedContent(prev => {
      const sectionData = JSON.parse(JSON.stringify(prev[section] || {}));
      const array = sectionData[arrayKey] || [];
      array.splice(index, 1);
      sectionData[arrayKey] = array;
      return { ...prev, [section]: sectionData };
    });
    setHasChanges(true);
  };

  const mainSections = [
    { key: 'header', icon: Menu, label: isRTL ? 'القائمة الرئيسية' : 'Header', desc: isRTL ? 'الشعار والتنقل' : 'Logo & navigation' },
    { key: 'hero', icon: Home, label: isRTL ? 'القسم الرئيسي' : 'Hero', desc: isRTL ? 'البانر والإحصائيات' : 'Main banner & stats' },
    { key: 'why', icon: Target, label: isRTL ? 'لماذا نحن' : 'Why Us', desc: isRTL ? 'المميزات والفوائد' : 'Features & benefits' },
    { key: 'journey', icon: Route, label: isRTL ? 'رحلة التعلم' : 'Journey', desc: isRTL ? 'خطوات المسار' : 'Learning path steps' },
    { key: 'learn', icon: BookOpen, label: isRTL ? 'ما ستتعلمه' : 'What You Learn', desc: isRTL ? 'المهارات والمحتوى' : 'Skills & content' },
    { key: 'cta', icon: Megaphone, label: isRTL ? 'دعوة للعمل' : 'Call to Action', desc: isRTL ? 'أزرار التحويل' : 'Conversion buttons' },
    { key: 'community', icon: Users, label: isRTL ? 'المجتمع' : 'Community', desc: isRTL ? 'قسم المجتمع' : 'Community section' },
    { key: 'footer', icon: Share2, label: isRTL ? 'التذييل والسوشيال' : 'Footer & Social', desc: isRTL ? 'الروابط والسوشيال' : 'Links & social media' },
  ];

  const pageSections = [
    { key: 'about_page', icon: Users, label: isRTL ? 'من نحن' : 'About Us', desc: isRTL ? 'صفحة التعريف' : 'Company info page' },
    { key: 'privacy_page', icon: Shield, label: isRTL ? 'سياسة الخصوصية' : 'Privacy Policy', desc: isRTL ? 'سياسة البيانات' : 'Data policy page' },
    { key: 'terms_page', icon: Scale, label: isRTL ? 'شروط الخدمة' : 'Terms of Service', desc: isRTL ? 'الشروط والأحكام' : 'Terms & conditions' },
    { key: 'contact_page', icon: MessageSquare, label: isRTL ? 'اتصل بنا' : 'Contact Us', desc: isRTL ? 'نموذج التواصل' : 'Contact form page' },
    { key: 'login_page', icon: LogIn, label: isRTL ? 'تسجيل الدخول' : 'Login Page', desc: isRTL ? 'صفحة الدخول' : 'Sign in page' },
    { key: 'signup_page', icon: UserPlus, label: isRTL ? 'إنشاء حساب' : 'Signup Page', desc: isRTL ? 'صفحة التسجيل' : 'Registration page' },
  ];

  const [pagesOpen, setPagesOpen] = useState(pageSections.some(p => p.key === activeSection));

  // ============= HEADER MENU EDITOR =============
  const renderHeaderSection = () => {
    const headerData = editedContent.header || {};
    const menuItems = headerData.menu_items || [];
    const ctaButton = headerData.cta_button || {};
    const loginButton = headerData.login_button || {};

    const menuItemTemplate = {
      id: `menu-${Date.now()}`,
      title_en: 'New Link',
      title_ar: 'رابط جديد',
      link: '/',
      is_visible: true,
      open_in_new_tab: false
    };

    return (
      <div className="space-y-8">
        {/* Logo Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'إعدادات الشعار' : 'Logo Settings'}</h3>
          </div>

          <ImageUploader
            value={headerData.logo_url || ''}
            onChange={(url) => updateField('header', 'logo_url', url)}
            label={isRTL ? 'شعار مخصص (اختياري)' : 'Custom Logo (optional)'}
          />

          <BilingualInput
            labelEn="Logo Alt Text"
            labelAr="نص بديل للشعار"
            valueEn={headerData.logo_alt_en || 'BIKERZ'}
            valueAr={headerData.logo_alt_ar || 'بايكرز'}
            onChangeEn={(v) => updateField('header', 'logo_alt_en', v)}
            onChangeAr={(v) => updateField('header', 'logo_alt_ar', v)}
          />

          <div className="flex items-center gap-2">
            <Switch
              checked={headerData.show_language_toggle !== false}
              onCheckedChange={(v) => updateField('header', 'show_language_toggle', v)}
            />
            <Label>{isRTL ? 'إظهار زر تغيير اللغة' : 'Show Language Toggle'}</Label>
          </div>
        </div>

        <Separator />

        {/* Menu Items */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Menu className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'روابط القائمة' : 'Menu Links'}</h3>
          </div>

          <SortableList<MenuItem>
            items={menuItems}
            onReorder={(newItems) => updateArray('header', 'menu_items', newItems)}
            onAdd={() => addArrayItem('header', 'menu_items', menuItemTemplate)}
            onRemove={(index) => removeArrayItem('header', 'menu_items', index)}
            addLabel={isRTL ? 'إضافة رابط جديد' : 'Add Menu Link'}
            minItems={1}
            maxItems={8}
            renderItem={(item: MenuItem, index: number) => (
              <div className="space-y-4">
                <BilingualInput
                  labelEn="Link Title"
                  labelAr="عنوان الرابط"
                  valueEn={item.title_en || ''}
                  valueAr={item.title_ar || ''}
                  onChangeEn={(v) => updateArrayItem('header', 'menu_items', index, 'title_en', v)}
                  onChangeAr={(v) => updateArrayItem('header', 'menu_items', index, 'title_ar', v)}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      {isRTL ? 'الرابط' : 'Link URL'}
                    </Label>
                    <Input
                      value={item.link || ''}
                      onChange={(e) => updateArrayItem('header', 'menu_items', index, 'link', e.target.value)}
                      placeholder="/courses"
                    />
                  </div>
                  <div className="space-y-4 pt-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.is_visible !== false}
                        onCheckedChange={(v) => updateArrayItem('header', 'menu_items', index, 'is_visible', v)}
                      />
                      <Label>{isRTL ? 'مرئي' : 'Visible'}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.open_in_new_tab === true}
                        onCheckedChange={(v) => updateArrayItem('header', 'menu_items', index, 'open_in_new_tab', v)}
                      />
                      <Label>{isRTL ? 'فتح في نافذة جديدة' : 'Open in new tab'}</Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          />
        </div>

        <Separator />

        {/* CTA Button */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <MousePointer className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'زر الدعوة للعمل (CTA)' : 'CTA Button'}</h3>
          </div>

          <BilingualInput
            labelEn="Button Text"
            labelAr="نص الزر"
            valueEn={ctaButton.text_en || 'Get Started'}
            valueAr={ctaButton.text_ar || 'ابدأ الآن'}
            onChangeEn={(v) => updateNestedField('header', 'cta_button', 'text_en', v)}
            onChangeAr={(v) => updateNestedField('header', 'cta_button', 'text_ar', v)}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{isRTL ? 'رابط الزر' : 'Button Link'}</Label>
              <Input
                value={ctaButton.link || '/signup'}
                onChange={(e) => updateNestedField('header', 'cta_button', 'link', e.target.value)}
                placeholder="/signup"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'نمط الزر' : 'Button Style'}</Label>
              <Input
                value={ctaButton.style || 'cta'}
                onChange={(e) => updateNestedField('header', 'cta_button', 'style', e.target.value)}
                placeholder="cta, primary, secondary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={ctaButton.is_visible !== false}
              onCheckedChange={(v) => updateNestedField('header', 'cta_button', 'is_visible', v)}
            />
            <Label>{isRTL ? 'إظهار الزر' : 'Show Button'}</Label>
          </div>
        </div>

        <Separator />

        {/* Login Button */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Type className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'زر تسجيل الدخول' : 'Login Button'}</h3>
          </div>

          <BilingualInput
            labelEn="Button Text"
            labelAr="نص الزر"
            valueEn={loginButton.text_en || 'Login'}
            valueAr={loginButton.text_ar || 'تسجيل الدخول'}
            onChangeEn={(v) => updateNestedField('header', 'login_button', 'text_en', v)}
            onChangeAr={(v) => updateNestedField('header', 'login_button', 'text_ar', v)}
          />

          <div className="space-y-2">
            <Label>{isRTL ? 'رابط الزر' : 'Button Link'}</Label>
            <Input
              value={loginButton.link || '/login'}
              onChange={(e) => updateNestedField('header', 'login_button', 'link', e.target.value)}
              placeholder="/login"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={loginButton.is_visible !== false}
              onCheckedChange={(v) => updateNestedField('header', 'login_button', 'is_visible', v)}
            />
            <Label>{isRTL ? 'إظهار الزر' : 'Show Button'}</Label>
          </div>
        </div>
      </div>
    );
  };

  // ============= HERO SECTION EDITOR =============
  const renderHeroSection = () => {
    const heroData = editedContent.hero || {};

    return (
      <div className="space-y-8">
        {/* Main Heading */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Type className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'النصوص الرئيسية' : 'Main Text'}</h3>
          </div>
          
          <BilingualInput
            labelEn="Main Title"
            labelAr="العنوان الرئيسي"
            valueEn={heroData.title_en || ''}
            valueAr={heroData.title_ar || ''}
            onChangeEn={(v) => updateField('hero', 'title_en', v)}
            onChangeAr={(v) => updateField('hero', 'title_ar', v)}
            placeholderEn="Master the Art of Riding"
            placeholderAr="أتقن فن القيادة"
          />

          <BilingualInput
            labelEn="Subtitle"
            labelAr="العنوان الفرعي"
            valueEn={heroData.subtitle_en || ''}
            valueAr={heroData.subtitle_ar || ''}
            onChangeEn={(v) => updateField('hero', 'subtitle_en', v)}
            onChangeAr={(v) => updateField('hero', 'subtitle_ar', v)}
            isTextarea
            rows={2}
            placeholderEn="Join thousands of riders on their journey..."
            placeholderAr="انضم إلى آلاف الراكبين في رحلتهم..."
          />
        </div>

        <Separator />

        {/* Buttons */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <MousePointer className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'الأزرار' : 'Buttons'}</h3>
          </div>

          <BilingualInput
            labelEn="Primary Button Text"
            labelAr="نص الزر الرئيسي"
            valueEn={heroData.cta_en || ''}
            valueAr={heroData.cta_ar || ''}
            onChangeEn={(v) => updateField('hero', 'cta_en', v)}
            onChangeAr={(v) => updateField('hero', 'cta_ar', v)}
            placeholderEn="Start Your Journey"
            placeholderAr="ابدأ رحلتك"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Primary Button Link</Label>
              <Input
                value={heroData.cta_link || '/signup'}
                onChange={(e) => updateField('hero', 'cta_link', e.target.value)}
                placeholder="/signup"
              />
            </div>
            <div className="space-y-2">
              <Label>Button Style</Label>
              <Input
                value={heroData.cta_style || 'hero'}
                onChange={(e) => updateField('hero', 'cta_style', e.target.value)}
                placeholder="hero"
              />
            </div>
          </div>

          <BilingualInput
            labelEn="Secondary Button Text"
            labelAr="نص الزر الثانوي"
            valueEn={heroData.secondary_cta_en || ''}
            valueAr={heroData.secondary_cta_ar || ''}
            onChangeEn={(v) => updateField('hero', 'secondary_cta_en', v)}
            onChangeAr={(v) => updateField('hero', 'secondary_cta_ar', v)}
            placeholderEn="Explore Courses"
            placeholderAr="استكشف الدورات"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Secondary Button Link</Label>
              <Input
                value={heroData.secondary_cta_link || '/courses'}
                onChange={(e) => updateField('hero', 'secondary_cta_link', e.target.value)}
                placeholder="/courses"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Badge */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'الشارة' : 'Badge'}</h3>
          </div>

          <BilingualInput
            labelEn="Badge Text"
            labelAr="نص الشارة"
            valueEn={heroData.badge_text_en || ''}
            valueAr={heroData.badge_text_ar || ''}
            onChangeEn={(v) => updateField('hero', 'badge_text_en', v)}
            onChangeAr={(v) => updateField('hero', 'badge_text_ar', v)}
            placeholderEn="GCC Riders"
            placeholderAr="راكب في الخليج"
          />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={heroData.show_badge !== false}
                onCheckedChange={(v) => updateField('hero', 'show_badge', v.toString())}
              />
              <Label>{isRTL ? 'إظهار الشارة' : 'Show Badge'}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={heroData.show_stats !== false}
                onCheckedChange={(v) => updateField('hero', 'show_stats', v.toString())}
              />
              <Label>{isRTL ? 'إظهار الإحصائيات' : 'Show Stats'}</Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* Stats Values & Labels */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'قيم وتسميات الإحصائيات' : 'Stats Values & Labels'}</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {isRTL ? 'أدخل القيم لعرضها. اتركها فارغة لاستخدام البيانات الحقيقية من قاعدة البيانات.' : 'Enter values to display. Leave empty to use real data from the database.'}
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{isRTL ? 'قيمة الأعضاء' : 'Members Value'}</Label>
              <Input
                value={heroData.stats_members_value || ''}
                onChange={(e) => updateField('hero', 'stats_members_value', e.target.value)}
                placeholder={isRTL ? 'مثال: 15K+' : 'e.g. 15K+'}
              />
              <Label>Members Label (EN)</Label>
              <Input
                value={heroData.stats_members_en || 'Members'}
                onChange={(e) => updateField('hero', 'stats_members_en', e.target.value)}
              />
              <Input
                value={heroData.stats_members_ar || 'عضو'}
                onChange={(e) => updateField('hero', 'stats_members_ar', e.target.value)}
                dir="rtl"
                className="mt-2"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'قيمة الدروس' : 'Lessons Value'}</Label>
              <Input
                value={heroData.stats_lessons_value || ''}
                onChange={(e) => updateField('hero', 'stats_lessons_value', e.target.value)}
                placeholder={isRTL ? 'مثال: 200+' : 'e.g. 200+'}
              />
              <Label>Lessons Label (EN)</Label>
              <Input
                value={heroData.stats_lessons_en || 'Lessons'}
                onChange={(e) => updateField('hero', 'stats_lessons_en', e.target.value)}
              />
              <Input
                value={heroData.stats_lessons_ar || 'درس'}
                onChange={(e) => updateField('hero', 'stats_lessons_ar', e.target.value)}
                dir="rtl"
                className="mt-2"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'قيمة النجاح' : 'Success Value'}</Label>
              <Input
                value={heroData.stats_success_value || ''}
                onChange={(e) => updateField('hero', 'stats_success_value', e.target.value)}
                placeholder={isRTL ? 'مثال: 95%' : 'e.g. 95%'}
              />
              <Label>Success Label (EN)</Label>
              <Input
                value={heroData.stats_success_en || 'Success'}
                onChange={(e) => updateField('hero', 'stats_success_en', e.target.value)}
              />
              <Input
                value={heroData.stats_success_ar || 'نجاح'}
                onChange={(e) => updateField('hero', 'stats_success_ar', e.target.value)}
                dir="rtl"
                className="mt-2"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Background Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'إعدادات الخلفية' : 'Background Settings'}</h3>
          </div>

          <ImageUploader
            value={heroData.background_image || ''}
            onChange={(url) => updateField('hero', 'background_image', url)}
            label={isRTL ? 'صورة الخلفية' : 'Background Image'}
            bucket="course-thumbnails"
            folder="landing"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Overlay Opacity (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={heroData.overlay_opacity || '70'}
                onChange={(e) => updateField('hero', 'overlay_opacity', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Gradient Direction</Label>
              <Input
                value={heroData.gradient_direction || 'to-b'}
                onChange={(e) => updateField('hero', 'gradient_direction', e.target.value)}
                placeholder="to-b, to-r, to-br"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Animation Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'إعدادات الحركة' : 'Animation Settings'}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={heroData.enable_animations !== false}
                onCheckedChange={(v) => updateField('hero', 'enable_animations', v.toString())}
              />
              <Label>{isRTL ? 'تفعيل الحركات' : 'Enable Animations'}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={heroData.show_scroll_indicator !== false}
                onCheckedChange={(v) => updateField('hero', 'show_scroll_indicator', v.toString())}
              />
              <Label>{isRTL ? 'مؤشر التمرير' : 'Scroll Indicator'}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={heroData.show_pattern !== false}
                onCheckedChange={(v) => updateField('hero', 'show_pattern', v.toString())}
              />
              <Label>{isRTL ? 'نمط الخلفية' : 'Background Pattern'}</Label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============= WHY SECTION EDITOR =============
  const renderWhySection = () => {
    const whyData = editedContent.why || {};
    const cards = whyData.cards || [];

    const cardTemplate = {
      title_en: 'New Feature',
      title_ar: 'ميزة جديدة',
      description_en: 'Description here',
      description_ar: 'الوصف هنا',
      icon: 'Shield',
    };

    return (
      <div className="space-y-8">
        {/* Section Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Type className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'رأس القسم' : 'Section Header'}</h3>
          </div>

          <BilingualInput
            labelEn="Section Title"
            labelAr="عنوان القسم"
            valueEn={whyData.title_en || ''}
            valueAr={whyData.title_ar || ''}
            onChangeEn={(v) => updateField('why', 'title_en', v)}
            onChangeAr={(v) => updateField('why', 'title_ar', v)}
          />

          <BilingualInput
            labelEn="Section Subtitle"
            labelAr="العنوان الفرعي"
            valueEn={whyData.subtitle_en || ''}
            valueAr={whyData.subtitle_ar || ''}
            onChangeEn={(v) => updateField('why', 'subtitle_en', v)}
            onChangeAr={(v) => updateField('why', 'subtitle_ar', v)}
            isTextarea
            rows={2}
          />
        </div>

        <Separator />

        {/* Layout Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'إعدادات التخطيط' : 'Layout Settings'}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Desktop Columns</Label>
              <Input
                type="number"
                min="2"
                max="4"
                value={whyData.columns_desktop || '3'}
                onChange={(e) => updateField('why', 'columns_desktop', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tablet Columns</Label>
              <Input
                type="number"
                min="1"
                max="3"
                value={whyData.columns_tablet || '2'}
                onChange={(e) => updateField('why', 'columns_tablet', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile Columns</Label>
              <Input
                type="number"
                min="1"
                max="2"
                value={whyData.columns_mobile || '1'}
                onChange={(e) => updateField('why', 'columns_mobile', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Feature Cards */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'بطاقات المميزات' : 'Feature Cards'}</h3>
          </div>

          <SortableList<FeatureCard>
            items={cards}
            onReorder={(newItems) => updateArray('why', 'cards', newItems)}
            onAdd={() => addArrayItem('why', 'cards', cardTemplate)}
            onRemove={(index) => removeArrayItem('why', 'cards', index)}
            addLabel={isRTL ? 'إضافة بطاقة' : 'Add Card'}
            minItems={1}
            maxItems={6}
            renderItem={(item: FeatureCard, index: number) => (
              <div className="space-y-4">
                <IconSelector
                  value={item.icon || 'Shield'}
                  onChange={(icon) => updateArrayItem('why', 'cards', index, 'icon', icon)}
                  label={isRTL ? 'الأيقونة' : 'Icon'}
                />
                
                <BilingualInput
                  labelEn="Title"
                  labelAr="العنوان"
                  valueEn={item.title_en || ''}
                  valueAr={item.title_ar || ''}
                  onChangeEn={(v) => updateArrayItem('why', 'cards', index, 'title_en', v)}
                  onChangeAr={(v) => updateArrayItem('why', 'cards', index, 'title_ar', v)}
                />

                <BilingualInput
                  labelEn="Description"
                  labelAr="الوصف"
                  valueEn={item.description_en || ''}
                  valueAr={item.description_ar || ''}
                  onChangeEn={(v) => updateArrayItem('why', 'cards', index, 'description_en', v)}
                  onChangeAr={(v) => updateArrayItem('why', 'cards', index, 'description_ar', v)}
                  isTextarea
                  rows={2}
                />
              </div>
            )}
          />
        </div>
      </div>
    );
  };

  // ============= JOURNEY SECTION EDITOR =============
  const renderJourneySection = () => {
    const journeyData = editedContent.journey || {};
    const steps = journeyData.steps || [];

    const stepTemplate = {
      number: `Step ${steps.length + 1}`,
      title_en: 'New Step',
      title_ar: 'خطوة جديدة',
      description_en: 'Step description',
      description_ar: 'وصف الخطوة',
      icon: 'BookOpen',
    };

    return (
      <div className="space-y-8">
        {/* Section Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Type className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'رأس القسم' : 'Section Header'}</h3>
          </div>

          <BilingualInput
            labelEn="Section Title"
            labelAr="عنوان القسم"
            valueEn={journeyData.title_en || ''}
            valueAr={journeyData.title_ar || ''}
            onChangeEn={(v) => updateField('journey', 'title_en', v)}
            onChangeAr={(v) => updateField('journey', 'title_ar', v)}
          />

          <BilingualInput
            labelEn="Section Subtitle"
            labelAr="العنوان الفرعي"
            valueEn={journeyData.subtitle_en || ''}
            valueAr={journeyData.subtitle_ar || ''}
            onChangeEn={(v) => updateField('journey', 'subtitle_en', v)}
            onChangeAr={(v) => updateField('journey', 'subtitle_ar', v)}
            isTextarea
            rows={2}
          />
        </div>

        <Separator />

        {/* Journey Steps */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Route className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'خطوات الرحلة' : 'Journey Steps'}</h3>
          </div>

          <SortableList<JourneyStep>
            items={steps}
            onReorder={(newItems) => updateArray('journey', 'steps', newItems)}
            onAdd={() => addArrayItem('journey', 'steps', stepTemplate)}
            onRemove={(index) => removeArrayItem('journey', 'steps', index)}
            addLabel={isRTL ? 'إضافة خطوة' : 'Add Step'}
            minItems={1}
            maxItems={20}
            renderItem={(item: JourneyStep & { number?: string }, index: number) => (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'رقم الخطوة' : 'Step Label'}</Label>
                  <Input
                    value={item.number || `Step ${index + 1}`}
                    onChange={(e) => updateArrayItem('journey', 'steps', index, 'number', e.target.value)}
                    placeholder="e.g. Step 1, Level 1"
                  />
                </div>

                <IconSelector
                  value={item.icon || 'BookOpen'}
                  onChange={(icon) => updateArrayItem('journey', 'steps', index, 'icon', icon)}
                  label={isRTL ? 'الأيقونة' : 'Icon'}
                />
                
                <BilingualInput
                  labelEn="Step Title"
                  labelAr="عنوان الخطوة"
                  valueEn={item.title_en || ''}
                  valueAr={item.title_ar || ''}
                  onChangeEn={(v) => updateArrayItem('journey', 'steps', index, 'title_en', v)}
                  onChangeAr={(v) => updateArrayItem('journey', 'steps', index, 'title_ar', v)}
                />

                <BilingualInput
                  labelEn="Step Description"
                  labelAr="وصف الخطوة"
                  valueEn={item.description_en || ''}
                  valueAr={item.description_ar || ''}
                  onChangeEn={(v) => updateArrayItem('journey', 'steps', index, 'description_en', v)}
                  onChangeAr={(v) => updateArrayItem('journey', 'steps', index, 'description_ar', v)}
                  isTextarea
                  rows={2}
                />
              </div>
            )}
          />
        </div>
      </div>
    );
  };

  // ============= LEARN SECTION EDITOR =============
  const renderLearnSection = () => {
    const learnData = editedContent.learn || {};
    const skills = learnData.skills || [];

    const skillTemplate = {
      text_en: 'New Skill',
      text_ar: 'مهارة جديدة',
      title_en: 'New Skill',
      title_ar: 'مهارة جديدة',
      description_en: 'Skill description',
      description_ar: 'وصف المهارة',
      icon: 'Zap',
      key: `skill-${Date.now()}`,
    };

    return (
      <div className="space-y-8">
        {/* Section Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Type className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'رأس القسم' : 'Section Header'}</h3>
          </div>

          <BilingualInput
            labelEn="Section Title"
            labelAr="عنوان القسم"
            valueEn={learnData.title_en || ''}
            valueAr={learnData.title_ar || ''}
            onChangeEn={(v) => updateField('learn', 'title_en', v)}
            onChangeAr={(v) => updateField('learn', 'title_ar', v)}
          />

          <BilingualInput
            labelEn="Section Subtitle"
            labelAr="العنوان الفرعي"
            valueEn={learnData.subtitle_en || ''}
            valueAr={learnData.subtitle_ar || ''}
            onChangeEn={(v) => updateField('learn', 'subtitle_en', v)}
            onChangeAr={(v) => updateField('learn', 'subtitle_ar', v)}
            isTextarea
            rows={2}
          />
        </div>

        <Separator />

        {/* Layout Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'إعدادات التخطيط' : 'Layout Settings'}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Desktop Columns</Label>
              <Input
                type="number"
                min="2"
                max="4"
                value={learnData.columns_desktop || '3'}
                onChange={(e) => updateField('learn', 'columns_desktop', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tablet Columns</Label>
              <Input
                type="number"
                min="1"
                max="3"
                value={learnData.columns_tablet || '2'}
                onChange={(e) => updateField('learn', 'columns_tablet', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile Columns</Label>
              <Input
                type="number"
                min="1"
                max="2"
                value={learnData.columns_mobile || '1'}
                onChange={(e) => updateField('learn', 'columns_mobile', e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Skills */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'المهارات' : 'Skills'}</h3>
          </div>

          <SortableList<Skill>
            items={skills}
            onReorder={(newItems) => updateArray('learn', 'skills', newItems)}
            onAdd={() => addArrayItem('learn', 'skills', skillTemplate)}
            onRemove={(index) => removeArrayItem('learn', 'skills', index)}
            addLabel={isRTL ? 'إضافة مهارة' : 'Add Skill'}
            minItems={1}
            maxItems={9}
            renderItem={(item: Skill, index: number) => (
              <div className="space-y-4">
                <IconSelector
                  value={item.icon || 'Zap'}
                  onChange={(icon) => updateArrayItem('learn', 'skills', index, 'icon', icon)}
                  label={isRTL ? 'الأيقونة' : 'Icon'}
                />
                
                <BilingualInput
                  labelEn="Card Label (shown on landing page)"
                  labelAr="نص البطاقة (يظهر في الصفحة الرئيسية)"
                  valueEn={(item as unknown as Record<string, string>).text_en || ''}
                  valueAr={(item as unknown as Record<string, string>).text_ar || ''}
                  onChangeEn={(v) => updateArrayItem('learn', 'skills', index, 'text_en', v)}
                  onChangeAr={(v) => updateArrayItem('learn', 'skills', index, 'text_ar', v)}
                />

                <BilingualInput
                  labelEn="Skill Title"
                  labelAr="عنوان المهارة"
                  valueEn={item.title_en || ''}
                  valueAr={item.title_ar || ''}
                  onChangeEn={(v) => updateArrayItem('learn', 'skills', index, 'title_en', v)}
                  onChangeAr={(v) => updateArrayItem('learn', 'skills', index, 'title_ar', v)}
                />

                <BilingualInput
                  labelEn="Skill Description"
                  labelAr="وصف المهارة"
                  valueEn={item.description_en || ''}
                  valueAr={item.description_ar || ''}
                  onChangeEn={(v) => updateArrayItem('learn', 'skills', index, 'description_en', v)}
                  onChangeAr={(v) => updateArrayItem('learn', 'skills', index, 'description_ar', v)}
                  isTextarea
                  rows={2}
                />
              </div>
            )}
          />
        </div>
      </div>
    );
  };

  // ============= CTA SECTION EDITOR =============
  const renderCTASection = () => {
    const ctaData = editedContent.cta || {};

    return (
      <div className="space-y-8">
        {/* Main Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Type className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'المحتوى الرئيسي' : 'Main Content'}</h3>
          </div>

          <BilingualInput
            labelEn="Section Title"
            labelAr="عنوان القسم"
            valueEn={ctaData.title_en || ''}
            valueAr={ctaData.title_ar || ''}
            onChangeEn={(v) => updateField('cta', 'title_en', v)}
            onChangeAr={(v) => updateField('cta', 'title_ar', v)}
          />

          <BilingualInput
            labelEn="Section Subtitle"
            labelAr="العنوان الفرعي"
            valueEn={ctaData.subtitle_en || ''}
            valueAr={ctaData.subtitle_ar || ''}
            onChangeEn={(v) => updateField('cta', 'subtitle_en', v)}
            onChangeAr={(v) => updateField('cta', 'subtitle_ar', v)}
            isTextarea
            rows={2}
          />
        </div>

        <Separator />

        {/* Button */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <MousePointer className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'الزر' : 'Button'}</h3>
          </div>

          <BilingualInput
            labelEn="Button Text"
            labelAr="نص الزر"
            valueEn={ctaData.button_en || ''}
            valueAr={ctaData.button_ar || ''}
            onChangeEn={(v) => updateField('cta', 'button_en', v)}
            onChangeAr={(v) => updateField('cta', 'button_ar', v)}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Button Link</Label>
              <Input
                value={ctaData.button_link || '/signup'}
                onChange={(e) => updateField('cta', 'button_link', e.target.value)}
                placeholder="/signup"
              />
            </div>
            <div className="space-y-2">
              <Label>Button Style</Label>
              <Input
                value={ctaData.button_style || 'cta'}
                onChange={(e) => updateField('cta', 'button_style', e.target.value)}
                placeholder="cta, primary, secondary"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Background */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'إعدادات الخلفية' : 'Background Settings'}</h3>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={ctaData.show_glow !== false}
              onCheckedChange={(v) => updateField('cta', 'show_glow', v.toString())}
            />
            <Label>{isRTL ? 'تأثير التوهج' : 'Glow Effect'}</Label>
          </div>
        </div>
      </div>
    );
  };

  // ============= COMMUNITY SECTION EDITOR =============
  const renderCommunitySection = () => {
    const communityData = editedContent.community || {};
    const badges = communityData.trust_badges || [];

    const badgeTemplate = {
      text_en: 'New Badge',
      text_ar: 'شارة جديدة',
      icon: 'Star',
    };

    return (
      <div className="space-y-8">
        {/* Main Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Type className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'المحتوى الرئيسي' : 'Main Content'}</h3>
          </div>

          <BilingualInput
            labelEn="Section Title"
            labelAr="عنوان القسم"
            valueEn={communityData.title_en || ''}
            valueAr={communityData.title_ar || ''}
            onChangeEn={(v) => updateField('community', 'title_en', v)}
            onChangeAr={(v) => updateField('community', 'title_ar', v)}
          />

          <BilingualInput
            labelEn="Section Subtitle"
            labelAr="العنوان الفرعي"
            valueEn={communityData.subtitle_en || ''}
            valueAr={communityData.subtitle_ar || ''}
            onChangeEn={(v) => updateField('community', 'subtitle_en', v)}
            onChangeAr={(v) => updateField('community', 'subtitle_ar', v)}
            isTextarea
            rows={2}
          />
        </div>

        <Separator />

        {/* Stats Labels */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'تسميات الإحصائيات' : 'Stats Labels'}</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Members Label (EN)</Label>
              <Input
                value={communityData.stats_members_en || 'Active Members'}
                onChange={(e) => updateField('community', 'stats_members_en', e.target.value)}
              />
              <Input
                value={communityData.stats_members_ar || 'عضو نشط'}
                onChange={(e) => updateField('community', 'stats_members_ar', e.target.value)}
                dir="rtl"
                className="mt-2"
              />
            </div>
            <div className="space-y-2">
              <Label>Joined Label (EN)</Label>
              <Input
                value={communityData.stats_joined_en || 'Joined This Month'}
                onChange={(e) => updateField('community', 'stats_joined_en', e.target.value)}
              />
              <Input
                value={communityData.stats_joined_ar || 'انضموا هذا الشهر'}
                onChange={(e) => updateField('community', 'stats_joined_ar', e.target.value)}
                dir="rtl"
                className="mt-2"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Button */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <MousePointer className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'الزر' : 'Button'}</h3>
          </div>

          <BilingualInput
            labelEn="Button Text"
            labelAr="نص الزر"
            valueEn={communityData.button_en || ''}
            valueAr={communityData.button_ar || ''}
            onChangeEn={(v) => updateField('community', 'button_en', v)}
            onChangeAr={(v) => updateField('community', 'button_ar', v)}
          />

          <div className="space-y-2">
            <Label>Button Link</Label>
            <Input
              value={communityData.button_link || '/signup'}
              onChange={(e) => updateField('community', 'button_link', e.target.value)}
              placeholder="/signup"
            />
          </div>
        </div>

        <Separator />

        {/* Trust Badges */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'شارات الثقة' : 'Trust Badges'}</h3>
          </div>

          <SortableList<TrustBadge>
            items={badges}
            onReorder={(newItems) => updateArray('community', 'trust_badges', newItems)}
            onAdd={() => addArrayItem('community', 'trust_badges', badgeTemplate)}
            onRemove={(index) => removeArrayItem('community', 'trust_badges', index)}
            addLabel={isRTL ? 'إضافة شارة' : 'Add Badge'}
            minItems={1}
            maxItems={6}
            renderItem={(item: TrustBadge, index: number) => (
              <div className="space-y-4">
                <IconSelector
                  value={item.icon || 'Star'}
                  onChange={(icon) => updateArrayItem('community', 'trust_badges', index, 'icon', icon)}
                  label={isRTL ? 'الأيقونة' : 'Icon'}
                />
                
                <BilingualInput
                  labelEn="Badge Text"
                  labelAr="نص الشارة"
                  valueEn={item.text_en || ''}
                  valueAr={item.text_ar || ''}
                  onChangeEn={(v) => updateArrayItem('community', 'trust_badges', index, 'text_en', v)}
                  onChangeAr={(v) => updateArrayItem('community', 'trust_badges', index, 'text_ar', v)}
                />
              </div>
            )}
          />
        </div>

        <Separator />

        {/* Background */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'صورة الخلفية' : 'Background Image'}</h3>
          </div>

          <ImageUploader
            value={communityData.background_image || ''}
            onChange={(url) => updateField('community', 'background_image', url)}
            label={isRTL ? 'صورة الخلفية' : 'Background Image'}
            bucket="course-thumbnails"
            folder="landing"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Overlay Opacity (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={communityData.overlay_opacity || '80'}
                onChange={(e) => updateField('community', 'overlay_opacity', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============= FOOTER SECTION EDITOR =============
  const renderFooterSection = () => {
    const footerData = editedContent.footer || {};
    const socialLinks = footerData.social_links || [];

    const socialLinkTemplate = {
      id: `social-${Date.now()}`,
      platform: 'x',
      url: '',
      is_visible: true
    };

    const platformOptions = [
      { value: 'x', label: 'X (Twitter)' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'tiktok', label: 'TikTok' },
      { value: 'snapchat', label: 'Snapchat' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'facebook', label: 'Facebook' },
      { value: 'linkedin', label: 'LinkedIn' },
    ];

    return (
      <div className="space-y-8">
        {/* Contact Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Type className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'معلومات الاتصال' : 'Contact Information'}</h3>
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
            <Input
              value={footerData.email || 'info@bikerz.sa'}
              onChange={(e) => updateField('footer', 'email', e.target.value)}
              placeholder="info@bikerz.sa"
            />
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label>
            <Input
              value={footerData.phone || '+966 50 111 1111'}
              onChange={(e) => updateField('footer', 'phone', e.target.value)}
              placeholder="+966 50 111 1111"
              dir="ltr"
            />
          </div>

          <BilingualInput
            labelEn="Tagline"
            labelAr="الشعار"
            valueEn={footerData.tagline_en || 'Empowering riders across the GCC'}
            valueAr={footerData.tagline_ar || 'تمكين الراكبين في جميع أنحاء الخليج'}
            onChangeEn={(v) => updateField('footer', 'tagline_en', v)}
            onChangeAr={(v) => updateField('footer', 'tagline_ar', v)}
          />
        </div>

        <Separator />

        {/* Social Media Links */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'روابط التواصل الاجتماعي' : 'Social Media Links'}</h3>
          </div>

          <SortableList
            items={socialLinks}
            onReorder={(newItems) => updateArray('footer', 'social_links', newItems)}
            onAdd={() => addArrayItem('footer', 'social_links', socialLinkTemplate)}
            onRemove={(index) => removeArrayItem('footer', 'social_links', index)}
            addLabel={isRTL ? 'إضافة رابط' : 'Add Social Link'}
            minItems={0}
            maxItems={10}
            renderItem={(item: { platform: string; url: string; is_visible: boolean }, index: number) => (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{isRTL ? 'المنصة' : 'Platform'}</Label>
                    <select
                      value={item.platform || 'x'}
                      onChange={(e) => updateArrayItem('footer', 'social_links', index, 'platform', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {platformOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'الرابط' : 'URL'}</Label>
                    <Input
                      value={item.url || ''}
                      onChange={(e) => updateArrayItem('footer', 'social_links', index, 'url', e.target.value)}
                      placeholder="https://x.com/bikerz"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={item.is_visible !== false}
                    onCheckedChange={(v) => updateArrayItem('footer', 'social_links', index, 'is_visible', v)}
                  />
                  <Label>{isRTL ? 'مرئي' : 'Visible'}</Label>
                </div>
              </div>
            )}
          />
        </div>
      </div>
    );
  };

  // ============= PAGES SECTION EDITOR =============
  const renderPagesSection = () => {
    const privacyData = editedContent.privacy_page || {};
    const termsData = editedContent.terms_page || {};
    const contactData = editedContent.contact_page || {};
    const aboutData = editedContent.about_page || {};

    return (
      <div className="space-y-8">
        {/* About Us Page */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'صفحة من نحن' : 'About Us Page'}</h3>
            <Badge variant="outline" className="ms-auto">
              <a href="/about" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                {isRTL ? 'معاينة' : 'Preview'}
              </a>
            </Badge>
          </div>

          <BilingualInput
            labelEn="Page Title"
            labelAr="عنوان الصفحة"
            valueEn={aboutData.title_en || 'About BIKERZ'}
            valueAr={aboutData.title_ar || 'عن بايكرز'}
            onChangeEn={(v) => updateField('about_page', 'title_en', v)}
            onChangeAr={(v) => updateField('about_page', 'title_ar', v)}
          />

          <BilingualInput
            labelEn="Subtitle"
            labelAr="العنوان الفرعي"
            valueEn={aboutData.subtitle_en || 'Empowering riders across Saudi Arabia with professional motorcycle training'}
            valueAr={aboutData.subtitle_ar || 'تمكين الدراجين في المملكة العربية السعودية من خلال التدريب الاحترافي'}
            onChangeEn={(v) => updateField('about_page', 'subtitle_en', v)}
            onChangeAr={(v) => updateField('about_page', 'subtitle_ar', v)}
            isTextarea
            rows={2}
          />

          <Separator />

          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-sm">{isRTL ? 'قصتنا' : 'Our Story'}</h4>
          </div>

          <BilingualInput
            labelEn="Story Title"
            labelAr="عنوان القصة"
            valueEn={aboutData.story_title_en || 'Our Story'}
            valueAr={aboutData.story_title_ar || 'قصتنا'}
            onChangeEn={(v) => updateField('about_page', 'story_title_en', v)}
            onChangeAr={(v) => updateField('about_page', 'story_title_ar', v)}
          />

          <BilingualInput
            labelEn="Story Paragraph 1"
            labelAr="الفقرة الأولى"
            valueEn={aboutData.story_p1_en || ''}
            valueAr={aboutData.story_p1_ar || ''}
            onChangeEn={(v) => updateField('about_page', 'story_p1_en', v)}
            onChangeAr={(v) => updateField('about_page', 'story_p1_ar', v)}
            isTextarea
            rows={4}
          />

          <BilingualInput
            labelEn="Story Paragraph 2"
            labelAr="الفقرة الثانية"
            valueEn={aboutData.story_p2_en || ''}
            valueAr={aboutData.story_p2_ar || ''}
            onChangeEn={(v) => updateField('about_page', 'story_p2_en', v)}
            onChangeAr={(v) => updateField('about_page', 'story_p2_ar', v)}
            isTextarea
            rows={4}
          />

          <Separator />

          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-sm">{isRTL ? 'المهمة والرؤية' : 'Mission & Vision'}</h4>
          </div>

          <BilingualInput
            labelEn="Mission Title"
            labelAr="عنوان المهمة"
            valueEn={aboutData.mission_title_en || 'Our Mission'}
            valueAr={aboutData.mission_title_ar || 'مهمتنا'}
            onChangeEn={(v) => updateField('about_page', 'mission_title_en', v)}
            onChangeAr={(v) => updateField('about_page', 'mission_title_ar', v)}
          />

          <BilingualInput
            labelEn="Mission Description"
            labelAr="وصف المهمة"
            valueEn={aboutData.mission_desc_en || ''}
            valueAr={aboutData.mission_desc_ar || ''}
            onChangeEn={(v) => updateField('about_page', 'mission_desc_en', v)}
            onChangeAr={(v) => updateField('about_page', 'mission_desc_ar', v)}
            isTextarea
            rows={3}
          />

          <BilingualInput
            labelEn="Vision Title"
            labelAr="عنوان الرؤية"
            valueEn={aboutData.vision_title_en || 'Our Vision'}
            valueAr={aboutData.vision_title_ar || 'رؤيتنا'}
            onChangeEn={(v) => updateField('about_page', 'vision_title_en', v)}
            onChangeAr={(v) => updateField('about_page', 'vision_title_ar', v)}
          />

          <BilingualInput
            labelEn="Vision Description"
            labelAr="وصف الرؤية"
            valueEn={aboutData.vision_desc_en || ''}
            valueAr={aboutData.vision_desc_ar || ''}
            onChangeEn={(v) => updateField('about_page', 'vision_desc_en', v)}
            onChangeAr={(v) => updateField('about_page', 'vision_desc_ar', v)}
            isTextarea
            rows={3}
          />

          <Separator />

          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-sm">{isRTL ? 'القيم' : 'Values'}</h4>
          </div>

          <BilingualInput
            labelEn="Values Section Title"
            labelAr="عنوان قسم القيم"
            valueEn={aboutData.values_title_en || 'Our Values'}
            valueAr={aboutData.values_title_ar || 'قيمنا'}
            onChangeEn={(v) => updateField('about_page', 'values_title_en', v)}
            onChangeAr={(v) => updateField('about_page', 'values_title_ar', v)}
          />

          <BilingualInput
            labelEn="Values Subtitle"
            labelAr="العنوان الفرعي للقيم"
            valueEn={aboutData.values_subtitle_en || ''}
            valueAr={aboutData.values_subtitle_ar || ''}
            onChangeEn={(v) => updateField('about_page', 'values_subtitle_en', v)}
            onChangeAr={(v) => updateField('about_page', 'values_subtitle_ar', v)}
          />

          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border border-border/30 rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">
                {isRTL ? `القيمة ${i + 1}` : `Value ${i + 1}`}
              </Label>
              <BilingualInput
                labelEn="Title"
                labelAr="العنوان"
                valueEn={aboutData[`value${i}_title_en`] || ''}
                valueAr={aboutData[`value${i}_title_ar`] || ''}
                onChangeEn={(v) => updateField('about_page', `value${i}_title_en`, v)}
                onChangeAr={(v) => updateField('about_page', `value${i}_title_ar`, v)}
              />
              <BilingualInput
                labelEn="Description"
                labelAr="الوصف"
                valueEn={aboutData[`value${i}_desc_en`] || ''}
                valueAr={aboutData[`value${i}_desc_ar`] || ''}
                onChangeEn={(v) => updateField('about_page', `value${i}_desc_en`, v)}
                onChangeAr={(v) => updateField('about_page', `value${i}_desc_ar`, v)}
              />
              <IconSelector
                value={aboutData[`value${i}_icon`] || ['Shield', 'Users', 'Award', 'Target'][i]}
                onChange={(icon) => updateField('about_page', `value${i}_icon`, icon)}
                label={isRTL ? 'الأيقونة' : 'Icon'}
              />
            </div>
          ))}

          <Separator />

          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-sm">{isRTL ? 'معلومات الاتصال' : 'Contact Info'}</h4>
          </div>

          <BilingualInput
            labelEn="Contact Section Title"
            labelAr="عنوان قسم الاتصال"
            valueEn={aboutData.contact_title_en || 'Get in Touch'}
            valueAr={aboutData.contact_title_ar || 'تواصل معنا'}
            onChangeEn={(v) => updateField('about_page', 'contact_title_en', v)}
            onChangeAr={(v) => updateField('about_page', 'contact_title_ar', v)}
          />

          <BilingualInput
            labelEn="Contact Section Subtitle"
            labelAr="العنوان الفرعي لقسم الاتصال"
            valueEn={aboutData.contact_subtitle_en || ''}
            valueAr={aboutData.contact_subtitle_ar || ''}
            onChangeEn={(v) => updateField('about_page', 'contact_subtitle_en', v)}
            onChangeAr={(v) => updateField('about_page', 'contact_subtitle_ar', v)}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{isRTL ? 'الهاتف' : 'Phone'}</Label>
              <Input
                value={aboutData.phone || '+966 50 111 1111'}
                onChange={(e) => updateField('about_page', 'phone', e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input
                value={aboutData.email || 'info@bikerz.sa'}
                onChange={(e) => updateField('about_page', 'email', e.target.value)}
              />
            </div>
          </div>

          <BilingualInput
            labelEn="Location"
            labelAr="الموقع"
            valueEn={aboutData.location_en || ''}
            valueAr={aboutData.location_ar || ''}
            onChangeEn={(v) => updateField('about_page', 'location_en', v)}
            onChangeAr={(v) => updateField('about_page', 'location_ar', v)}
          />

          <BilingualInput
            labelEn="Working Hours"
            labelAr="ساعات العمل"
            valueEn={aboutData.hours_en || 'Sun - Thu: 9AM - 6PM'}
            valueAr={aboutData.hours_ar || 'الأحد - الخميس: 9 صباحاً - 6 مساءً'}
            onChangeEn={(v) => updateField('about_page', 'hours_en', v)}
            onChangeAr={(v) => updateField('about_page', 'hours_ar', v)}
          />

          <ImageUploader
            value={aboutData.hero_image || ''}
            onChange={(url) => updateField('about_page', 'hero_image', url)}
            label={isRTL ? 'صورة القسم الرئيسي' : 'Hero Section Image'}
            bucket="course-thumbnails"
            folder="landing"
          />

          <div className="flex items-center gap-2">
            <Switch
              checked={aboutData.is_enabled !== false}
              onCheckedChange={(v) => updateField('about_page', 'is_enabled', v)}
            />
            <Label>{isRTL ? 'الصفحة مفعلة' : 'Page Enabled'}</Label>
          </div>
        </div>

        <Separator />

        {/* Privacy Policy Page */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'صفحة سياسة الخصوصية' : 'Privacy Policy Page'}</h3>
            <Badge variant="outline" className="ms-auto">
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                {isRTL ? 'معاينة' : 'Preview'}
              </a>
            </Badge>
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'تاريخ آخر تحديث' : 'Last Updated Date'}</Label>
            <Input
              type="date"
              value={privacyData.last_updated || '2024-01-01'}
              onChange={(e) => updateField('privacy_page', 'last_updated', e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={privacyData.is_enabled !== false}
              onCheckedChange={(v) => updateField('privacy_page', 'is_enabled', v)}
            />
            <Label>{isRTL ? 'الصفحة مفعلة' : 'Page Enabled'}</Label>
          </div>

          <p className="text-sm text-muted-foreground">
            {isRTL 
              ? 'محتوى صفحة سياسة الخصوصية يستخدم قوالب افتراضية. يمكنك تعديل التاريخ وحالة التفعيل.'
              : 'Privacy policy page content uses default templates. You can modify the date and enable/disable status.'
            }
          </p>
        </div>

        <Separator />

        {/* Terms of Service Page */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'صفحة شروط الخدمة' : 'Terms of Service Page'}</h3>
            <Badge variant="outline" className="ms-auto">
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                {isRTL ? 'معاينة' : 'Preview'}
              </a>
            </Badge>
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'تاريخ آخر تحديث' : 'Last Updated Date'}</Label>
            <Input
              type="date"
              value={termsData.last_updated || '2024-01-01'}
              onChange={(e) => updateField('terms_page', 'last_updated', e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={termsData.is_enabled !== false}
              onCheckedChange={(v) => updateField('terms_page', 'is_enabled', v)}
            />
            <Label>{isRTL ? 'الصفحة مفعلة' : 'Page Enabled'}</Label>
          </div>

          <p className="text-sm text-muted-foreground">
            {isRTL 
              ? 'محتوى صفحة شروط الخدمة يستخدم قوالب افتراضية. يمكنك تعديل التاريخ وحالة التفعيل.'
              : 'Terms of service page content uses default templates. You can modify the date and enable/disable status.'
            }
          </p>
        </div>

        <Separator />

        {/* Contact Us Page */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'صفحة اتصل بنا' : 'Contact Us Page'}</h3>
            <Badge variant="outline" className="ms-auto">
              <a href="/contact" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                {isRTL ? 'معاينة' : 'Preview'}
              </a>
            </Badge>
          </div>

          <BilingualInput
            labelEn="Page Title"
            labelAr="عنوان الصفحة"
            valueEn={contactData.title_en || 'Contact Us'}
            valueAr={contactData.title_ar || 'اتصل بنا'}
            onChangeEn={(v) => updateField('contact_page', 'title_en', v)}
            onChangeAr={(v) => updateField('contact_page', 'title_ar', v)}
          />

          <BilingualInput
            labelEn="Page Subtitle"
            labelAr="العنوان الفرعي"
            valueEn={contactData.subtitle_en || "Have questions or need help? We're here for you."}
            valueAr={contactData.subtitle_ar || 'لديك أسئلة أو تحتاج مساعدة؟ نحن هنا من أجلك.'}
            onChangeEn={(v) => updateField('contact_page', 'subtitle_en', v)}
            onChangeAr={(v) => updateField('contact_page', 'subtitle_ar', v)}
            isTextarea
            rows={2}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{isRTL ? 'البريد الإلكتروني' : 'Contact Email'}</Label>
              <Input
                value={contactData.email || 'support@bikerz.sa'}
                onChange={(e) => updateField('contact_page', 'email', e.target.value)}
                placeholder="support@bikerz.sa"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label>
              <Input
                value={contactData.phone || '+966 12 XXX XXXX'}
                onChange={(e) => updateField('contact_page', 'phone', e.target.value)}
                placeholder="+966 12 XXX XXXX"
                dir="ltr"
              />
            </div>
          </div>

          <BilingualInput
            labelEn="Location"
            labelAr="الموقع"
            valueEn={contactData.location_en || 'Jeddah, Saudi Arabia'}
            valueAr={contactData.location_ar || 'جدة، المملكة العربية السعودية'}
            onChangeEn={(v) => updateField('contact_page', 'location_en', v)}
            onChangeAr={(v) => updateField('contact_page', 'location_ar', v)}
          />

          <BilingualInput
            labelEn="Working Hours"
            labelAr="ساعات العمل"
            valueEn={contactData.hours_en || 'Sun - Thu: 9AM - 6PM'}
            valueAr={contactData.hours_ar || 'الأحد - الخميس: 9 صباحاً - 6 مساءً'}
            onChangeEn={(v) => updateField('contact_page', 'hours_en', v)}
            onChangeAr={(v) => updateField('contact_page', 'hours_ar', v)}
          />

          <div className="flex items-center gap-2">
            <Switch
              checked={contactData.is_enabled !== false}
              onCheckedChange={(v) => updateField('contact_page', 'is_enabled', v)}
            />
            <Label>{isRTL ? 'الصفحة مفعلة' : 'Page Enabled'}</Label>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 mt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              {isRTL 
                ? 'نماذج الاتصال ترسل تلقائياً إلى نظام التذاكر. اذهب إلى لوحة الدعم لإدارة الطلبات.'
                : 'Contact forms automatically submit to the ticketing system. Go to Support panel to manage requests.'
              }
            </p>
            <a 
              href="/admin/support" 
              className="text-sm text-primary hover:underline mt-2 inline-block"
            >
              {isRTL ? 'الذهاب إلى لوحة الدعم ←' : '→ Go to Support Panel'}
            </a>
          </div>
        </div>

        <Separator />

        {/* Login Page */}
        {(() => {
          const loginData = editedContent.login_page || {};
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <LogIn className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">{isRTL ? 'صفحة تسجيل الدخول' : 'Login Page'}</h3>
                <Badge variant="outline" className="ms-auto">
                  <a href="/login" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    {isRTL ? 'معاينة' : 'Preview'}
                  </a>
                </Badge>
              </div>

              <BilingualInput
                labelEn="Page Title"
                labelAr="عنوان الصفحة"
                valueEn={loginData.title_en || ''}
                valueAr={loginData.title_ar || ''}
                onChangeEn={(v) => updateField('login_page', 'title_en', v)}
                onChangeAr={(v) => updateField('login_page', 'title_ar', v)}
                placeholderEn="Welcome Back"
                placeholderAr="مرحباً بعودتك"
              />

              <BilingualInput
                labelEn="Subtitle"
                labelAr="العنوان الفرعي"
                valueEn={loginData.subtitle_en || ''}
                valueAr={loginData.subtitle_ar || ''}
                onChangeEn={(v) => updateField('login_page', 'subtitle_en', v)}
                onChangeAr={(v) => updateField('login_page', 'subtitle_ar', v)}
                placeholderEn="Sign in to continue your journey"
                placeholderAr="سجل دخولك لمتابعة رحلتك"
              />

              <BilingualInput
                labelEn="Login Button Text"
                labelAr="نص زر الدخول"
                valueEn={loginData.button_en || ''}
                valueAr={loginData.button_ar || ''}
                onChangeEn={(v) => updateField('login_page', 'button_en', v)}
                onChangeAr={(v) => updateField('login_page', 'button_ar', v)}
                placeholderEn="Sign In"
                placeholderAr="تسجيل الدخول"
              />

              <BilingualInput
                labelEn="Forgot Password Text"
                labelAr="نص نسيت كلمة المرور"
                valueEn={loginData.forgot_en || ''}
                valueAr={loginData.forgot_ar || ''}
                onChangeEn={(v) => updateField('login_page', 'forgot_en', v)}
                onChangeAr={(v) => updateField('login_page', 'forgot_ar', v)}
                placeholderEn="Forgot your password?"
                placeholderAr="نسيت كلمة المرور؟"
              />

              <BilingualInput
                labelEn="No Account Text"
                labelAr="نص ليس لديك حساب"
                valueEn={loginData.no_account_en || ''}
                valueAr={loginData.no_account_ar || ''}
                onChangeEn={(v) => updateField('login_page', 'no_account_en', v)}
                onChangeAr={(v) => updateField('login_page', 'no_account_ar', v)}
                placeholderEn="Don't have an account?"
                placeholderAr="ليس لديك حساب؟"
              />

              <BilingualInput
                labelEn="Signup Link Text"
                labelAr="نص رابط التسجيل"
                valueEn={loginData.signup_link_en || ''}
                valueAr={loginData.signup_link_ar || ''}
                onChangeEn={(v) => updateField('login_page', 'signup_link_en', v)}
                onChangeAr={(v) => updateField('login_page', 'signup_link_ar', v)}
                placeholderEn="Sign up"
                placeholderAr="سجل الآن"
              />

              <ImageUploader
                value={loginData.image || ''}
                onChange={(url) => updateField('login_page', 'image', url)}
                label={isRTL ? 'صورة الخلفية' : 'Background Image'}
                bucket="course-thumbnails"
                folder="auth"
              />
            </div>
          );
        })()}

        <Separator />

        {/* Signup Page */}
        {(() => {
          const signupData = editedContent.signup_page || {};
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">{isRTL ? 'صفحة إنشاء الحساب' : 'Signup Page'}</h3>
                <Badge variant="outline" className="ms-auto">
                  <a href="/signup" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    {isRTL ? 'معاينة' : 'Preview'}
                  </a>
                </Badge>
              </div>

              <BilingualInput
                labelEn="Page Title"
                labelAr="عنوان الصفحة"
                valueEn={signupData.title_en || ''}
                valueAr={signupData.title_ar || ''}
                onChangeEn={(v) => updateField('signup_page', 'title_en', v)}
                onChangeAr={(v) => updateField('signup_page', 'title_ar', v)}
                placeholderEn="Create Your Account"
                placeholderAr="أنشئ حسابك"
              />

              <BilingualInput
                labelEn="Subtitle"
                labelAr="العنوان الفرعي"
                valueEn={signupData.subtitle_en || ''}
                valueAr={signupData.subtitle_ar || ''}
                onChangeEn={(v) => updateField('signup_page', 'subtitle_en', v)}
                onChangeAr={(v) => updateField('signup_page', 'subtitle_ar', v)}
                placeholderEn="Join the BIKERZ community"
                placeholderAr="انضم إلى مجتمع بايكرز"
              />

              <BilingualInput
                labelEn="Signup Button Text"
                labelAr="نص زر التسجيل"
                valueEn={signupData.button_en || ''}
                valueAr={signupData.button_ar || ''}
                onChangeEn={(v) => updateField('signup_page', 'button_en', v)}
                onChangeAr={(v) => updateField('signup_page', 'button_ar', v)}
                placeholderEn="Create Account"
                placeholderAr="إنشاء حساب"
              />

              <BilingualInput
                labelEn="Name Label"
                labelAr="تسمية الاسم"
                valueEn={signupData.name_label_en || ''}
                valueAr={signupData.name_label_ar || ''}
                onChangeEn={(v) => updateField('signup_page', 'name_label_en', v)}
                onChangeAr={(v) => updateField('signup_page', 'name_label_ar', v)}
                placeholderEn="Full Name"
                placeholderAr="الاسم الكامل"
              />

              <BilingualInput
                labelEn="Email Label"
                labelAr="تسمية البريد"
                valueEn={signupData.email_label_en || ''}
                valueAr={signupData.email_label_ar || ''}
                onChangeEn={(v) => updateField('signup_page', 'email_label_en', v)}
                onChangeAr={(v) => updateField('signup_page', 'email_label_ar', v)}
                placeholderEn="Email Address"
                placeholderAr="البريد الإلكتروني"
              />

              <BilingualInput
                labelEn="Password Label"
                labelAr="تسمية كلمة المرور"
                valueEn={signupData.password_label_en || ''}
                valueAr={signupData.password_label_ar || ''}
                onChangeEn={(v) => updateField('signup_page', 'password_label_en', v)}
                onChangeAr={(v) => updateField('signup_page', 'password_label_ar', v)}
                placeholderEn="Password"
                placeholderAr="كلمة المرور"
              />

              <BilingualInput
                labelEn="Confirm Password Label"
                labelAr="تسمية تأكيد كلمة المرور"
                valueEn={signupData.confirm_label_en || ''}
                valueAr={signupData.confirm_label_ar || ''}
                onChangeEn={(v) => updateField('signup_page', 'confirm_label_en', v)}
                onChangeAr={(v) => updateField('signup_page', 'confirm_label_ar', v)}
                placeholderEn="Confirm Password"
                placeholderAr="تأكيد كلمة المرور"
              />

              <BilingualInput
                labelEn="Has Account Text"
                labelAr="نص لديك حساب"
                valueEn={signupData.has_account_en || ''}
                valueAr={signupData.has_account_ar || ''}
                onChangeEn={(v) => updateField('signup_page', 'has_account_en', v)}
                onChangeAr={(v) => updateField('signup_page', 'has_account_ar', v)}
                placeholderEn="Already have an account?"
                placeholderAr="لديك حساب بالفعل؟"
              />

              <BilingualInput
                labelEn="Login Link Text"
                labelAr="نص رابط الدخول"
                valueEn={signupData.login_link_en || ''}
                valueAr={signupData.login_link_ar || ''}
                onChangeEn={(v) => updateField('signup_page', 'login_link_en', v)}
                onChangeAr={(v) => updateField('signup_page', 'login_link_ar', v)}
                placeholderEn="Sign in"
                placeholderAr="تسجيل الدخول"
              />

              <ImageUploader
                value={signupData.image || ''}
                onChange={(url) => updateField('signup_page', 'image', url)}
                label={isRTL ? 'صورة الخلفية' : 'Background Image'}
                bucket="course-thumbnails"
                folder="auth"
              />
            </div>
          );
        })()}
      </div>
    );
  };

  const renderAboutPageSection = () => {
    const aboutData = editedContent.about_page || {};
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{isRTL ? 'صفحة من نحن' : 'About Us Page'}</h3>
          <Badge variant="outline" className="ms-auto">
            <a href="/about" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              {isRTL ? 'معاينة' : 'Preview'}
            </a>
          </Badge>
        </div>
        <BilingualInput labelEn="Page Title" labelAr="عنوان الصفحة" valueEn={aboutData.title_en || 'About BIKERZ'} valueAr={aboutData.title_ar || 'عن بايكرز'} onChangeEn={(v) => updateField('about_page', 'title_en', v)} onChangeAr={(v) => updateField('about_page', 'title_ar', v)} />
        <BilingualInput labelEn="Subtitle" labelAr="العنوان الفرعي" valueEn={aboutData.subtitle_en || ''} valueAr={aboutData.subtitle_ar || ''} onChangeEn={(v) => updateField('about_page', 'subtitle_en', v)} onChangeAr={(v) => updateField('about_page', 'subtitle_ar', v)} isTextarea rows={2} />
        <Separator />
        <div className="flex items-center gap-2 mb-2"><h4 className="font-medium text-sm">{isRTL ? 'قصتنا' : 'Our Story'}</h4></div>
        <BilingualInput labelEn="Story Title" labelAr="عنوان القصة" valueEn={aboutData.story_title_en || 'Our Story'} valueAr={aboutData.story_title_ar || 'قصتنا'} onChangeEn={(v) => updateField('about_page', 'story_title_en', v)} onChangeAr={(v) => updateField('about_page', 'story_title_ar', v)} />
        <BilingualInput labelEn="Story Paragraph 1" labelAr="الفقرة الأولى" valueEn={aboutData.story_p1_en || ''} valueAr={aboutData.story_p1_ar || ''} onChangeEn={(v) => updateField('about_page', 'story_p1_en', v)} onChangeAr={(v) => updateField('about_page', 'story_p1_ar', v)} isTextarea rows={4} />
        <BilingualInput labelEn="Story Paragraph 2" labelAr="الفقرة الثانية" valueEn={aboutData.story_p2_en || ''} valueAr={aboutData.story_p2_ar || ''} onChangeEn={(v) => updateField('about_page', 'story_p2_en', v)} onChangeAr={(v) => updateField('about_page', 'story_p2_ar', v)} isTextarea rows={4} />
        <Separator />
        <div className="flex items-center gap-2 mb-2"><h4 className="font-medium text-sm">{isRTL ? 'المهمة' : 'Mission'}</h4></div>
        <BilingualInput labelEn="Mission Title" labelAr="عنوان المهمة" valueEn={aboutData.mission_title_en || 'Our Mission'} valueAr={aboutData.mission_title_ar || 'مهمتنا'} onChangeEn={(v) => updateField('about_page', 'mission_title_en', v)} onChangeAr={(v) => updateField('about_page', 'mission_title_ar', v)} />
        <BilingualInput labelEn="Mission Description" labelAr="وصف المهمة" valueEn={aboutData.mission_desc_en || ''} valueAr={aboutData.mission_desc_ar || ''} onChangeEn={(v) => updateField('about_page', 'mission_desc_en', v)} onChangeAr={(v) => updateField('about_page', 'mission_desc_ar', v)} isTextarea rows={3} />
        <Separator />
        <div className="flex items-center gap-2 mb-2"><h4 className="font-medium text-sm">{isRTL ? 'القيم' : 'Values'}</h4></div>
        <BilingualInput labelEn="Values Section Title" labelAr="عنوان قسم القيم" valueEn={aboutData.values_title_en || 'Our Values'} valueAr={aboutData.values_title_ar || 'قيمنا'} onChangeEn={(v) => updateField('about_page', 'values_title_en', v)} onChangeAr={(v) => updateField('about_page', 'values_title_ar', v)} />
        <BilingualInput labelEn="Values Subtitle" labelAr="العنوان الفرعي للقيم" valueEn={aboutData.values_subtitle_en || ''} valueAr={aboutData.values_subtitle_ar || ''} onChangeEn={(v) => updateField('about_page', 'values_subtitle_en', v)} onChangeAr={(v) => updateField('about_page', 'values_subtitle_ar', v)} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border border-border/30 rounded-lg p-4 space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">{isRTL ? `القيمة ${i + 1}` : `Value ${i + 1}`}</Label>
            <BilingualInput labelEn="Title" labelAr="العنوان" valueEn={aboutData[`value${i}_title_en`] || ''} valueAr={aboutData[`value${i}_title_ar`] || ''} onChangeEn={(v) => updateField('about_page', `value${i}_title_en`, v)} onChangeAr={(v) => updateField('about_page', `value${i}_title_ar`, v)} />
            <BilingualInput labelEn="Description" labelAr="الوصف" valueEn={aboutData[`value${i}_desc_en`] || ''} valueAr={aboutData[`value${i}_desc_ar`] || ''} onChangeEn={(v) => updateField('about_page', `value${i}_desc_en`, v)} onChangeAr={(v) => updateField('about_page', `value${i}_desc_ar`, v)} />
            <IconSelector value={aboutData[`value${i}_icon`] || ['Shield', 'Users', 'Award', 'Target'][i]} onChange={(icon) => updateField('about_page', `value${i}_icon`, icon)} label={isRTL ? 'الأيقونة' : 'Icon'} />
          </div>
        ))}
        <Separator />
        <div className="flex items-center gap-2 mb-2"><h4 className="font-medium text-sm">{isRTL ? 'معلومات الاتصال' : 'Contact Info'}</h4></div>
        <BilingualInput labelEn="Contact Section Title" labelAr="عنوان قسم الاتصال" valueEn={aboutData.contact_title_en || 'Get in Touch'} valueAr={aboutData.contact_title_ar || 'تواصل معنا'} onChangeEn={(v) => updateField('about_page', 'contact_title_en', v)} onChangeAr={(v) => updateField('about_page', 'contact_title_ar', v)} />
        <BilingualInput labelEn="Contact Section Subtitle" labelAr="العنوان الفرعي لقسم الاتصال" valueEn={aboutData.contact_subtitle_en || ''} valueAr={aboutData.contact_subtitle_ar || ''} onChangeEn={(v) => updateField('about_page', 'contact_subtitle_en', v)} onChangeAr={(v) => updateField('about_page', 'contact_subtitle_ar', v)} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>{isRTL ? 'الهاتف' : 'Phone'}</Label><Input value={aboutData.phone || '+966 50 111 1111'} onChange={(e) => updateField('about_page', 'phone', e.target.value)} dir="ltr" /></div>
          <div className="space-y-2"><Label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</Label><Input value={aboutData.email || 'info@bikerz.sa'} onChange={(e) => updateField('about_page', 'email', e.target.value)} /></div>
        </div>
        <BilingualInput labelEn="Location" labelAr="الموقع" valueEn={aboutData.location_en || ''} valueAr={aboutData.location_ar || ''} onChangeEn={(v) => updateField('about_page', 'location_en', v)} onChangeAr={(v) => updateField('about_page', 'location_ar', v)} />
        <BilingualInput labelEn="Working Hours" labelAr="ساعات العمل" valueEn={aboutData.hours_en || 'Sun - Thu: 9AM - 6PM'} valueAr={aboutData.hours_ar || 'الأحد - الخميس: 9 صباحاً - 6 مساءً'} onChangeEn={(v) => updateField('about_page', 'hours_en', v)} onChangeAr={(v) => updateField('about_page', 'hours_ar', v)} />
        <ImageUploader value={aboutData.hero_image || ''} onChange={(url) => updateField('about_page', 'hero_image', url)} label={isRTL ? 'صورة القسم الرئيسي' : 'Hero Section Image'} bucket="course-thumbnails" folder="landing" />
        <div className="flex items-center gap-2"><Switch checked={aboutData.is_enabled !== false} onCheckedChange={(v) => updateField('about_page', 'is_enabled', v)} /><Label>{isRTL ? 'الصفحة مفعلة' : 'Page Enabled'}</Label></div>
      </div>
    );
  };

  const renderPrivacyPageSection = () => {
    const privacyData = editedContent.privacy_page || {};
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{isRTL ? 'صفحة سياسة الخصوصية' : 'Privacy Policy Page'}</h3>
          <Badge variant="outline" className="ms-auto"><a href="/privacy" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1"><ExternalLink className="w-3 h-3" />{isRTL ? 'معاينة' : 'Preview'}</a></Badge>
        </div>
        <div className="space-y-2"><Label>{isRTL ? 'تاريخ آخر تحديث' : 'Last Updated Date'}</Label><Input type="date" value={privacyData.last_updated || '2024-01-01'} onChange={(e) => updateField('privacy_page', 'last_updated', e.target.value)} /></div>
        <div className="flex items-center gap-2"><Switch checked={privacyData.is_enabled !== false} onCheckedChange={(v) => updateField('privacy_page', 'is_enabled', v)} /><Label>{isRTL ? 'الصفحة مفعلة' : 'Page Enabled'}</Label></div>
        <p className="text-sm text-muted-foreground">{isRTL ? 'محتوى صفحة سياسة الخصوصية يستخدم قوالب افتراضية. يمكنك تعديل التاريخ وحالة التفعيل.' : 'Privacy policy page content uses default templates. You can modify the date and enable/disable status.'}</p>
      </div>
    );
  };

  const renderTermsPageSection = () => {
    const termsData = editedContent.terms_page || {};
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{isRTL ? 'صفحة شروط الخدمة' : 'Terms of Service Page'}</h3>
          <Badge variant="outline" className="ms-auto"><a href="/terms" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1"><ExternalLink className="w-3 h-3" />{isRTL ? 'معاينة' : 'Preview'}</a></Badge>
        </div>
        <div className="space-y-2"><Label>{isRTL ? 'تاريخ آخر تحديث' : 'Last Updated Date'}</Label><Input type="date" value={termsData.last_updated || '2024-01-01'} onChange={(e) => updateField('terms_page', 'last_updated', e.target.value)} /></div>
        <div className="flex items-center gap-2"><Switch checked={termsData.is_enabled !== false} onCheckedChange={(v) => updateField('terms_page', 'is_enabled', v)} /><Label>{isRTL ? 'الصفحة مفعلة' : 'Page Enabled'}</Label></div>
        <p className="text-sm text-muted-foreground">{isRTL ? 'محتوى صفحة شروط الخدمة يستخدم قوالب افتراضية. يمكنك تعديل التاريخ وحالة التفعيل.' : 'Terms of service page content uses default templates. You can modify the date and enable/disable status.'}</p>
      </div>
    );
  };

  const renderContactPageSection = () => {
    const contactData = editedContent.contact_page || {};
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{isRTL ? 'صفحة اتصل بنا' : 'Contact Us Page'}</h3>
          <Badge variant="outline" className="ms-auto"><a href="/contact" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1"><ExternalLink className="w-3 h-3" />{isRTL ? 'معاينة' : 'Preview'}</a></Badge>
        </div>
        <BilingualInput labelEn="Page Title" labelAr="عنوان الصفحة" valueEn={contactData.title_en || 'Contact Us'} valueAr={contactData.title_ar || 'اتصل بنا'} onChangeEn={(v) => updateField('contact_page', 'title_en', v)} onChangeAr={(v) => updateField('contact_page', 'title_ar', v)} />
        <BilingualInput labelEn="Page Subtitle" labelAr="العنوان الفرعي" valueEn={contactData.subtitle_en || "Have questions or need help? We're here for you."} valueAr={contactData.subtitle_ar || 'لديك أسئلة أو تحتاج مساعدة؟ نحن هنا من أجلك.'} onChangeEn={(v) => updateField('contact_page', 'subtitle_en', v)} onChangeAr={(v) => updateField('contact_page', 'subtitle_ar', v)} isTextarea rows={2} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>{isRTL ? 'البريد الإلكتروني' : 'Contact Email'}</Label><Input value={contactData.email || 'support@bikerz.sa'} onChange={(e) => updateField('contact_page', 'email', e.target.value)} placeholder="support@bikerz.sa" /></div>
          <div className="space-y-2"><Label>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</Label><Input value={contactData.phone || '+966 12 XXX XXXX'} onChange={(e) => updateField('contact_page', 'phone', e.target.value)} placeholder="+966 12 XXX XXXX" dir="ltr" /></div>
        </div>
        <BilingualInput labelEn="Location" labelAr="الموقع" valueEn={contactData.location_en || 'Jeddah, Saudi Arabia'} valueAr={contactData.location_ar || 'جدة، المملكة العربية السعودية'} onChangeEn={(v) => updateField('contact_page', 'location_en', v)} onChangeAr={(v) => updateField('contact_page', 'location_ar', v)} />
        <BilingualInput labelEn="Working Hours" labelAr="ساعات العمل" valueEn={contactData.hours_en || 'Sun - Thu: 9AM - 6PM'} valueAr={contactData.hours_ar || 'الأحد - الخميس: 9 صباحاً - 6 مساءً'} onChangeEn={(v) => updateField('contact_page', 'hours_en', v)} onChangeAr={(v) => updateField('contact_page', 'hours_ar', v)} />
        <div className="flex items-center gap-2"><Switch checked={contactData.is_enabled !== false} onCheckedChange={(v) => updateField('contact_page', 'is_enabled', v)} /><Label>{isRTL ? 'الصفحة مفعلة' : 'Page Enabled'}</Label></div>
        <div className="bg-muted/50 rounded-lg p-4 mt-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4" />{isRTL ? 'نماذج الاتصال ترسل تلقائياً إلى نظام التذاكر.' : 'Contact forms automatically submit to the ticketing system.'}</p>
          <a href="/admin/support" className="text-sm text-primary hover:underline mt-2 inline-block">{isRTL ? 'الذهاب إلى لوحة الدعم ←' : '→ Go to Support Panel'}</a>
        </div>
      </div>
    );
  };

  const renderLoginPageSection = () => {
    const loginData = editedContent.login_page || {};
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <LogIn className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{isRTL ? 'صفحة تسجيل الدخول' : 'Login Page'}</h3>
          <Badge variant="outline" className="ms-auto"><a href="/login" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1"><ExternalLink className="w-3 h-3" />{isRTL ? 'معاينة' : 'Preview'}</a></Badge>
        </div>
        <BilingualInput labelEn="Page Title" labelAr="عنوان الصفحة" valueEn={loginData.title_en || ''} valueAr={loginData.title_ar || ''} onChangeEn={(v) => updateField('login_page', 'title_en', v)} onChangeAr={(v) => updateField('login_page', 'title_ar', v)} placeholderEn="Welcome Back" placeholderAr="مرحباً بعودتك" />
        <BilingualInput labelEn="Subtitle" labelAr="العنوان الفرعي" valueEn={loginData.subtitle_en || ''} valueAr={loginData.subtitle_ar || ''} onChangeEn={(v) => updateField('login_page', 'subtitle_en', v)} onChangeAr={(v) => updateField('login_page', 'subtitle_ar', v)} placeholderEn="Sign in to continue your journey" placeholderAr="سجل دخولك لمتابعة رحلتك" />
        <BilingualInput labelEn="Login Button Text" labelAr="نص زر الدخول" valueEn={loginData.button_en || ''} valueAr={loginData.button_ar || ''} onChangeEn={(v) => updateField('login_page', 'button_en', v)} onChangeAr={(v) => updateField('login_page', 'button_ar', v)} placeholderEn="Sign In" placeholderAr="تسجيل الدخول" />
        <BilingualInput labelEn="Forgot Password Text" labelAr="نص نسيت كلمة المرور" valueEn={loginData.forgot_en || ''} valueAr={loginData.forgot_ar || ''} onChangeEn={(v) => updateField('login_page', 'forgot_en', v)} onChangeAr={(v) => updateField('login_page', 'forgot_ar', v)} placeholderEn="Forgot your password?" placeholderAr="نسيت كلمة المرور؟" />
        <BilingualInput labelEn="No Account Text" labelAr="نص ليس لديك حساب" valueEn={loginData.no_account_en || ''} valueAr={loginData.no_account_ar || ''} onChangeEn={(v) => updateField('login_page', 'no_account_en', v)} onChangeAr={(v) => updateField('login_page', 'no_account_ar', v)} placeholderEn="Don't have an account?" placeholderAr="ليس لديك حساب؟" />
        <BilingualInput labelEn="Signup Link Text" labelAr="نص رابط التسجيل" valueEn={loginData.signup_link_en || ''} valueAr={loginData.signup_link_ar || ''} onChangeEn={(v) => updateField('login_page', 'signup_link_en', v)} onChangeAr={(v) => updateField('login_page', 'signup_link_ar', v)} placeholderEn="Sign up" placeholderAr="سجل الآن" />
        <ImageUploader value={loginData.image || ''} onChange={(url) => updateField('login_page', 'image', url)} label={isRTL ? 'صورة الخلفية' : 'Background Image'} bucket="course-thumbnails" folder="auth" />
      </div>
    );
  };

  const renderSignupPageSection = () => {
    const signupData = editedContent.signup_page || {};
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{isRTL ? 'صفحة إنشاء الحساب' : 'Signup Page'}</h3>
          <Badge variant="outline" className="ms-auto"><a href="/signup" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1"><ExternalLink className="w-3 h-3" />{isRTL ? 'معاينة' : 'Preview'}</a></Badge>
        </div>
        <BilingualInput labelEn="Page Title" labelAr="عنوان الصفحة" valueEn={signupData.title_en || ''} valueAr={signupData.title_ar || ''} onChangeEn={(v) => updateField('signup_page', 'title_en', v)} onChangeAr={(v) => updateField('signup_page', 'title_ar', v)} placeholderEn="Create Your Account" placeholderAr="أنشئ حسابك" />
        <BilingualInput labelEn="Subtitle" labelAr="العنوان الفرعي" valueEn={signupData.subtitle_en || ''} valueAr={signupData.subtitle_ar || ''} onChangeEn={(v) => updateField('signup_page', 'subtitle_en', v)} onChangeAr={(v) => updateField('signup_page', 'subtitle_ar', v)} placeholderEn="Join the BIKERZ community" placeholderAr="انضم إلى مجتمع بايكرز" />
        <BilingualInput labelEn="Signup Button Text" labelAr="نص زر التسجيل" valueEn={signupData.button_en || ''} valueAr={signupData.button_ar || ''} onChangeEn={(v) => updateField('signup_page', 'button_en', v)} onChangeAr={(v) => updateField('signup_page', 'button_ar', v)} placeholderEn="Create Account" placeholderAr="إنشاء حساب" />
        <BilingualInput labelEn="Full Name Label" labelAr="تسمية الاسم الكامل" valueEn={signupData.name_label_en || ''} valueAr={signupData.name_label_ar || ''} onChangeEn={(v) => updateField('signup_page', 'name_label_en', v)} onChangeAr={(v) => updateField('signup_page', 'name_label_ar', v)} placeholderEn="Full Name" placeholderAr="الاسم الكامل" />
        <BilingualInput labelEn="Email Label" labelAr="تسمية البريد" valueEn={signupData.email_label_en || ''} valueAr={signupData.email_label_ar || ''} onChangeEn={(v) => updateField('signup_page', 'email_label_en', v)} onChangeAr={(v) => updateField('signup_page', 'email_label_ar', v)} placeholderEn="Email Address" placeholderAr="البريد الإلكتروني" />
        <BilingualInput labelEn="Password Label" labelAr="تسمية كلمة المرور" valueEn={signupData.password_label_en || ''} valueAr={signupData.password_label_ar || ''} onChangeEn={(v) => updateField('signup_page', 'password_label_en', v)} onChangeAr={(v) => updateField('signup_page', 'password_label_ar', v)} placeholderEn="Password" placeholderAr="كلمة المرور" />
        <BilingualInput labelEn="Confirm Password Label" labelAr="تسمية تأكيد كلمة المرور" valueEn={signupData.confirm_label_en || ''} valueAr={signupData.confirm_label_ar || ''} onChangeEn={(v) => updateField('signup_page', 'confirm_label_en', v)} onChangeAr={(v) => updateField('signup_page', 'confirm_label_ar', v)} placeholderEn="Confirm Password" placeholderAr="تأكيد كلمة المرور" />
        <BilingualInput labelEn="Has Account Text" labelAr="نص لديك حساب" valueEn={signupData.has_account_en || ''} valueAr={signupData.has_account_ar || ''} onChangeEn={(v) => updateField('signup_page', 'has_account_en', v)} onChangeAr={(v) => updateField('signup_page', 'has_account_ar', v)} placeholderEn="Already have an account?" placeholderAr="لديك حساب بالفعل؟" />
        <BilingualInput labelEn="Login Link Text" labelAr="نص رابط الدخول" valueEn={signupData.login_link_en || ''} valueAr={signupData.login_link_ar || ''} onChangeEn={(v) => updateField('signup_page', 'login_link_en', v)} onChangeAr={(v) => updateField('signup_page', 'login_link_ar', v)} placeholderEn="Sign in" placeholderAr="تسجيل الدخول" />
        <ImageUploader value={signupData.image || ''} onChange={(url) => updateField('signup_page', 'image', url)} label={isRTL ? 'صورة الخلفية' : 'Background Image'} bucket="course-thumbnails" folder="auth" />
      </div>
    );
  };

  const renderSectionContent = (key: string) => {
    switch (key) {
      case 'header': return renderHeaderSection();
      case 'hero': return renderHeroSection();
      case 'why': return renderWhySection();
      case 'journey': return renderJourneySection();
      case 'learn': return renderLearnSection();
      case 'cta': return renderCTASection();
      case 'community': return renderCommunitySection();
      case 'footer': return renderFooterSection();
      case 'about_page': return renderAboutPageSection();
      case 'privacy_page': return renderPrivacyPageSection();
      case 'terms_page': return renderTermsPageSection();
      case 'contact_page': return renderContactPageSection();
      case 'login_page': return renderLoginPageSection();
      case 'signup_page': return renderSignupPageSection();
      default: return null;
    }
  };

  const allSections = [...mainSections, ...pageSections];
  const currentSection = allSections.find(s => s.key === activeSection);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
        {/* Header - Fixed */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? 'إدارة محتوى الصفحة الرئيسية' : 'Landing Page Content'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isRTL ? 'قم بتحرير جميع النصوص والمحتوى في الصفحة الرئيسية' : 'Edit all text and content on the landing page'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasChanges && (
              <Badge variant="outline" className="text-destructive border-destructive">
                {isRTL ? 'تغييرات غير محفوظة' : 'Unsaved Changes'}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <>
                  <PanelLeftClose className="w-4 h-4 me-2" />
                  <span className="hidden sm:inline">{isRTL ? 'إخفاء المعاينة' : 'Hide Preview'}</span>
                </>
              ) : (
                <>
                  <PanelLeft className="w-4 h-4 me-2" />
                  <span className="hidden sm:inline">{isRTL ? 'إظهار المعاينة' : 'Show Preview'}</span>
                </>
              )}
            </Button>
            <Button variant="outline" asChild>
              <a href="/" target="_blank" rel="noopener noreferrer">
                <Eye className="w-4 h-4 me-2" />
                <span className="hidden sm:inline">{isRTL ? 'معاينة' : 'Preview'}</span>
              </a>
            </Button>
            <Button onClick={handleSaveAll} disabled={updateMutation.isPending || !hasChanges}>
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 me-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 me-2" />
              )}
              {isRTL ? 'حفظ الكل' : 'Save All'}
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
          {/* Vertical Sidebar Navigation */}
          <div className="w-[220px] flex-shrink-0 border-e border-border bg-muted/30 overflow-y-auto">
            <div className="py-2">
              {/* Main Sections */}
              <div className="px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isRTL ? 'الأقسام' : 'Sections'}
                </span>
              </div>
              {mainSections.map(section => (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 text-start transition-colors ${
                    activeSection === section.key
                      ? 'bg-primary/10 text-primary border-e-2 border-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <section.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{section.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{section.desc}</div>
                  </div>
                </button>
              ))}

              {/* Pages Group */}
              <Collapsible open={pagesOpen} onOpenChange={setPagesOpen}>
                <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 mt-2 text-start">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
                    {isRTL ? 'الصفحات' : 'Pages'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${pagesOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {pageSections.map(section => (
                    <button
                      key={section.key}
                      onClick={() => { setActiveSection(section.key); setPagesOpen(true); }}
                      className={`w-full flex items-start gap-3 px-3 ps-6 py-2 text-start transition-colors ${
                        activeSection === section.key
                          ? 'bg-primary/10 text-primary border-e-2 border-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <section.icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{section.label}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{section.desc}</div>
                      </div>
                    </button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          {/* Editor Panel */}
          <div className={`flex flex-col min-h-0 overflow-hidden flex-1 ${showPreview ? 'w-1/2' : ''}`}>
            {currentSection && (
              <Card className="h-full flex flex-col overflow-hidden rounded-none border-0 border-e">
                <CardHeader className="flex-shrink-0 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {React.createElement(currentSection.icon, { className: "w-5 h-5" })}
                        {currentSection.label}
                      </CardTitle>
                      <CardDescription>
                        {isRTL 
                          ? 'قم بتحرير المحتوى باللغتين العربية والإنجليزية'
                          : 'Edit content in both English and Arabic'
                        }
                      </CardDescription>
                    </div>
                    <Button onClick={() => handleSave(activeSection)} disabled={updateMutation.isPending} size="sm">
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full px-6 pb-6">
                    {renderSectionContent(activeSection)}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Live Preview Panel */}
          {showPreview && (
            <div className="w-1/2 flex-shrink-0 min-h-0 overflow-hidden">
              <LivePreview className="h-full" />
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminContent;
