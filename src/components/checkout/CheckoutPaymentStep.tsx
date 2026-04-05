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
import { PHONE_COUNTRIES } from '@/data/phoneCountryCodes';
import type { PaymentStatus, AppliedCoupon } from '@/types/payment';
import PaymentMethodIcons from '@/components/checkout/PaymentMethodIcons';
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
        <PaymentMethodIcons showLabel={false} className={`scale-90 ${isRTL ? 'origin-right self-end' : 'origin-left self-start'}`} />

        {/* WhatsApp fallback */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-xs text-muted-foreground flex-1 leading-relaxed">
            {isRTL
              ? 'إذا طريقة الدفع المناسبة لك غير متاحة، تواصل معنا عبر واتساب لنوفرها لك فوراً'
              : "If your preferred payment method isn't available, contact us via WhatsApp and we'll accommodate you right away"}
          </p>
          <a
            href="https://wa.me/966562562368"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366] text-white text-xs font-semibold hover:bg-[#1fb855] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            {isRTL ? 'واتساب' : 'WhatsApp'}
          </a>
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
