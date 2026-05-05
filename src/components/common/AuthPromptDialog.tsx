import React from "react";
import LocalizedLink from "@/components/common/LocalizedLink";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, Lock } from "lucide-react";

interface AuthPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** If provided, auth pages will redirect back here after login/signup. */
  returnTo?: string;
}

const AuthPromptDialog: React.FC<AuthPromptDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  returnTo,
}) => {
  const { isRTL } = useLanguage();

  const defaultTitle = isRTL ? "سجّل الدخول للمتابعة" : "Sign in to continue";
  const defaultDescription = isRTL
    ? "أنشئ حسابًا أو سجّل الدخول للإعجاب والتعليق على هذا الفيديو."
    : "Create an account or sign in to like and comment on this video.";

  const returnSuffix = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-2">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <DialogTitle className="text-center">
            {title || defaultTitle}
          </DialogTitle>
          <DialogDescription className="text-center">
            {description || defaultDescription}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
          <Button asChild variant="cta" className="w-full gap-2">
            <LocalizedLink to={`/login${returnSuffix}`}>
              <LogIn className="w-4 h-4" />
              {isRTL ? "تسجيل الدخول" : "Sign in"}
            </LocalizedLink>
          </Button>
          <Button asChild variant="outline" className="w-full gap-2">
            <LocalizedLink to={`/signup${returnSuffix}`}>
              <UserPlus className="w-4 h-4" />
              {isRTL ? "إنشاء حساب" : "Create account"}
            </LocalizedLink>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AuthPromptDialog;
