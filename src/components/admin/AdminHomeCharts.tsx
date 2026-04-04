import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from '@/lib/recharts-compat';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface AdminHomeChartsProps {
  monthlyData: Array<{ name: string; enrollments: number }>;
  coursePerformance: Array<{ name: string; students: number; completion: number }>;
  enrollmentsByStatus: Array<{ name: string; value: number }>;
  isRTL: boolean;
  t: (key: string) => string;
}

const AdminHomeCharts: React.FC<AdminHomeChartsProps> = ({
  monthlyData,
  coursePerformance,
  enrollmentsByStatus,
  isRTL,
  t,
}) => {
  return (
    <>
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollments Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('admin.dashboard.monthlyEnrollments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" reversed={isRTL} />
                    <YAxis className="text-xs" orientation={isRTL ? 'right' : 'left'} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="enrollments" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                 <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t('admin.dashboard.noData')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Course Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t('admin.dashboard.coursePerformance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {coursePerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={coursePerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" reversed={isRTL} />
                    <YAxis dataKey="name" type="category" className="text-xs" width={isRTL ? 150 : 120} orientation={isRTL ? 'right' : 'left'} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="students" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                 <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t('admin.dashboard.noCourses')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrollment Distribution Pie */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('admin.dashboard.enrollmentDistribution')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            {enrollmentsByStatus.some(e => e.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={enrollmentsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {enrollmentsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-muted-foreground">
                {t('admin.dashboard.noEnrollments')}
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {enrollmentsByStatus.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-muted-foreground">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default AdminHomeCharts;
