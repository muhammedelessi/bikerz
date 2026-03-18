import React from "react";
import { Timer } from "lucide-react";
import { useDiscountCountdown } from "@/hooks/useDiscountCountdown";

interface DiscountCountdownProps {
  expiresAt: string | null | undefined;
  isRTL: boolean;
  className?: string;
}

const DiscountCountdown: React.FC<DiscountCountdownProps> = ({ expiresAt, isRTL, className = "" }) => {
  const { days, hours, minutes, seconds, isExpired, hasExpiry } = useDiscountCountdown(expiresAt);
  if (!hasExpiry || isExpired) return null;

  const label = isRTL ? "ينتهي خلال:" : "Ends in:";
  const parts = isRTL
    ? [
        { value: days, unit: "ي" },
        { value: hours, unit: "س" },
        { value: minutes, unit: "د" },
        { value: seconds, unit: "ث" },
      ]
    : [
        { value: days, unit: "d" },
        { value: hours, unit: "h" },
        { value: minutes, unit: "m" },
        { value: seconds, unit: "s" },
      ];

  return (
    <div className={`flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <Timer className="w-3.5 h-3.5 text-accent-orange animate-pulse flex-shrink-0" />
      <span className="text-[11px] font-semibold text-accent-orange/80">{label}</span>
      {parts.map((p, i) => (
        <span key={i} className="text-xs font-mono font-bold text-accent-orange">
          {p.value}{p.unit}
        </span>
      ))}
    </div>
  );
};

export default DiscountCountdown;
