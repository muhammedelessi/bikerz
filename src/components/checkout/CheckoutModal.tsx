import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Smartphone,
  Building2,
  Gift,
  Shield,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: {
    id: string;
    title: string;
    title_ar: string | null;
    price: number;
    thumbnail_url: string | null;
  };
  onSuccess: () => void;
}

type PaymentMethod = 'card' | 'apple_pay' | 'mada' | 'bank' | 'promo';
type CheckoutStep = 'payment' | 'details' | 'confirmation';

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  onOpenChange,
  course,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [step, setStep] = useState<CheckoutStep>('payment');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Card details state
  const [cardDetails, setCardDetails] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: '',
  });

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const paymentMethods = [
    {
      id: 'card' as PaymentMethod,
      name: isRTL ? 'بطاقة ائتمان/خصم' : 'Credit/Debit Card',
      icon: CreditCard,
      description: isRTL ? 'Visa, Mastercard, Amex' : 'Visa, Mastercard, Amex',
    },
    {
      id: 'apple_pay' as PaymentMethod,
      name: 'Apple Pay',
      icon: Smartphone,
      description: isRTL ? 'ادفع بسهولة عبر Apple Pay' : 'Quick checkout with Apple Pay',
    },
    {
      id: 'mada' as PaymentMethod,
      name: isRTL ? 'مدى' : 'Mada',
      icon: CreditCard,
      description: isRTL ? 'بطاقات مدى السعودية' : 'Saudi Mada cards',
    },
    {
      id: 'bank' as PaymentMethod,
      name: isRTL ? 'تحويل بنكي' : 'Bank Transfer',
      icon: Building2,
      description: isRTL ? 'تحويل مباشر للحساب البنكي' : 'Direct bank transfer',
    },
  ];

  const discountedPrice = promoApplied ? course.price * 0.8 : course.price;

  const handleApplyPromo = () => {
    if (promoCode.toLowerCase() === 'bikerz20' || promoCode.toLowerCase() === 'welcome') {
      setPromoApplied(true);
      toast.success(isRTL ? 'تم تطبيق الخصم بنجاح!' : 'Discount applied successfully!');
    } else {
      toast.error(isRTL ? 'رمز الخصم غير صالح' : 'Invalid promo code');
    }
  };

  const handleNext = () => {
    if (step === 'payment') {
      if (paymentMethod === 'card') {
        setStep('details');
      } else {
        setStep('confirmation');
      }
    } else if (step === 'details') {
      setStep('confirmation');
    }
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('payment');
    } else if (step === 'confirmation') {
      if (paymentMethod === 'card') {
        setStep('details');
      } else {
        setStep('payment');
      }
    }
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsProcessing(false);
    toast.success(isRTL ? 'تم الشراء بنجاح!' : 'Purchase successful!');
    onSuccess();
    onOpenChange(false);
    
    // Reset state
    setStep('payment');
    setPaymentMethod('card');
    setPromoCode('');
    setPromoApplied(false);
    setCardDetails({ number: '', name: '', expiry: '', cvv: '' });
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border p-0 overflow-hidden">
        {/* Header with course info */}
        <div className="bg-muted/30 p-6 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {isRTL ? 'إتمام الشراء' : 'Complete Purchase'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {course.thumbnail_url ? (
                <img 
                  src={course.thumbnail_url} 
                  alt={course.title} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {isRTL && course.title_ar ? course.title_ar : course.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {promoApplied && (
                  <span className="text-sm text-muted-foreground line-through">
                    {course.price} {isRTL ? 'ر.س' : 'SAR'}
                  </span>
                )}
                <span className="text-lg font-bold text-primary">
                  {discountedPrice} {isRTL ? 'ر.س' : 'SAR'}
                </span>
                {promoApplied && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    -20%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-4 px-6 border-b border-border/50">
          {['payment', 'details', 'confirmation'].map((s, index) => {
            const isActive = 
              s === step || 
              (s === 'payment' && (step === 'details' || step === 'confirmation')) ||
              (s === 'details' && step === 'confirmation' && paymentMethod === 'card');
            const isCurrent = s === step;
            const showDetails = paymentMethod === 'card' || s !== 'details';
            
            if (!showDetails) return null;
            
            return (
              <React.Fragment key={s}>
                {index > 0 && (paymentMethod === 'card' || s !== 'details') && (
                  <div className={`h-0.5 w-8 ${isActive ? 'bg-primary' : 'bg-border'}`} />
                )}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isActive && !isCurrent ? <Check className="w-4 h-4" /> : (paymentMethod === 'card' ? index + 1 : (s === 'payment' ? 1 : 2))}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 'payment' && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                transition={{ duration: 0.2 }}
              >
                <h4 className="font-semibold text-foreground mb-4">
                  {isRTL ? 'اختر طريقة الدفع' : 'Select Payment Method'}
                </h4>
                
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                  className="space-y-3"
                >
                  {paymentMethods.map((method) => (
                    <label
                      key={method.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        paymentMethod === method.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={method.id} className="sr-only" />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        paymentMethod === method.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <method.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-foreground">{method.name}</span>
                        <p className="text-sm text-muted-foreground">{method.description}</p>
                      </div>
                      {paymentMethod === method.id && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </label>
                  ))}
                </RadioGroup>

                {/* Promo Code */}
                <Separator className="my-6" />
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    <Gift className="w-4 h-4 inline-block me-2" />
                    {isRTL ? 'رمز الخصم' : 'Promo Code'}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder={isRTL ? 'أدخل رمز الخصم' : 'Enter promo code'}
                      disabled={promoApplied}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={handleApplyPromo}
                      disabled={!promoCode || promoApplied}
                    >
                      {promoApplied 
                        ? (isRTL ? 'مطبق' : 'Applied') 
                        : (isRTL ? 'تطبيق' : 'Apply')}
                    </Button>
                  </div>
                  {promoApplied && (
                    <p className="text-sm text-primary flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      {isRTL ? 'تم تطبيق خصم 20%' : '20% discount applied'}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {step === 'details' && paymentMethod === 'card' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                transition={{ duration: 0.2 }}
              >
                <h4 className="font-semibold text-foreground mb-4">
                  {isRTL ? 'تفاصيل البطاقة' : 'Card Details'}
                </h4>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">
                      {isRTL ? 'رقم البطاقة' : 'Card Number'}
                    </Label>
                    <Input
                      id="cardNumber"
                      value={cardDetails.number}
                      onChange={(e) => setCardDetails({ 
                        ...cardDetails, 
                        number: formatCardNumber(e.target.value) 
                      })}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cardName">
                      {isRTL ? 'الاسم على البطاقة' : 'Name on Card'}
                    </Label>
                    <Input
                      id="cardName"
                      value={cardDetails.name}
                      onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                      placeholder={isRTL ? 'الاسم الكامل' : 'Full Name'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiry">
                        {isRTL ? 'تاريخ الانتهاء' : 'Expiry Date'}
                      </Label>
                      <Input
                        id="cardExpiry"
                        value={cardDetails.expiry}
                        onChange={(e) => setCardDetails({ 
                          ...cardDetails, 
                          expiry: formatExpiry(e.target.value) 
                        })}
                        placeholder="MM/YY"
                        maxLength={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardCvv">CVV</Label>
                      <Input
                        id="cardCvv"
                        type="password"
                        value={cardDetails.cvv}
                        onChange={(e) => setCardDetails({ 
                          ...cardDetails, 
                          cvv: e.target.value.replace(/\D/g, '').slice(0, 4) 
                        })}
                        placeholder="***"
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-6 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>
                    {isRTL 
                      ? 'معلوماتك محمية بتشفير SSL آمن'
                      : 'Your information is protected with secure SSL encryption'}
                  </span>
                </div>
              </motion.div>
            )}

            {step === 'confirmation' && (
              <motion.div
                key="confirmation"
                initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
                transition={{ duration: 0.2 }}
              >
                <h4 className="font-semibold text-foreground mb-4">
                  {isRTL ? 'تأكيد الطلب' : 'Order Confirmation'}
                </h4>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/30 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {isRTL ? 'الدورة' : 'Course'}
                      </span>
                      <span className="font-medium text-foreground truncate max-w-[200px]">
                        {isRTL && course.title_ar ? course.title_ar : course.title}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {isRTL ? 'طريقة الدفع' : 'Payment Method'}
                      </span>
                      <span className="font-medium text-foreground">
                        {paymentMethods.find(m => m.id === paymentMethod)?.name}
                      </span>
                    </div>
                    {promoApplied && (
                      <div className="flex justify-between text-primary">
                        <span>{isRTL ? 'الخصم' : 'Discount'}</span>
                        <span>-{(course.price * 0.2).toFixed(0)} {isRTL ? 'ر.س' : 'SAR'}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>{isRTL ? 'المجموع' : 'Total'}</span>
                      <span className="text-primary">
                        {discountedPrice} {isRTL ? 'ر.س' : 'SAR'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 text-sm">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">
                      {isRTL 
                        ? 'ستحصل على وصول فوري للدورة بعد إتمام الدفع'
                        : 'You will get instant access to the course after payment'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/20 flex gap-3">
          {step !== 'payment' && (
            <Button variant="outline" onClick={handleBack} className="flex-1">
              {isRTL ? 'رجوع' : 'Back'}
            </Button>
          )}
          
          {step === 'confirmation' ? (
            <Button 
              onClick={handleConfirm} 
              disabled={isProcessing}
              className="flex-1 btn-cta"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  {isRTL ? 'جاري المعالجة...' : 'Processing...'}
                </>
              ) : (
                <>
                  {isRTL ? 'تأكيد الدفع' : 'Confirm Payment'}
                  <ArrowIcon className="w-4 h-4 ms-2" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} className="flex-1 btn-cta">
              {isRTL ? 'التالي' : 'Continue'}
              <ArrowIcon className="w-4 h-4 ms-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
