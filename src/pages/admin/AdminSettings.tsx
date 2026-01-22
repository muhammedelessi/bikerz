import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Settings,
  Globe,
  Palette,
  Shield,
  Bell,
  DollarSign,
  FileText,
  Save,
  Upload,
  RefreshCw,
} from 'lucide-react';

const AdminSettings = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  // Local state for settings
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'BIKERZ Academy',
    siteNameAr: 'أكاديمية بايكرز',
    siteDescription: 'Learn to ride safely',
    siteDescriptionAr: 'تعلم القيادة بأمان',
    supportEmail: 'support@bikerz.com',
    supportPhone: '+966 50 000 0000',
  });

  const [paymentSettings, setPaymentSettings] = useState({
    currency: 'SAR',
    vatEnabled: true,
    vatPercentage: 15,
    bankName: '',
    bankAccountNumber: '',
    bankIBAN: '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    enrollmentAlerts: true,
    paymentAlerts: true,
    completionAlerts: true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: { category: string; key: string; value: any }) => {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          category: settings.category,
          key: settings.key,
          value: settings.value,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: isRTL ? 'تم الحفظ' : 'Saved',
        description: isRTL ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في حفظ الإعدادات' : 'Failed to save settings',
      });
    },
  });

  const handleSaveGeneral = async () => {
    await saveSettingsMutation.mutateAsync({
      category: 'general',
      key: 'site_settings',
      value: generalSettings,
    });
    logAction({
      action: 'settings_updated',
      entityType: 'settings',
      entityId: 'site_settings',
      newData: generalSettings,
    });
  };

  const handleSavePayment = async () => {
    await saveSettingsMutation.mutateAsync({
      category: 'payment',
      key: 'payment_settings',
      value: paymentSettings,
    });
    logAction({
      action: 'settings_updated',
      entityType: 'settings',
      entityId: 'payment_settings',
      newData: paymentSettings,
    });
  };

  const handleSaveNotifications = async () => {
    await saveSettingsMutation.mutateAsync({
      category: 'notifications',
      key: 'notification_settings',
      value: notificationSettings,
    });
    logAction({
      action: 'settings_updated',
      entityType: 'settings',
      entityId: 'notification_settings',
      newData: notificationSettings,
    });
  };

  const handleSaveSecurity = async () => {
    await saveSettingsMutation.mutateAsync({
      category: 'security',
      key: 'security_settings',
      value: securitySettings,
    });
    logAction({
      action: 'settings_updated',
      entityType: 'settings',
      entityId: 'security_settings',
      newData: securitySettings,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isRTL ? 'إعدادات النظام' : 'System Settings'}
          </h1>
          <p className="text-muted-foreground">
            {isRTL ? 'إدارة إعدادات وتكوين الأكاديمية' : 'Manage academy settings and configuration'}
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'عام' : 'General'}</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'المدفوعات' : 'Payment'}</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'الإشعارات' : 'Notifications'}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'الأمان' : 'Security'}</span>
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'الإعدادات العامة' : 'General Settings'}</CardTitle>
                <CardDescription>
                  {isRTL ? 'إعدادات الموقع الأساسية والعلامة التجارية' : 'Basic site settings and branding'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? 'اسم الموقع (إنجليزي)' : 'Site Name (English)'}</Label>
                    <Input
                      value={generalSettings.siteName}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, siteName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'اسم الموقع (عربي)' : 'Site Name (Arabic)'}</Label>
                    <Input
                      value={generalSettings.siteNameAr}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, siteNameAr: e.target.value })}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? 'وصف الموقع (إنجليزي)' : 'Site Description (English)'}</Label>
                    <Textarea
                      value={generalSettings.siteDescription}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, siteDescription: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'وصف الموقع (عربي)' : 'Site Description (Arabic)'}</Label>
                    <Textarea
                      value={generalSettings.siteDescriptionAr}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, siteDescriptionAr: e.target.value })}
                      rows={3}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? 'بريد الدعم' : 'Support Email'}</Label>
                    <Input
                      type="email"
                      value={generalSettings.supportEmail}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'هاتف الدعم' : 'Support Phone'}</Label>
                    <Input
                      value={generalSettings.supportPhone}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, supportPhone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveGeneral} disabled={saveSettingsMutation.isPending}>
                    <Save className="w-4 h-4 me-2" />
                    {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Settings */}
          <TabsContent value="payment">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'إعدادات المدفوعات' : 'Payment Settings'}</CardTitle>
                <CardDescription>
                  {isRTL ? 'إعدادات العملة والضرائب والحسابات البنكية' : 'Currency, tax, and bank account settings'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? 'العملة الافتراضية' : 'Default Currency'}</Label>
                    <Select
                      value={paymentSettings.currency}
                      onValueChange={(value) => setPaymentSettings({ ...paymentSettings, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                        <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'تفعيل الضريبة' : 'Enable VAT'}</Label>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch
                        checked={paymentSettings.vatEnabled}
                        onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, vatEnabled: checked })}
                      />
                      <span className="text-sm text-muted-foreground">
                        {paymentSettings.vatEnabled ? (isRTL ? 'مفعل' : 'Enabled') : (isRTL ? 'معطل' : 'Disabled')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'نسبة الضريبة %' : 'VAT Percentage'}</Label>
                    <Input
                      type="number"
                      value={paymentSettings.vatPercentage}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, vatPercentage: Number(e.target.value) })}
                      disabled={!paymentSettings.vatEnabled}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">{isRTL ? 'معلومات الحساب البنكي' : 'Bank Account Information'}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{isRTL ? 'اسم البنك' : 'Bank Name'}</Label>
                      <Input
                        value={paymentSettings.bankName}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, bankName: e.target.value })}
                        placeholder={isRTL ? 'مثال: البنك الأهلي' : 'e.g., Al Ahli Bank'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRTL ? 'رقم الحساب' : 'Account Number'}</Label>
                      <Input
                        value={paymentSettings.bankAccountNumber}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, bankAccountNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRTL ? 'رقم IBAN' : 'IBAN'}</Label>
                      <Input
                        value={paymentSettings.bankIBAN}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, bankIBAN: e.target.value })}
                        placeholder="SA..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSavePayment} disabled={saveSettingsMutation.isPending}>
                    <Save className="w-4 h-4 me-2" />
                    {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'إعدادات الإشعارات' : 'Notification Settings'}</CardTitle>
                <CardDescription>
                  {isRTL ? 'تحكم في إشعارات البريد والرسائل النصية' : 'Control email and SMS notification preferences'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{isRTL ? 'إشعارات البريد الإلكتروني' : 'Email Notifications'}</p>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'إرسال إشعارات عبر البريد الإلكتروني' : 'Send notifications via email'}
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailNotifications: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{isRTL ? 'إشعارات SMS' : 'SMS Notifications'}</p>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'إرسال إشعارات عبر الرسائل النصية' : 'Send notifications via SMS'}
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.smsNotifications}
                      onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, smsNotifications: checked })}
                    />
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium">{isRTL ? 'أنواع الإشعارات' : 'Notification Types'}</h4>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{isRTL ? 'تنبيهات التسجيل' : 'Enrollment Alerts'}</p>
                        <p className="text-sm text-muted-foreground">
                          {isRTL ? 'عند تسجيل طالب جديد في دورة' : 'When a new student enrolls in a course'}
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.enrollmentAlerts}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, enrollmentAlerts: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{isRTL ? 'تنبيهات المدفوعات' : 'Payment Alerts'}</p>
                        <p className="text-sm text-muted-foreground">
                          {isRTL ? 'عند إتمام عملية دفع جديدة' : 'When a new payment is completed'}
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.paymentAlerts}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, paymentAlerts: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{isRTL ? 'تنبيهات الإكمال' : 'Completion Alerts'}</p>
                        <p className="text-sm text-muted-foreground">
                          {isRTL ? 'عند إكمال طالب لدورة' : 'When a student completes a course'}
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.completionAlerts}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, completionAlerts: checked })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveNotifications} disabled={saveSettingsMutation.isPending}>
                    <Save className="w-4 h-4 me-2" />
                    {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'إعدادات الأمان' : 'Security Settings'}</CardTitle>
                <CardDescription>
                  {isRTL ? 'إعدادات المصادقة وحماية الحساب' : 'Authentication and account protection settings'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{isRTL ? 'المصادقة الثنائية' : 'Two-Factor Authentication'}</p>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'طلب رمز إضافي عند تسجيل الدخول' : 'Require additional code when logging in'}
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.twoFactorEnabled}
                      onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, twoFactorEnabled: checked })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{isRTL ? 'مهلة الجلسة (دقائق)' : 'Session Timeout (minutes)'}</Label>
                      <Input
                        type="number"
                        value={securitySettings.sessionTimeout}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRTL ? 'محاولات تسجيل الدخول القصوى' : 'Max Login Attempts'}</Label>
                      <Input
                        type="number"
                        value={securitySettings.maxLoginAttempts}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, maxLoginAttempts: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRTL ? 'الحد الأدنى لكلمة المرور' : 'Min Password Length'}</Label>
                      <Input
                        type="number"
                        value={securitySettings.passwordMinLength}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, passwordMinLength: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSecurity} disabled={saveSettingsMutation.isPending}>
                    <Save className="w-4 h-4 me-2" />
                    {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
