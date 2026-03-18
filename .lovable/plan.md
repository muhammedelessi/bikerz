
Objective: stop iPhone Safari black/blank first paint after recent UI changes.

Findings from code review:
1) `main.tsx` and `App.tsx` boot path is already guarded; no obvious direct iOS-break there.
2) High-risk iOS WebKit breakpoints were added in UI layer:
   - `Navbar.tsx` uses `new ResizeObserver(...)` without feature detection.
   - Landing sections rely on `useInView` + `initial={{ opacity: 0 }}`; if observer/animation fails, content stays invisible (appears black on dark theme).
   - Framer warning source: `DiscountCountdown` is used in animated/link contexts without `forwardRef` (can destabilize layout/presence behavior on WebKit).
   - Hero/CTA include aggressive blur/blend layers that can trigger iOS compositor black rendering on some devices.

Implementation plan:
1) Harden unsupported browser APIs (primary fix)
   - In `src/components/layout/Navbar.tsx`, guard `ResizeObserver`.
   - Fallback to `window.resize` listener when `ResizeObserver` is unavailable.
   - Ensure cleanup paths handle both observer and listener.

2) Remove “stuck invisible” paths on landing page (primary fix)
   - In `FeaturedCoursesSection.tsx`, `WhySection.tsx`, `JourneySection.tsx`, `CTASection.tsx`, `LearnSection.tsx`, `CommunitySection.tsx`:
     - set `useInView(..., { fallbackInView: true })`
     - avoid `animate={inView ? ... : {}}` patterns that can leave `initial` opacity at 0.
   - Keep above-the-fold hero text/buttons visible by default if animation can’t start.

3) Fix ref incompatibility in animated discount components (stability fix)
   - Convert `src/components/common/DiscountCountdown.tsx` to `React.forwardRef`.
   - Attach ref to root `<div>` to satisfy animated/link contexts and remove warning path.

4) Add iOS-safe visual fallback for heavy effects (targeted compatibility fix)
   - In `HeroSection.tsx` and `CTASection.tsx`, conditionally reduce/disable expensive blend+blur layers on iOS WebKit.
   - Keep visual design close, but avoid compositor-heavy combination that can black out rendering.

Technical details (files to update):
- `src/components/layout/Navbar.tsx`
- `src/components/common/DiscountCountdown.tsx`
- `src/components/landing/HeroSection.tsx`
- `src/components/landing/CTASection.tsx`
- `src/components/landing/FeaturedCoursesSection.tsx`
- `src/components/landing/WhySection.tsx`
- `src/components/landing/JourneySection.tsx`
- `src/components/landing/LearnSection.tsx`
- `src/components/landing/CommunitySection.tsx`

Verification plan:
1) Test published site on iPhone Safari (normal + private mode).
2) Confirm page paints immediately (no blank/black).
3) Confirm no runtime fatal errors and no ref warnings in console.
4) Confirm landing animations still run where supported and degrade gracefully where not.
