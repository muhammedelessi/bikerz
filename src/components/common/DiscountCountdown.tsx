import React from "react";
import { Timer } from "lucide-react";
import { useDiscountCountdown } from "@/hooks/useDiscountCountdown";

interface DiscountCountdownProps {
  expiresAt: string | null | undefined;
  isRTL: boolean;
  className?: string;
}

var DiscountCountdown = React.forwardRef<HTMLDivElement, DiscountCountdownProps>(
  function DiscountCountdownInner(props, ref) {
    var expiresAt = props.expiresAt;
    var isRTL = props.isRTL;
    var className = props.className || "";

    var countdown = useDiscountCountdown(expiresAt);
    var days = countdown.days;
    var hours = countdown.hours;
    var minutes = countdown.minutes;
    var seconds = countdown.seconds;
    var isExpired = countdown.isExpired;
    var hasExpiry = countdown.hasExpiry;

    if (!hasExpiry || isExpired) return null;

    var label = isRTL ? "ينتهي خلال:" : "Ends in:";

    var parts = isRTL
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

    var segments: React.ReactNode[] = [];
    for (var i = 0; i < parts.length; i++) {
      if (i > 0) {
        segments.push(
          React.createElement("span", { key: "sep-" + i, className: "mx-px" }, "-")
        );
      }
      segments.push(
        React.createElement(React.Fragment, { key: "val-" + i }, String(parts[i].value) + parts[i].unit)
      );
    }

    return React.createElement(
      "div",
      {
        ref: ref,
        className: "discount-countdown flex items-center gap-1 flex-wrap justify-end " + className,
      },
      React.createElement(Timer, {
        className: "w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent-orange animate-pulse flex-shrink-0",
      }),
      React.createElement(
        "span",
        { className: "text-[10px] sm:text-[11px] font-semibold text-accent-orange/80 whitespace-nowrap" },
        label
      ),
      React.createElement(
        "span",
        { className: "text-[10px] sm:text-xs font-mono font-bold text-accent-orange whitespace-nowrap" },
        segments
      )
    );
  }
);

DiscountCountdown.displayName = "DiscountCountdown";

export default DiscountCountdown;
