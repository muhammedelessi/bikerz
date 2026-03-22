import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const ApplePayIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 50 20" className={className} style={{ direction: 'ltr' }}>
    <path d="M9.6 3.8c-.6.7-1.5 1.3-2.4 1.2-.1-1 .4-2 .9-2.6C8.7 1.7 9.7 1.1 10.5 1c.1 1-.3 2-.9 2.8zm.9 1.4c-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.8 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7 1.2 0 2-1 2.7-2.1.9-1.2 1.2-2.4 1.2-2.5 0 0-2.4-1-2.4-3.7 0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8l-.2-.3z" fill="currentColor" />
    <text x="18" y="14.5" fontSize="11" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif" fill="currentColor">Pay</text>
  </svg>
);

const GooglePayIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 56 20" className={className} style={{ direction: 'ltr' }}>
    <text x="1" y="15" fontSize="12" fontWeight="500" fontFamily="system-ui, sans-serif">
      <tspan fill="#4285F4">G</tspan>
      <tspan fill="#EA4335">o</tspan>
      <tspan fill="#FBBC05">o</tspan>
      <tspan fill="#4285F4">g</tspan>
      <tspan fill="#34A853">l</tspan>
      <tspan fill="#EA4335">e</tspan>
    </text>
    <text x="33" y="15" fontSize="12" fontWeight="500" fontFamily="system-ui, sans-serif" fill="currentColor">Pay</text>
  </svg>
);

const VisaIcon = ({ light = false, className = 'h-4 w-auto' }: { light?: boolean; className?: string }) => (
  <svg viewBox="0 0 48 16" className={className} style={{ direction: 'ltr' }}>
    <text x="0" y="13" fontSize="14" fontWeight="700" fontFamily="system-ui, sans-serif" fill={light ? '#FFFFFF' : '#1A1F71'} letterSpacing="-0.5">VISA</text>
  </svg>
);

const MastercardIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 32 20" className={className}>
    <circle cx="10" cy="10" r="9" fill="#EB001B" />
    <circle cx="22" cy="10" r="9" fill="#F79E1B" />
    <path d="M16 3.2a9 9 0 0 1 0 13.6 9 9 0 0 1 0-13.6z" fill="#FF5F00" />
  </svg>
);

const MadaIcon = ({ className = 'h-5 w-auto' }: { className?: string }) => (
  <svg viewBox="0 0 48 20" className={className} style={{ direction: 'ltr' }}>
    <text x="0" y="15" fontSize="13" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#003B71" letterSpacing="0.5">mada</text>
  </svg>
);

interface PaymentMethodIconsProps {
  className?: string;
  showLabel?: boolean;
}

const PaymentMethodIcons: React.FC<PaymentMethodIconsProps> = ({ className = '', showLabel = true }) => {
  const { isRTL } = useLanguage();

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      {showLabel && (
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          {isRTL ? 'طرق الدفع المتاحة' : 'Accepted Payment Methods'}
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-8 px-3 rounded-md bg-white/90 border border-white/20">
          <VisaIcon />
        </div>
        <div className="flex items-center justify-center h-8 px-2 rounded-md bg-white/90 border border-white/20">
          <MastercardIcon />
        </div>
        <div className="flex items-center justify-center h-8 px-2 rounded-md bg-black border border-white/20 text-white">
          <ApplePayIcon />
        </div>
        <div className="flex items-center justify-center h-8 px-2 rounded-md bg-white/90 border border-white/20 text-gray-800">
          <GooglePayIcon />
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodIcons;
export { ApplePayIcon, GooglePayIcon, VisaIcon, MastercardIcon };
