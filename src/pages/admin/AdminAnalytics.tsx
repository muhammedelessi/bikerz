import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Download, LayoutDashboard, Users, Video, BookOpen, GitBranch, DollarSign, Shield, Server } from 'lucide-react';

import SystemOverview from '@/components/analytics/SystemOverview';
import UserIntelligence from '@/components/analytics/UserIntelligence';
import VideoMicroAnalytics from '@/components/analytics/VideoMicroAnalytics';
import CoursePsychology from '@/components/analytics/CoursePsychology';
import FunnelConversion from '@/components/analytics/FunnelConversion';
import RevenueAnalytics from '@/components/analytics/RevenueAnalytics';
import RetentionChurn from '@/components/analytics/RetentionChurn';
import InfrastructureMetrics from '@/components/analytics/InfrastructureMetrics';

const AdminAnalytics = () => {
  const { isRTL } = useLanguage();
  const [dateRange, setDateRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', icon: LayoutDashboard, labelEn: 'Overview', labelAr: 'نظرة عامة' },
    { id: 'users', icon: Users, labelEn: 'Users', labelAr: 'المستخدمون' },
    { id: 'videos', icon: Video, labelEn: 'Videos', labelAr: 'الفيديوهات' },
    { id: 'courses', icon: BookOpen, labelEn: 'Courses', labelAr: 'الدورات' },
    { id: 'funnel', icon: GitBranch, labelEn: 'Funnel', labelAr: 'القمع' },
    { id: 'revenue', icon: DollarSign, labelEn: 'Revenue', labelAr: 'الإيرادات' },
    { id: 'retention', icon: Shield, labelEn: 'Retention', labelAr: 'الاحتفاظ' },
    { id: 'infra', icon: Server, labelEn: 'Infrastructure', labelAr: 'البنية التحتية' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? 'مركز التحكم التحليلي' : 'Analytics Command Center'}
            </h1>
            <p className="text-muted-foreground">
              {isRTL ? 'لوحة تحكم شاملة - لا مكان للمشاكل للاختباء' : 'Comprehensive dashboard - nowhere for problems to hide'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="w-4 h-4 me-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">{isRTL ? '24 ساعة' : '24 hours'}</SelectItem>
                <SelectItem value="7d">{isRTL ? '7 أيام' : '7 days'}</SelectItem>
                <SelectItem value="30d">{isRTL ? '30 يوم' : '30 days'}</SelectItem>
                <SelectItem value="90d">{isRTL ? '90 يوم' : '90 days'}</SelectItem>
                <SelectItem value="1y">{isRTL ? 'سنة' : '1 year'}</SelectItem>
                <SelectItem value="all">{isRTL ? 'كل الوقت' : 'All time'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="w-4 h-4 me-2" />
              {isRTL ? 'تصدير' : 'Export'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-muted/50 p-1 h-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-background whitespace-nowrap"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{isRTL ? tab.labelAr : tab.labelEn}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview" className="m-0">
              <SystemOverview />
            </TabsContent>
            <TabsContent value="users" className="m-0">
              <UserIntelligence dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="videos" className="m-0">
              <VideoMicroAnalytics dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="courses" className="m-0">
              <CoursePsychology dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="funnel" className="m-0">
              <FunnelConversion dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="revenue" className="m-0">
              <RevenueAnalytics dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="retention" className="m-0">
              <RetentionChurn dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="infra" className="m-0">
              <InfrastructureMetrics dateRange={dateRange} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;