import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';

import visaLogo from '@/assets/payment/visa.svg';
import mastercardLogo from '@/assets/payment/mastercard.svg';
import madaLogo from '@/assets/payment/mada.svg';
import applePayLogo from '@/assets/payment/apple-pay.svg';

const ApplePayIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <img src={applePayLogo} alt="Apple Pay" className={className} />
);

const VisaIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <img src={visaLogo} alt="Visa" className={className} />
);

const MastercardIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <img src={mastercardLogo} alt="Mastercard" className={className} />
);

const MadaIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <img src={madaLogo} alt="mada" className={className} />
);

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
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-10 w-16 rounded-md bg-white border border-gray-200 p-1.5">
          <VisaIcon className="h-full w-auto" />
        </div>
        <div className="flex items-center justify-center h-10 w-16 rounded-md bg-white border border-gray-200 p-1">
          <MastercardIcon className="h-full w-auto" />
        </div>
        <div className="flex items-center justify-center h-11 w-[4.5rem] rounded-md bg-white border border-gray-200 p-1">
          <MadaIcon className="h-full w-auto" />
        </div>
        <div className="flex items-center justify-center h-11 w-[4.5rem] rounded-md bg-black border border-gray-200 p-1.5">
          <ApplePayIcon className="h-full w-auto invert" />
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodIcons;
export { ApplePayIcon, VisaIcon, MastercardIcon, MadaIcon };
