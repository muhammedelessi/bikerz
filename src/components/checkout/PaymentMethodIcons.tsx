import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import paymentMethodsImg from '@/assets/payment-methods.png';

interface PaymentMethodIconsProps {
  className?: string;
  showLabel?: boolean;
}

const PaymentMethodIcons: React.FC<PaymentMethodIconsProps> = ({ className = '', showLabel = true }) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      {showLabel && (
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          {t('checkout.paymentMethodIcons.acceptedPaymentMethods')}
        </p>
      )}
      <img
        src={paymentMethodsImg}
        alt="mada, Apple Pay, Mastercard, Visa"
        className="h-8 w-auto object-contain"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
};

const PaymentMethodImage = ({ className = 'h-8 w-auto' }: { className?: string }) => (
  <img src={paymentMethodsImg} alt="Payment methods" className={`${className} object-contain`} />
);

export default PaymentMethodIcons;
export {
  PaymentMethodImage as ApplePayIcon,
  PaymentMethodImage as GooglePayIcon,
  PaymentMethodImage as VisaIcon,
  PaymentMethodImage as MastercardIcon,
  PaymentMethodImage as MadaIcon,
};
