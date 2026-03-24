import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Button } from '@/components/ui/button';

interface PurchaseEncouragementModalProps {
  open: boolean;
  onClose: () => void;
  onBuyNow: () => void;
  course: {
    title: string;
    title_ar: string | null;
    thumbnail_url: string | null;
    price: number;
    discount_percentage?: number | null;
  };
}

const PurchaseEncouragementModal: React.FC<PurchaseEncouragementModalProps> = ({
  open,
  onClose,
  onBuyNow,
  course,
}) => {
  const { isRTL } = useLanguage();
  const { formatPrice, getSarTotalWithVat } = useCurrency();

  // Calculate price with course discount and VAT included
  const courseDiscountPct = course.discount_percentage && course.discount_percentage > 0 ? course.discount_percentage : 0;
  const priceBeforeVat = courseDiscountPct > 0
    ? Math.ceil(course.price * (1 - courseDiscountPct / 100))
    : course.price;
  const finalPrice = Math.ceil(priceBeforeVat * 1.15);
  const originalPriceWithVat = Math.ceil(course.price * 1.15);

  const hasAnyDiscount = courseDiscountPct > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Course Thumbnail */}
            {course.thumbnail_url && (
              <div className="relative w-full aspect-video overflow-hidden">
                <img
                  src={course.thumbnail_url}
                  alt={isRTL && course.title_ar ? course.title_ar : course.title}
                  className="w-full h-full object-cover"
                 loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                <button
                  onClick={onClose}
                  className="absolute top-3 end-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="p-6 space-y-4 text-center">
              {!course.thumbnail_url && (
                <button
                  onClick={onClose}
                  className="absolute top-3 end-3 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Emoji Title */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">
                  {isRTL ? 'أعجبك المحتوى؟ 🎉' : 'Enjoying the content? 🎉'}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isRTL
                    ? 'لقد أنهيت المقاطع المجانية! اشترِ الكورس الآن لمتابعة تعلمك واكتشاف المزيد'
                    : "You've finished the free previews! Buy the course now to continue your learning journey"}
                </p>
              </div>

              {/* Price Section */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-1">
                <div className="flex items-center justify-center gap-2">
                  {hasAnyDiscount && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(originalPriceWithVat, isRTL)}
                    </span>
                  )}
                  <span className="text-2xl font-black text-primary">
                    {formatPrice(finalPrice, isRTL)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'السعر شامل الضريبة' : 'Price includes VAT'}
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <Button
                  variant="cta"
                  size="lg"
                  className="w-full text-base"
                  onClick={onBuyNow}
                >
                  <ShoppingCart className="w-5 h-5 me-2" />
                  {isRTL ? 'اشترك الآن' : 'Buy Now'}
                </Button>
                <button
                  onClick={onClose}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isRTL ? 'ليس الآن' : 'Not now'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PurchaseEncouragementModal;
