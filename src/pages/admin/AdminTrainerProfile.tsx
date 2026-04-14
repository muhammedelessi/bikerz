import React from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { TrainerProfileView } from '@/components/admin/TrainerProfileView';
import { useAdminTrainerProfile } from '@/hooks/admin/useAdminTrainerProfile';

/**
 * Admin trainer detail route — renders the shared modern `TrainerProfileView`
 * (hero, stats, tabs, bike gallery, trainings, bookings, payments).
 */
const AdminTrainerProfile = () => {
  const { id, navigate, isRTL } = useAdminTrainerProfile();

  if (!id) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <p className="text-lg text-muted-foreground">{isRTL ? 'معرّف غير صالح' : 'Invalid trainer id'}</p>
          <Button variant="outline" onClick={() => navigate('/admin/trainers')}>
            {isRTL ? 'العودة' : 'Go back'}
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 min-w-0">
        <Button variant="ghost" size="sm" className="gap-2 shrink-0" onClick={() => navigate('/admin/trainers')}>
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          {isRTL ? 'العودة لقائمة المدربين' : 'Back to Trainers'}
        </Button>
        <TrainerProfileView trainerId={id} />
      </div>
    </AdminLayout>
  );
};

export default AdminTrainerProfile;
