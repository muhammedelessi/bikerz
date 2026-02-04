import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Save, Loader2, Eye, Home, Target, Route, BookOpen, Megaphone, Users,
  Settings2, Palette, Link2, LayoutGrid, Type, MousePointer,
  Sparkles, RefreshCw, PanelLeftClose, PanelLeft
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

const AdminContent: React.FC = () => {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [editedContent, setEditedContent] = useState<Record<string, ContentValue>>({});
  const [activeSection, setActiveSection] = useState('hero');
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
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)
        .eq('category', 'landing');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-landing-content'] });
      queryClient.invalidateQueries({ queryKey: ['landing-content'] });
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

  const updateField = (section: string, field: string, value: string) => {
    setEditedContent(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
    setHasChanges(true);
  };

  const updateArrayItem = (section: string, arrayKey: string, index: number, field: string, value: string) => {
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

  const sections = [
    { key: 'hero', icon: Home, label: isRTL ? 'القسم الرئيسي' : 'Hero Section' },
    { key: 'why', icon: Target, label: isRTL ? 'لماذا نحن' : 'Why Us' },
    { key: 'journey', icon: Route, label: isRTL ? 'رحلة التعلم' : 'Journey' },
    { key: 'learn', icon: BookOpen, label: isRTL ? 'ما ستتعلمه' : 'What You Learn' },
    { key: 'cta', icon: Megaphone, label: isRTL ? 'دعوة للعمل' : 'Call to Action' },
    { key: 'community', icon: Users, label: isRTL ? 'المجتمع' : 'Community' },
  ];

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

        {/* Stats Labels */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'تسميات الإحصائيات' : 'Stats Labels'}</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
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
          />
        </div>

        <Separator />

        {/* Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">{isRTL ? 'البطاقات' : 'Feature Cards'}</h3>
            </div>
            <Badge variant="secondary">{cards.length} / 6</Badge>
          </div>

          <SortableList
            items={cards}
            onReorder={(newCards) => updateArray('why', 'cards', newCards)}
            onAdd={() => addArrayItem('why', 'cards', cardTemplate)}
            onRemove={(index) => removeArrayItem('why', 'cards', index)}
            addLabel={isRTL ? 'إضافة بطاقة' : 'Add Card'}
            minItems={1}
            maxItems={6}
            renderItem={(card: ContentValue, index: number) => (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <IconSelector
                      value={card.icon || 'Shield'}
                      onChange={(icon) => updateArrayItem('why', 'cards', index, 'icon', icon)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Background Image (optional)</Label>
                    <Input
                      value={card.image || ''}
                      onChange={(e) => updateArrayItem('why', 'cards', index, 'image', e.target.value)}
                      placeholder="Image URL"
                    />
                  </div>
                </div>

                <BilingualInput
                  labelEn="Title"
                  labelAr="العنوان"
                  valueEn={card.title_en || ''}
                  valueAr={card.title_ar || ''}
                  onChangeEn={(v) => updateArrayItem('why', 'cards', index, 'title_en', v)}
                  onChangeAr={(v) => updateArrayItem('why', 'cards', index, 'title_ar', v)}
                />

                <BilingualInput
                  labelEn="Description"
                  labelAr="الوصف"
                  valueEn={card.description_en || ''}
                  valueAr={card.description_ar || ''}
                  onChangeEn={(v) => updateArrayItem('why', 'cards', index, 'description_en', v)}
                  onChangeAr={(v) => updateArrayItem('why', 'cards', index, 'description_ar', v)}
                  isTextarea
                  rows={2}
                />
              </div>
            )}
          />
        </div>

        <Separator />

        {/* Layout Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'إعدادات التخطيط' : 'Layout Settings'}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Columns (Desktop)</Label>
              <Input
                type="number"
                min="1"
                max="4"
                value={whyData.columns_desktop || '2'}
                onChange={(e) => updateField('why', 'columns_desktop', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Columns (Tablet)</Label>
              <Input
                type="number"
                min="1"
                max="3"
                value={whyData.columns_tablet || '2'}
                onChange={(e) => updateField('why', 'columns_tablet', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Columns (Mobile)</Label>
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
      </div>
    );
  };

  // ============= JOURNEY SECTION EDITOR =============
  const renderJourneySection = () => {
    const journeyData = editedContent.journey || {};
    const steps = journeyData.steps || [];

    const stepTemplate = {
      number: `0${steps.length + 1}`,
      title_en: 'New Step',
      title_ar: 'خطوة جديدة',
      description_en: 'Description here',
      description_ar: 'الوصف هنا',
      icon: 'Route',
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
          />
        </div>

        <Separator />

        {/* Steps */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">{isRTL ? 'خطوات الرحلة' : 'Journey Steps'}</h3>
            </div>
            <Badge variant="secondary">{steps.length} / 8</Badge>
          </div>

          <SortableList
            items={steps}
            onReorder={(newSteps) => updateArray('journey', 'steps', newSteps)}
            onAdd={() => addArrayItem('journey', 'steps', stepTemplate)}
            onRemove={(index) => removeArrayItem('journey', 'steps', index)}
            addLabel={isRTL ? 'إضافة خطوة' : 'Add Step'}
            minItems={2}
            maxItems={8}
            renderItem={(step: ContentValue, index: number) => (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Step Number</Label>
                    <Input
                      value={step.number || `0${index + 1}`}
                      onChange={(e) => updateArrayItem('journey', 'steps', index, 'number', e.target.value)}
                      placeholder="01"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Icon</Label>
                    <IconSelector
                      value={step.icon || 'Route'}
                      onChange={(icon) => updateArrayItem('journey', 'steps', index, 'icon', icon)}
                    />
                  </div>
                </div>

                <BilingualInput
                  labelEn="Step Title"
                  labelAr="عنوان الخطوة"
                  valueEn={step.title_en || ''}
                  valueAr={step.title_ar || ''}
                  onChangeEn={(v) => updateArrayItem('journey', 'steps', index, 'title_en', v)}
                  onChangeAr={(v) => updateArrayItem('journey', 'steps', index, 'title_ar', v)}
                />

                <BilingualInput
                  labelEn="Step Description"
                  labelAr="وصف الخطوة"
                  valueEn={step.description_en || ''}
                  valueAr={step.description_ar || ''}
                  onChangeEn={(v) => updateArrayItem('journey', 'steps', index, 'description_en', v)}
                  onChangeAr={(v) => updateArrayItem('journey', 'steps', index, 'description_ar', v)}
                  isTextarea
                  rows={2}
                />
              </div>
            )}
          />
        </div>

        <Separator />

        {/* Visual Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'الإعدادات المرئية' : 'Visual Settings'}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={journeyData.show_timeline !== false}
                onCheckedChange={(v) => updateField('journey', 'show_timeline', v.toString())}
              />
              <Label>{isRTL ? 'إظهار الخط الزمني' : 'Show Timeline'}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={journeyData.alternate_layout !== false}
                onCheckedChange={(v) => updateField('journey', 'alternate_layout', v.toString())}
              />
              <Label>{isRTL ? 'تخطيط متناوب' : 'Alternate Layout'}</Label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============= LEARN SECTION EDITOR =============
  const renderLearnSection = () => {
    const learnData = editedContent.learn || {};
    const skills = learnData.skills || [];

    const skillTemplate = {
      key: `skill_${Date.now()}`,
      text_en: 'New Skill',
      text_ar: 'مهارة جديدة',
      icon: 'CheckCircle2',
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
          />
        </div>

        <Separator />

        {/* Skills */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">{isRTL ? 'المهارات' : 'Skills'}</h3>
            </div>
            <Badge variant="secondary">{skills.length} / 12</Badge>
          </div>

          <SortableList
            items={skills}
            onReorder={(newSkills) => updateArray('learn', 'skills', newSkills)}
            onAdd={() => addArrayItem('learn', 'skills', skillTemplate)}
            onRemove={(index) => removeArrayItem('learn', 'skills', index)}
            addLabel={isRTL ? 'إضافة مهارة' : 'Add Skill'}
            minItems={4}
            maxItems={12}
            renderItem={(skill: ContentValue, index: number) => (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Key (unique)</Label>
                    <Input
                      value={skill.key || ''}
                      onChange={(e) => updateArrayItem('learn', 'skills', index, 'key', e.target.value)}
                      placeholder="skill_key"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Icon</Label>
                    <IconSelector
                      value={skill.icon || 'CheckCircle2'}
                      onChange={(icon) => updateArrayItem('learn', 'skills', index, 'icon', icon)}
                    />
                  </div>
                </div>

                <BilingualInput
                  labelEn="Skill Text"
                  labelAr="نص المهارة"
                  valueEn={skill.text_en || ''}
                  valueAr={skill.text_ar || ''}
                  onChangeEn={(v) => updateArrayItem('learn', 'skills', index, 'text_en', v)}
                  onChangeAr={(v) => updateArrayItem('learn', 'skills', index, 'text_ar', v)}
                />
              </div>
            )}
          />
        </div>

        <Separator />

        {/* Grid Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'إعدادات الشبكة' : 'Grid Settings'}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Columns (Desktop)</Label>
              <Input
                type="number"
                min="2"
                max="6"
                value={learnData.columns_desktop || '4'}
                onChange={(e) => updateField('learn', 'columns_desktop', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Columns (Tablet)</Label>
              <Input
                type="number"
                min="2"
                max="4"
                value={learnData.columns_tablet || '2'}
                onChange={(e) => updateField('learn', 'columns_tablet', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Columns (Mobile)</Label>
              <Input
                type="number"
                min="1"
                max="2"
                value={learnData.columns_mobile || '2'}
                onChange={(e) => updateField('learn', 'columns_mobile', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============= CTA SECTION EDITOR =============
  const renderCTASection = () => {
    const ctaData = editedContent.cta || {};
    const trustBadges = ctaData.trust_badges || [];

    const badgeTemplate = {
      text_en: 'New Badge',
      text_ar: 'شارة جديدة',
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
            labelEn="Title"
            labelAr="العنوان"
            valueEn={ctaData.title_en || ''}
            valueAr={ctaData.title_ar || ''}
            onChangeEn={(v) => updateField('cta', 'title_en', v)}
            onChangeAr={(v) => updateField('cta', 'title_ar', v)}
          />

          <BilingualInput
            labelEn="Subtitle"
            labelAr="العنوان الفرعي"
            valueEn={ctaData.subtitle_en || ''}
            valueAr={ctaData.subtitle_ar || ''}
            onChangeEn={(v) => updateField('cta', 'subtitle_en', v)}
            onChangeAr={(v) => updateField('cta', 'subtitle_ar', v)}
            isTextarea
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
              <Label>Icon</Label>
              <IconSelector
                value={ctaData.icon || 'Sparkles'}
                onChange={(icon) => updateField('cta', 'icon', icon)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Trust Badges */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">{isRTL ? 'شارات الثقة' : 'Trust Badges'}</h3>
            </div>
            <Badge variant="secondary">{trustBadges.length} / 5</Badge>
          </div>

          <SortableList
            items={trustBadges}
            onReorder={(newBadges) => updateArray('cta', 'trust_badges', newBadges)}
            onAdd={() => addArrayItem('cta', 'trust_badges', badgeTemplate)}
            onRemove={(index) => removeArrayItem('cta', 'trust_badges', index)}
            addLabel={isRTL ? 'إضافة شارة' : 'Add Badge'}
            minItems={1}
            maxItems={5}
            renderItem={(badge: ContentValue, index: number) => (
              <BilingualInput
                labelEn="Badge Text"
                labelAr="نص الشارة"
                valueEn={badge.text_en || ''}
                valueAr={badge.text_ar || ''}
                onChangeEn={(v) => updateArrayItem('cta', 'trust_badges', index, 'text_en', v)}
                onChangeAr={(v) => updateArrayItem('cta', 'trust_badges', index, 'text_ar', v)}
              />
            )}
          />
        </div>

        <Separator />

        {/* Visual Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{isRTL ? 'الإعدادات المرئية' : 'Visual Settings'}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={ctaData.show_glow !== false}
                onCheckedChange={(v) => updateField('cta', 'show_glow', v.toString())}
              />
              <Label>{isRTL ? 'تأثير التوهج' : 'Glow Effect'}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={ctaData.animate_background !== false}
                onCheckedChange={(v) => updateField('cta', 'animate_background', v.toString())}
              />
              <Label>{isRTL ? 'خلفية متحركة' : 'Animate Background'}</Label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============= COMMUNITY SECTION EDITOR =============
  const renderCommunitySection = () => {
    const communityData = editedContent.community || {};

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
            <Card className="p-4 space-y-3">
              <Label className="font-medium">Members Stat</Label>
              <Input
                placeholder="English label"
                value={communityData.stat1_label_en || 'Community Members'}
                onChange={(e) => updateField('community', 'stat1_label_en', e.target.value)}
              />
              <Input
                placeholder="Arabic label"
                value={communityData.stat1_label_ar || 'عضو في المجتمع'}
                onChange={(e) => updateField('community', 'stat1_label_ar', e.target.value)}
                dir="rtl"
              />
            </Card>

            <Card className="p-4 space-y-3">
              <Label className="font-medium">Active Learners Stat</Label>
              <Input
                placeholder="English label"
                value={communityData.stat2_label_en || 'Active Learners'}
                onChange={(e) => updateField('community', 'stat2_label_en', e.target.value)}
              />
              <Input
                placeholder="Arabic label"
                value={communityData.stat2_label_ar || 'متعلم نشط'}
                onChange={(e) => updateField('community', 'stat2_label_ar', e.target.value)}
                dir="rtl"
              />
            </Card>

            <Card className="p-4 space-y-3">
              <Label className="font-medium">Success Rate Stat</Label>
              <Input
                placeholder="English label"
                value={communityData.stat3_label_en || 'Success Rate'}
                onChange={(e) => updateField('community', 'stat3_label_en', e.target.value)}
              />
              <Input
                placeholder="Arabic label"
                value={communityData.stat3_label_ar || 'معدل النجاح'}
                onChange={(e) => updateField('community', 'stat3_label_ar', e.target.value)}
                dir="rtl"
              />
            </Card>

            <Card className="p-4 space-y-3">
              <Label className="font-medium">Lessons Stat</Label>
              <Input
                placeholder="English label"
                value={communityData.stat4_label_en || 'Video Lessons'}
                onChange={(e) => updateField('community', 'stat4_label_en', e.target.value)}
              />
              <Input
                placeholder="Arabic label"
                value={communityData.stat4_label_ar || 'درس فيديو'}
                onChange={(e) => updateField('community', 'stat4_label_ar', e.target.value)}
                dir="rtl"
              />
            </Card>
          </div>
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

  const renderSectionContent = (key: string) => {
    switch (key) {
      case 'hero': return renderHeroSection();
      case 'why': return renderWhySection();
      case 'journey': return renderJourneySection();
      case 'learn': return renderLearnSection();
      case 'cta': return renderCTASection();
      case 'community': return renderCommunitySection();
      default: return null;
    }
  };

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
      <div className="flex gap-6 h-[calc(100vh-theme(spacing.16))]">
        {/* Main Editor */}
        <div className={`flex-1 space-y-6 overflow-hidden ${showPreview ? 'w-1/2' : 'w-full'}`}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isRTL ? 'إدارة محتوى الصفحة الرئيسية' : 'Landing Page Content'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isRTL ? 'قم بتحرير جميع النصوص والمحتوى في الصفحة الرئيسية' : 'Edit all text and content on the landing page'}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
                    {isRTL ? 'إخفاء المعاينة' : 'Hide Preview'}
                  </>
                ) : (
                  <>
                    <PanelLeft className="w-4 h-4 me-2" />
                    {isRTL ? 'إظهار المعاينة' : 'Show Preview'}
                  </>
                )}
              </Button>
              <Button variant="outline" asChild>
                <a href="/" target="_blank" rel="noopener noreferrer">
                  <Eye className="w-4 h-4 me-2" />
                  {isRTL ? 'معاينة' : 'Preview'}
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

          {/* Content Editor */}
          <Tabs value={activeSection} onValueChange={setActiveSection} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 flex-shrink-0">
              {sections.map(section => (
                <TabsTrigger key={section.key} value={section.key} className="flex items-center gap-2">
                  <section.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{section.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              {sections.map(section => (
                <TabsContent key={section.key} value={section.key} className="m-0">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <section.icon className="w-5 h-5" />
                            {section.label}
                          </CardTitle>
                          <CardDescription>
                            {isRTL 
                              ? 'قم بتحرير المحتوى باللغتين العربية والإنجليزية'
                              : 'Edit content in both English and Arabic'
                            }
                          </CardDescription>
                        </div>
                        <Button onClick={() => handleSave(section.key)} disabled={updateMutation.isPending} size="sm">
                          {updateMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {renderSectionContent(section.key)}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>
        </div>

        {/* Live Preview Panel */}
        {showPreview && (
          <div className="w-1/2 flex-shrink-0">
            <LivePreview className="h-full" />
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminContent;
