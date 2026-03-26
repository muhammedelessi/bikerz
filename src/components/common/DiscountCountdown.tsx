import React from "react";
import { Timer } from "lucide-react";
import { useDiscountCountdown } from "@/hooks/useDiscountCountdown";
import { useTranslation } from "react-i18next";

interface DiscountCountdownProps {
  expiresAt: string | null | undefined;
  isRTL: boolean;
  className?: string;
}

const DiscountCountdown: React.FC<DiscountCountdownProps> = ({ expiresAt, isRTL, className = "" }) => {
  const { days, hours, minutes, seconds, isExpired, hasExpiry } = useDiscountCountdown(expiresAt);
  const { t } = useTranslation();
  void isRTL; // Keep prop for backward-compatibility with existing callers
  if (!hasExpiry || isExpired) return null;

  const label = t("common.discountCountdown.endsIn");
  const parts = [
    { value: days, unit: t("common.discountCountdown.unitDay") },
    { value: hours, unit: t("common.discountCountdown.unitHour") },
    { value: minutes, unit: t("common.discountCountdown.unitMinute") },
    { value: seconds, unit: t("common.discountCountdown.unitSecond") },
  ];

  return (
    <div className={`flex items-center gap-1 flex-wrap justify-end ${className}`}>
      <Timer className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent-orange animate-pulse flex-shrink-0" />
      <span className="text-[10px] sm:text-[11px] font-semibold text-accent-orange/80 whitespace-nowrap">{label}</span>
      <span className="text-[10px] sm:text-xs font-mono font-bold text-accent-orange whitespace-nowrap">
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="mx-px">-</span>}
            {p.value}{p.unit}
          </React.Fragment>
        ))}
      </span>
    </div>
  );
};

export default DiscountCountdown;
