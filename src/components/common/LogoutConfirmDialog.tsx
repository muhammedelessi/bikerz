import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface LogoutConfirmDialogProps {
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
}

const LogoutConfirmDialog: React.FC<LogoutConfirmDialogProps> = ({ onConfirm, children }) => {
  const { isRTL } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isRTL ? 'تأكيد تسجيل الخروج' : 'Confirm Logout'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isRTL
              ? 'هل أنت متأكد أنك تريد تسجيل الخروج من حسابك؟'
              : 'Are you sure you want to log out of your account?'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isRTL ? 'تسجيل الخروج' : 'Logout'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LogoutConfirmDialog;
