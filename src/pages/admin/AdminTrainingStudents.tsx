import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';

// Students are now managed inline within AdminTrainers page
const AdminTrainingStudents: React.FC = () => {
  const { isRTL } = useLanguage();
  return (
    <AdminLayout>
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">{isRTL ? 'تم نقل إدارة الطلاب إلى صفحة المدربين' : 'Students management has been moved to the Trainers page'}</p>
      </div>
    </AdminLayout>
  );
};

export default AdminTrainingStudents;
