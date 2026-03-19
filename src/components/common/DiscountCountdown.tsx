import React from "react";
import { Timer } from "lucide-react";
import { useDiscountCountdown } from "@/hooks/useDiscountCountdown";

interface DiscountCountdownProps {
  expiresAt: string | null | undefined;
  isRTL: boolean;
  className?: string;
}

const DiscountCountdown = React.forwardRef<HTMLDivElement, DiscountCountdownProps>(
  ({ expiresAt, isRTL, className = "" }, ref) => {
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
      <div ref={ref} className={`flex items-center gap-1 flex-wrap justify-end ${className}`}>
        <Timer className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent-orange animate-pulse flex-shrink-0" />
        <span className="text-[10px] sm:text-[11px] font-semibold text-accent-orange/80 whitespace-nowrap">{label}</span>
        <span className="text-[10px] sm:text-xs font-mono font-bold text-accent-orange whitespace-nowrap">
          {parts.map((p, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="mx-px">-</span>}
              {p.value}
              {p.unit}
            </React.Fragment>
          ))}
        </span>
      </div>
    );
  },
);

DiscountCountdown.displayName = "DiscountCountdown";

export default DiscountCountdown;
