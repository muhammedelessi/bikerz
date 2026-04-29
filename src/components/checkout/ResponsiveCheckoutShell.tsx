/**
 * ResponsiveCheckoutShell — adaptive container for the checkout UI.
 *
 *   • Desktop (>=768px): renders the regular centered Dialog.
 *   • Mobile  (<768px):   renders a bottom-sheet Drawer (vaul) that slides up
 *                          from the bottom edge. Better keyboard behavior on
 *                          iOS, native-feeling swipe-to-close, and the safe
 *                          area at the bottom for the Pay button.
 *
 * The shell is intentionally dumb — it only swaps the chrome (Dialog vs
 * Drawer). All checkout state, header, content, and footer live inside the
 * `children` element passed by CheckoutModal so we don't duplicate logic.
 *
 * Why not a single component?
 * shadcn's Dialog and vaul's Drawer have different layout/scroll semantics:
 *   - Dialog wants a max-height + internal scroll
 *   - Drawer wants viewport-attached + body lock + drag handle
 * Trying to unify them via CSS produces flicker on the desktop→mobile
 * resize. Two implementations, one switch, no flicker.
 */
import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

interface ResponsiveCheckoutShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, swipe-to-close / overlay-click are disabled. Use during
   *  processing/3DS so a stray tap doesn't lose the user's session. */
  preventClose?: boolean;
  /** Accessible label for screen readers (Dialog/Drawer require a title). */
  a11yLabel: string;
  children: React.ReactNode;
  /** Optional: extra classes for the inner content wrapper. */
  className?: string;
}

const ResponsiveCheckoutShell: React.FC<ResponsiveCheckoutShellProps> = ({
  open,
  onOpenChange,
  preventClose = false,
  a11yLabel,
  children,
  className,
}) => {
  const isMobile = useIsMobile();

  const handleOpenChange = (next: boolean) => {
    if (!next && preventClose) return;
    onOpenChange(next);
  };

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={handleOpenChange}
        // dismissible=false prevents swipe-to-close while a charge is in-flight
        dismissible={!preventClose}
      >
        <DrawerContent
          className={[
            // 92dvh — leaves a small breathing strip so the drag handle is reachable.
            // dvh adapts to the soft keyboard on iOS so the Pay button never gets
            // trapped beneath the keyboard.
            "max-h-[92dvh] flex flex-col p-0 gap-0 border-2 border-border bg-card overflow-hidden",
            className || "",
          ].join(" ")}
        >
          {/* Drawer title is required by vaul/Radix for a11y but the
              checkout has its own visible header — hide via sr-only. */}
          <DrawerTitle className="sr-only">{a11yLabel}</DrawerTitle>
          {children}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={[
          "relative sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden border-2 border-border bg-card p-0 gap-0",
          className || "",
        ].join(" ")}
        onOpenAutoFocus={(e) => e.preventDefault()}
        aria-label={a11yLabel}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
};

export default ResponsiveCheckoutShell;
