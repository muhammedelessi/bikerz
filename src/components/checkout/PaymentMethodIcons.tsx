import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';

const ApplePayIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 165.52 105.97" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M32.3 16.75c-2.14 2.52-5.56 4.49-8.97 4.21-.43-3.42 1.24-7.04 3.2-9.28 2.14-2.61 5.83-4.54 8.84-4.68.35 3.52-1.03 6.99-3.07 9.75zm3.02 4.95c-4.95-.3-9.16 2.81-11.51 2.81-2.34 0-5.98-2.66-9.84-2.59-5.07.07-9.75 2.95-12.35 7.48-5.27 9.11-1.36 22.62 3.76 30.03 2.52 3.66 5.53 7.72 9.48 7.58 3.81-.15 5.24-2.47 9.84-2.47 4.61 0 5.89 2.47 9.93 2.39 4.09-.07 6.69-3.69 9.21-7.36 2.87-4.22 4.06-8.31 4.12-8.53-.09-.04-7.91-3.04-7.99-12.07-.07-7.55 6.16-11.17 6.44-11.36-3.52-5.19-8.99-5.77-10.94-5.91h-.15z" fill="currentColor"/>
    <path d="M78.09 7.86c13.5 0 22.9 9.31 22.9 22.88 0 13.63-9.57 22.97-23.19 22.97H63.06v23.81h-11.2V7.86zm-15.03 37h12.82c9.41 0 14.77-5.07 14.77-13.12 0-8.05-5.36-13.06-14.71-13.06H63.06v26.18z" fill="currentColor"/>
    <path d="M103.46 57.66c0-8.92 6.83-14.39 18.93-15.13l13.92-.84v-3.85c0-5.67-3.81-9.05-10.18-9.05-6.03 0-9.87 2.95-10.78 7.45h-10.24c.58-9.64 8.59-16.73 21.35-16.73 12.53 0 20.54 6.66 20.54 17.06v35.95h-10.36v-8.59h-.23c-3.04 5.73-9.67 9.34-16.56 9.34-10.3 0-16.39-6.31-16.39-15.61zm32.85-4.72v-3.92l-12.53.78c-6.26.41-9.81 3.18-9.81 7.62 0 4.55 3.67 7.51 9.27 7.51 7.28 0 13.07-5.01 13.07-11.99z" fill="currentColor"/>
    <path d="M153.96 101.23c-1.06 3.31-5.72 5.7-10.99 5.7l-2.71-.01v-8.72l2.72.01c3.54 0 5.96-1.46 7.19-4.6l1.36-3.54-19.05-49.68h11.59l13.33 40.53h.18L170.9 40.39h11.33l-19.85 52.94-8.42 7.9z" fill="currentColor"/>
  </svg>
);

// Official Visa logo SVG
const VisaIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 780 500" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M293.2 348.73l33.36-195.76h53.34l-33.38 195.76H293.2zm246.11-191.54c-10.57-3.98-27.17-8.22-47.89-8.22-52.73 0-89.86 26.6-90.18 64.72-.32 28.2 26.52 43.92 46.75 53.3 20.77 9.6 27.75 15.72 27.65 24.28-.14 13.12-16.58 19.12-31.91 19.12-21.37 0-32.69-2.96-50.14-10.27l-6.87-3.11-7.49 43.87c12.46 5.47 35.5 10.2 59.43 10.45 56.06 0 92.5-26.25 92.92-67.02.21-22.33-14.01-39.33-44.78-53.34-18.64-9.09-30.06-15.14-29.94-24.34 0-8.15 9.65-16.87 30.51-16.87 17.41-.28 30.02 3.53 39.87 7.48l4.77 2.26 7.24-42.31zm138.65-4.22h-41.24c-12.77 0-22.34 3.49-27.95 16.24L505.38 348.73h56.02l11.19-29.38h68.45l6.5 29.38h49.46l-43.16-195.76h.12zM591.85 280.3l28.45-72.57 4.87-13.85 7.95 36.01 16.52 50.41h-57.79zm-311.14-127.53L228.39 286.41l-5.57-27.08c-9.68-31.24-39.87-65.09-73.61-82.06l47.79 171.36 56.42-.07 83.93-195.79h-56.44v-.01z" fill="#1A1F71"/>
    <path d="M131.92 152.77H46.6l-.68 4.06c66.94 16.22 111.23 55.41 129.59 102.48l-18.69-89.96c-3.22-12.35-12.58-16.12-24.9-16.58z" fill="#F9A533"/>
  </svg>
);

// Official Mastercard logo SVG
const MastercardIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 780 500" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="299.21" cy="249.99" r="158.15" fill="#EB001B"/>
    <circle cx="480.79" cy="249.99" r="158.15" fill="#F79E1B"/>
    <path d="M390 113.48a158.07 158.07 0 00-90.79 136.52A158.07 158.07 0 00390 386.52a158.07 158.07 0 0090.79-136.52A158.07 158.07 0 00390 113.48z" fill="#FF5F00"/>
  </svg>
);

// Official mada logo SVG
const MadaIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 180 70" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M50.06 26.8c-3.48-3.12-8.13-5.03-13.24-5.03-5.11 0-9.76 1.91-13.24 5.03-3.48-3.12-8.13-5.03-13.24-5.03-1.54 0-3.03.18-4.47.51v26.43c1.44.33 2.93.51 4.47.51 5.11 0 9.76-1.91 13.24-5.03 3.48 3.12 8.13 5.03 13.24 5.03s9.76-1.91 13.24-5.03c3.48 3.12 8.13 5.03 13.24 5.03 1.54 0 3.03-.18 4.47-.51V22.28c-1.44-.33-2.93-.51-4.47-.51-5.11 0-9.76 1.91-13.24 5.03z" fill="#52AE30"/>
    <path d="M63.3 22.28c-1.44-.33-2.93-.51-4.47-.51-5.11 0-9.76 1.91-13.24 5.03-3.48-3.12-8.13-5.03-13.24-5.03s-9.76 1.91-13.24 5.03c-3.48-3.12-8.13-5.03-13.24-5.03-1.54 0-3.03.18-4.47.51" fill="none" stroke="#52AE30" strokeWidth="1.5"/>
    <text x="75" y="43" fontSize="22" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#003B71" letterSpacing="1">mada</text>
  </svg>
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
        <div className="flex items-center justify-center h-8 w-14 rounded-md bg-white border border-gray-200">
          <VisaIcon className="h-4 w-auto" />
        </div>
        <div className="flex items-center justify-center h-8 w-14 rounded-md bg-white border border-gray-200">
          <MastercardIcon className="h-5 w-auto" />
        </div>
        <div className="flex items-center justify-center h-8 w-14 rounded-md bg-white border border-gray-200">
          <MadaIcon className="h-4 w-auto" />
        </div>
        <div className="flex items-center justify-center h-8 w-14 rounded-md bg-black border border-gray-200 text-white">
          <ApplePayIcon className="h-4 w-auto" />
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodIcons;
export { ApplePayIcon, VisaIcon, MastercardIcon, MadaIcon };
