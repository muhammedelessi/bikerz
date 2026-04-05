import React from "react";
import { useTranslation } from "react-i18next";
import visaLogo from "@/assets/payment/visa.svg";
import mastercardLogo from "@/assets/payment/mastercard.svg";
import madaLogo from "@/assets/payment/mada.svg";
import applePayLogo from "@/assets/payment/apple-pay.svg";
const methods: {
  src: string;
  alt: string;
  bg: string;
  imgW: string;
  imgH: string;
}[] = [
  {
    src: applePayLogo,
    alt: "Apple Pay",
    bg: "#ffffff",
    imgW: "180%",
    imgH: "180%",
  },
  { src: madaLogo, alt: "mada", bg: "#ffffff", imgW: "210%", imgH: "210%" },
  {
    src: mastercardLogo,
    alt: "Mastercard",
    bg: "#ffffff",
    imgW: "190%",
    imgH: "190%",
  },
  { src: visaLogo, alt: "Visa", bg: "#ffffff", imgW: "100%", imgH: "100%" },
];

interface PaymentMethodIconsProps {
  className?: string;
  showLabel?: boolean;
}

const PaymentMethodIcons: React.FC<PaymentMethodIconsProps> = (
  { className = "", showLabel = true },
) => {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      {showLabel && (
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
          {t("checkout.paymentMethodIcons.acceptedPaymentMethods")}
        </p>
      )}
      <div className="flex items-center justify-start gap-2 flex-wrap">
        {methods.map(({ src, alt, bg, imgW, imgH }) => (
          <div
            key={alt}
            style={{ backgroundColor: bg, width: 64, height: 40 }}
            className="flex items-center justify-center rounded-lg border border-white/10 shadow-sm overflow-hidden p-2 flex-shrink-0"
          >
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              style={{ width: imgW, height: imgH, objectFit: "contain" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaymentMethodIcons;
export const ApplePayIcon = () => (
  <img src={applePayLogo} alt="Apple Pay" className="h-5 w-auto" />
);
export const VisaIcon = () => (
  <img src={visaLogo} alt="Visa" className="h-5 w-auto" />
);
export const MastercardIcon = () => (
  <img src={mastercardLogo} alt="Mastercard" className="h-5 w-auto" />
);
export const MadaIcon = () => (
  <img src={madaLogo} alt="mada" className="h-5 w-auto" />
);
