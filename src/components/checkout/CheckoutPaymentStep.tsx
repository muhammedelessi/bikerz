import React, { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard, Gift, Shield, Check, Lock,
  Loader2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ApplePayIcon, VisaIcon, MastercardIcon, MadaIcon } from '@/components/checkout/PaymentMethodIcons';
import { PHONE_COUNTRIES } from '@/data/phoneCountryCodes';
import type { PaymentStatus, AppliedCoupon } from '@/types/payment';

interface CheckoutPaymentStepProps {
  isRTL: boolean;
  currencyLabel: string;
  formatLocal: (amount: number) => string;
  promoCode: string;
  setPromoCode: (v: string) => void;
  promoApplied: boolean;
  appliedCoupon: AppliedCoupon | null;
  handleApplyPromo: () => void;
  clearPromo: () => void;
  discountLabel: string;
  discountAmount: number;
  discountedPrice: number;
  fullName: string;
  phone: string;
  phonePrefix: string;
  isOtherCountry: boolean;
  isOtherCity: boolean;
  countryManual: string;
  country: string;
  cityManual: string;
  city: string;
  courseTitle: string;
  courseTitleAr: string | null;
  paymentStatus: PaymentStatus;
  guestSigningUp: boolean;
  isPaymentReady: boolean;
  
  onSubmitPayment: () => void;
}

const CheckoutPaymentStep: React.FC<CheckoutPaymentStepProps> = memo(({
  isRTL, currencyLabel, formatLocal,
  promoCode, setPromoCode, promoApplied, appliedCoupon,
  handleApplyPromo, clearPromo, discountLabel, discountAmount, discountedPrice,
  fullName, phone, phonePrefix,
  isOtherCountry, isOtherCity, countryManual, country, cityManual, city,
  courseTitle, courseTitleAr,
  paymentStatus, guestSigningUp, isPaymentReady, onSubmitPayment,
}) => {
  const effectiveCountry = isOtherCountry ? countryManual : country;
  const effectiveCity = isOtherCity ? cityManual : city;
  const totalWithVat = discountedPrice;



  return (
    <motion.div
      key="payment"
      initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
      className="space-y-5"
    >
      {/* Accepted Payment Methods */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-foreground text-sm">
            {isRTL ? 'طرق الدفع المتاحة' : 'Accepted Payment Methods'}
          </h4>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { Icon: VisaIcon, bg: 'bg-white' },
            { Icon: MastercardIcon, bg: 'bg-white' },
            { Icon: MadaIcon, bg: 'bg-white' },
            { Icon: ApplePayIcon, bg: 'bg-black text-white' },
          ].map(({ Icon, bg }, i) => (
            <div key={i} className={`flex items-center justify-center h-8 w-14 rounded-lg border border-border ${bg}`}>
              <Icon className="h-4 w-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Promo Code */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5 text-primary" />
          {isRTL ? 'رمز الخصم' : 'Promo Code'}
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder={isRTL ? 'أدخل رمز الخصم' : 'Enter promo code'}
              disabled={promoApplied || paymentStatus === 'processing'}
              className="w-full pe-9 h-10"
            />
            {promoCode && !promoApplied && (
              <button
                type="button"
                onClick={() => setPromoCode('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
            {promoApplied && (
              <button
                type="button"
                onClick={clearPromo}
                className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button variant="outline" size="default" onClick={handleApplyPromo} disabled={!promoCode || promoApplied || paymentStatus === 'processing'}>
            {promoApplied ? (isRTL ? 'مطبق' : 'Applied') : (isRTL ? 'تطبيق' : 'Apply')}
          </Button>
        </div>
        {promoApplied && appliedCoupon && (
          <p className="text-xs text-primary flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            {isRTL
              ? `تم تطبيق خصم ${discountLabel} (وفّرت ${formatLocal(discountAmount)})`
              : `${discountLabel} discount applied (saved ${formatLocal(discountAmount)})`}
          </p>
        )}
      </div>

      {/* Order Summary */}
      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {isRTL ? 'ملخص الطلب' : 'Order Summary'}
          </p>
        </div>
        <div className="p-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{isRTL ? 'الاسم' : 'Name'}</span>
            <span className="font-medium truncate max-w-[200px]">{fullName}</span>
          </div>
          {phone && (() => {
            const prefixEntry = PHONE_COUNTRIES.find(pc => phonePrefix === pc.prefix + '_' + pc.code);
            const prefixStr = prefixEntry ? prefixEntry.prefix : '';
            return (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{isRTL ? 'الهاتف' : 'Phone'}</span>
                <span className="font-medium font-mono" dir="ltr">{prefixStr}{phone}</span>
              </div>
            );
          })()}
          {(() => {
            const addressParts = [effectiveCity, effectiveCountry].filter(Boolean);
            return addressParts.length > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{isRTL ? 'العنوان' : 'Address'}</span>
                <span className="font-medium truncate max-w-[200px]">{addressParts.join(', ')}</span>
              </div>
            ) : null;
          })()}
          <Separator className="my-1" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{isRTL ? 'الدورة' : 'Course'}</span>
            <span className="font-medium truncate max-w-[200px]">
              {isRTL && courseTitleAr ? courseTitleAr : courseTitle}
            </span>
          </div>
          {promoApplied && appliedCoupon && (
            <div className="flex justify-between text-sm text-primary">
              <span>{isRTL ? 'الخصم' : 'Discount'} ({discountLabel})</span>
              <span>-{formatLocal(discountAmount)}</span>
            </div>
          )}
          <Separator className="my-1" />
          <div className="flex justify-between font-bold text-base">
            <span>{isRTL ? 'الإجمالي (شامل الضريبة)' : 'Total (incl. VAT)'}</span>
            <span className="text-primary">{totalWithVat} {currencyLabel}</span>
          </div>
          <div className="pt-2 border-t border-border/50">
            <p className="text-[11px] text-muted-foreground text-center">
              {isRTL ? 'الرقم الضريبي' : 'VAT Number'}: <span className="font-mono font-medium text-foreground/70">311508395300003</span>
            </p>
          </div>
        </div>
      </div>

      {/* Pay Now CTA */}
      {discountedPrice > 0 && (
        <Button
          className="w-full h-12 rounded-xl text-base font-bold shadow-glow hover:shadow-glow-lg transition-all duration-300"
          variant="cta"
          onClick={onSubmitPayment}
          disabled={paymentStatus === 'processing' || guestSigningUp || !isPaymentReady}
        >
          {guestSigningUp ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin me-2" />
              <span>{isRTL ? 'جاري إنشاء الحساب...' : 'Creating account...'}</span>
            </>
          ) : paymentStatus === 'processing' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin me-2" />
              <span>{isRTL ? 'جاري تجهيز الدفع...' : 'Preparing payment...'}</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 me-2" />
              <span>
                {isRTL
                  ? `ادفع الآن ${totalWithVat} ${currencyLabel}`
                  : `Pay Now ${totalWithVat} ${currencyLabel}`}
              </span>
            </>
          )}
        </Button>
      )}

      {/* Trust Badge */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5 text-primary" />
          <span>🔒 {isRTL ? 'مُؤمّن بواسطة Tap Payments' : 'Secured by Tap Payments'}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Shield className="w-3 h-3" />
            <span>3D Secure</span>
          </div>
          <span className="text-muted-foreground/20">|</span>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Shield className="w-3 h-3" />
            <span>PCI DSS</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

CheckoutPaymentStep.displayName = 'CheckoutPaymentStep';

export default CheckoutPaymentStep;
