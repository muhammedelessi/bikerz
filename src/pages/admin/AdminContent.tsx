import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Save, Loader2, Eye, Home, Target, Route, BookOpen, Megaphone, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

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

  const handleSaveAll = () => {
    Object.keys(editedContent).forEach(key => {
      updateMutation.mutate({ key, value: editedContent[key] });
    });
  };

  const updateField = (section: string, path: string[], value: string) => {
    setEditedContent(prev => {
      const sectionData = JSON.parse(JSON.stringify(prev[section] || {}));
      let current = sectionData;
      
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (typeof current[key] !== 'object' || current[key] === null) {
          current[key] = {};
        }
        current = current[key];
      }
      
      current[path[path.length - 1]] = value;
      
      return { ...prev, [section]: sectionData };
    });
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
  };

  const sections = [
    { key: 'hero', icon: Home, label: isRTL ? 'القسم الرئيسي' : 'Hero Section' },
    { key: 'why', icon: Target, label: isRTL ? 'لماذا نحن' : 'Why Us' },
    { key: 'journey', icon: Route, label: isRTL ? 'رحلة التعلم' : 'Journey' },
    { key: 'learn', icon: BookOpen, label: isRTL ? 'ما ستتعلمه' : 'What You Learn' },
    { key: 'cta', icon: Megaphone, label: isRTL ? 'دعوة للعمل' : 'Call to Action' },
    { key: 'community', icon: Users, label: isRTL ? 'المجتمع' : 'Community' },
  ];

  const renderField = (
    section: string,
    fieldKey: string,
    labelEn: string,
    labelAr: string,
    isTextarea = false
  ) => {
    const sectionData = editedContent[section] as Record<string, string> | undefined;
    const valueEn = sectionData?.[`${fieldKey}_en`] || '';
    const valueAr = sectionData?.[`${fieldKey}_ar`] || '';

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{labelEn} (English)</Label>
          {isTextarea ? (
            <Textarea
              value={valueEn}
              onChange={(e) => updateField(section, [`${fieldKey}_en`], e.target.value)}
              className="min-h-[100px]"
              dir="ltr"
            />
          ) : (
            <Input
              value={valueEn}
              onChange={(e) => updateField(section, [`${fieldKey}_en`], e.target.value)}
              dir="ltr"
            />
          )}
        </div>
        <div className="space-y-2">
          <Label>{labelAr} (العربية)</Label>
          {isTextarea ? (
            <Textarea
              value={valueAr}
              onChange={(e) => updateField(section, [`${fieldKey}_ar`], e.target.value)}
              className="min-h-[100px]"
              dir="rtl"
            />
          ) : (
            <Input
              value={valueAr}
              onChange={(e) => updateField(section, [`${fieldKey}_ar`], e.target.value)}
              dir="rtl"
            />
          )}
        </div>
      </div>
    );
  };

  const renderHeroSection = () => (
    <div className="space-y-6">
      {renderField('hero', 'title', 'Title', 'العنوان')}
      {renderField('hero', 'subtitle', 'Subtitle', 'العنوان الفرعي', true)}
      {renderField('hero', 'cta', 'Primary Button', 'الزر الرئيسي')}
      {renderField('hero', 'secondary_cta', 'Secondary Button', 'الزر الثانوي')}
      {renderField('hero', 'badge_text', 'Badge Text', 'نص الشارة')}
    </div>
  );

  const renderWhySection = () => {
    const whyData = editedContent.why as { 
      title_en?: string; 
      title_ar?: string; 
      subtitle_en?: string; 
      subtitle_ar?: string;
      cards?: Array<{ title_en: string; title_ar: string; description_en: string; description_ar: string; icon: string }>;
    } | undefined;
    const cards = whyData?.cards || [];

    return (
      <div className="space-y-6">
        {renderField('why', 'title', 'Section Title', 'عنوان القسم')}
        {renderField('why', 'subtitle', 'Section Subtitle', 'العنوان الفرعي للقسم', true)}
        
        <div className="space-y-4">
          <Label className="text-lg font-semibold">{isRTL ? 'البطاقات' : 'Cards'}</Label>
          <Accordion type="multiple" className="w-full">
            {cards.map((card, index) => (
              <AccordionItem key={index} value={`card-${index}`}>
                <AccordionTrigger>
                  {isRTL ? `البطاقة ${index + 1}: ${card.title_ar || card.title_en}` : `Card ${index + 1}: ${card.title_en || card.title_ar}`}
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Title (English)</Label>
                      <Input
                        value={card.title_en}
                        onChange={(e) => updateArrayItem('why', 'cards', index, 'title_en', e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>العنوان (العربية)</Label>
                      <Input
                        value={card.title_ar}
                        onChange={(e) => updateArrayItem('why', 'cards', index, 'title_ar', e.target.value)}
                        dir="rtl"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Description (English)</Label>
                      <Textarea
                        value={card.description_en}
                        onChange={(e) => updateArrayItem('why', 'cards', index, 'description_en', e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الوصف (العربية)</Label>
                      <Textarea
                        value={card.description_ar}
                        onChange={(e) => updateArrayItem('why', 'cards', index, 'description_ar', e.target.value)}
                        dir="rtl"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    );
  };

  const renderJourneySection = () => {
    const journeyData = editedContent.journey as {
      title_en?: string;
      title_ar?: string;
      subtitle_en?: string;
      subtitle_ar?: string;
      steps?: Array<{ number: string; title_en: string; title_ar: string; description_en: string; description_ar: string; icon: string }>;
    } | undefined;
    const steps = journeyData?.steps || [];

    return (
      <div className="space-y-6">
        {renderField('journey', 'title', 'Section Title', 'عنوان القسم')}
        {renderField('journey', 'subtitle', 'Section Subtitle', 'العنوان الفرعي للقسم', true)}
        
        <div className="space-y-4">
          <Label className="text-lg font-semibold">{isRTL ? 'خطوات الرحلة' : 'Journey Steps'}</Label>
          <Accordion type="multiple" className="w-full">
            {steps.map((step, index) => (
              <AccordionItem key={index} value={`step-${index}`}>
                <AccordionTrigger>
                  {isRTL ? `الخطوة ${step.number}: ${step.title_ar || step.title_en}` : `Step ${step.number}: ${step.title_en || step.title_ar}`}
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Title (English)</Label>
                      <Input
                        value={step.title_en}
                        onChange={(e) => updateArrayItem('journey', 'steps', index, 'title_en', e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>العنوان (العربية)</Label>
                      <Input
                        value={step.title_ar}
                        onChange={(e) => updateArrayItem('journey', 'steps', index, 'title_ar', e.target.value)}
                        dir="rtl"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Description (English)</Label>
                      <Textarea
                        value={step.description_en}
                        onChange={(e) => updateArrayItem('journey', 'steps', index, 'description_en', e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الوصف (العربية)</Label>
                      <Textarea
                        value={step.description_ar}
                        onChange={(e) => updateArrayItem('journey', 'steps', index, 'description_ar', e.target.value)}
                        dir="rtl"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    );
  };

  const renderLearnSection = () => {
    const learnData = editedContent.learn as {
      title_en?: string;
      title_ar?: string;
      subtitle_en?: string;
      subtitle_ar?: string;
      skills?: Array<{ key: string; text_en: string; text_ar: string; icon: string }>;
    } | undefined;
    const skills = learnData?.skills || [];

    return (
      <div className="space-y-6">
        {renderField('learn', 'title', 'Section Title', 'عنوان القسم')}
        {renderField('learn', 'subtitle', 'Section Subtitle', 'العنوان الفرعي للقسم', true)}
        
        <div className="space-y-4">
          <Label className="text-lg font-semibold">{isRTL ? 'المهارات' : 'Skills'}</Label>
          <div className="grid gap-4 sm:grid-cols-2">
            {skills.map((skill, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{isRTL ? `المهارة ${index + 1}` : `Skill ${index + 1}`}</span>
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="English"
                      value={skill.text_en}
                      onChange={(e) => updateArrayItem('learn', 'skills', index, 'text_en', e.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="العربية"
                      value={skill.text_ar}
                      onChange={(e) => updateArrayItem('learn', 'skills', index, 'text_ar', e.target.value)}
                      dir="rtl"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCTASection = () => {
    const ctaData = editedContent.cta as {
      title_en?: string;
      title_ar?: string;
      subtitle_en?: string;
      subtitle_ar?: string;
      button_en?: string;
      button_ar?: string;
      trust_badges?: Array<{ text_en: string; text_ar: string }>;
    } | undefined;
    const trustBadges = ctaData?.trust_badges || [];

    return (
      <div className="space-y-6">
        {renderField('cta', 'title', 'Title', 'العنوان')}
        {renderField('cta', 'subtitle', 'Subtitle', 'العنوان الفرعي', true)}
        {renderField('cta', 'button', 'Button Text', 'نص الزر')}
        
        <div className="space-y-4">
          <Label className="text-lg font-semibold">{isRTL ? 'شارات الثقة' : 'Trust Badges'}</Label>
          <div className="grid gap-4 sm:grid-cols-3">
            {trustBadges.map((badge, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {isRTL ? `الشارة ${index + 1}` : `Badge ${index + 1}`}
                  </div>
                  <Input
                    placeholder="English"
                    value={badge.text_en}
                    onChange={(e) => updateArrayItem('cta', 'trust_badges', index, 'text_en', e.target.value)}
                    dir="ltr"
                  />
                  <Input
                    placeholder="العربية"
                    value={badge.text_ar}
                    onChange={(e) => updateArrayItem('cta', 'trust_badges', index, 'text_ar', e.target.value)}
                    dir="rtl"
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCommunitySection = () => (
    <div className="space-y-6">
      {renderField('community', 'title', 'Section Title', 'عنوان القسم')}
      {renderField('community', 'subtitle', 'Section Subtitle', 'العنوان الفرعي للقسم', true)}
    </div>
  );

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? 'إدارة محتوى الصفحة الرئيسية' : 'Landing Page Content'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isRTL ? 'قم بتحرير جميع النصوص والمحتوى في الصفحة الرئيسية' : 'Edit all text and content on the landing page'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href="/" target="_blank" rel="noopener noreferrer">
                <Eye className="w-4 h-4 me-2" />
                {isRTL ? 'معاينة' : 'Preview'}
              </a>
            </Button>
            <Button onClick={handleSaveAll} disabled={updateMutation.isPending}>
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
        <Tabs value={activeSection} onValueChange={setActiveSection}>
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            {sections.map(section => (
              <TabsTrigger key={section.key} value={section.key} className="flex items-center gap-2">
                <section.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{section.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {sections.map(section => (
            <TabsContent key={section.key} value={section.key}>
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
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminContent;
