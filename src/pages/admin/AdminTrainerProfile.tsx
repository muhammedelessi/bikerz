import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import TrainerProfileView from '@/components/admin/TrainerProfileView';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const AdminTrainerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();

  return (
    <AdminLayout>
      <div className="mx-auto w-full min-w-0 min-h-0 max-w-[1600px] space-y-4 px-2 sm:px-4 lg:px-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <Button variant="ghost" size="sm" className="gap-2 -ms-2" onClick={() => navigate('/admin/trainers')}>
          {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          {isRTL ? 'العودة لقائمة المدربين' : 'Back to trainers'}
        </Button>
        {id ? (
          <TrainerProfileView
            trainerId={id}
            onEdit={(tr) => navigate(`/admin/trainers?edit=${encodeURIComponent(tr.id)}`)}
          />
        ) : null}
      </div>
    </AdminLayout>
  );
};

export default AdminTrainerProfile;
