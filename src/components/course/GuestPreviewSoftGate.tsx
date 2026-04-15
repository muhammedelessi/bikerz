import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface GuestPreviewSoftGateProps {
  open: boolean;
  isRTL: boolean;
  onContinueWatching: () => void;
  onCreateAccount: () => void;
}

const GuestPreviewSoftGate: React.FC<GuestPreviewSoftGateProps> = ({
  open,
  isRTL,
  onContinueWatching,
  onCreateAccount,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <motion.div
            initial={{ y: 10, opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-2xl border border-white/20 bg-black/70 p-5 text-white shadow-xl"
          >
            <h3 className="text-lg font-semibold mb-2">
              {isRTL ? "تنتهي المعاينة المجانية قريبًا" : "Your free preview is ending soon"}
            </h3>
            <p className="text-sm text-white/80 mb-4">
              {isRTL
                ? "أكمل التسجيل الآن للوصول الكامل إلى محتوى الدورة."
                : "Create your free account now to unlock full course access."}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="btn-cta flex-1" onClick={onCreateAccount}>
                {isRTL ? "أنشئ حسابًا مجانيًا" : "Create Free Account"}
              </Button>
              <Button variant="outline" className="flex-1 bg-transparent text-white border-white/40" onClick={onContinueWatching}>
                {isRTL ? "استمر بالمشاهدة" : "Continue Watching"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GuestPreviewSoftGate;
