
Goal: eliminate the iOS black/white blank screen on published pages by hardening startup, reducing WebKit compositor risk, and adding missing compatibility fallbacks.

What I found in current code:
1) A blocking third-party script is loaded in `<head>` (`GoHighLevel` script without `async/defer` in `index.html`), which can stall/brick first paint on iOS network/privacy conditions.
2) Multiple high-risk WebKit compositing combinations are present on the landing path:
   - `fixed/sticky` containers + `backdrop-blur-*` (Navbar, overlays)
   - animated transforms on top fixed nav (`motion.nav`)
   - heavy decorative blur/blend layers in hero (`blur-[120px]`, `mix-blend-overlay`)
3) Missing legacy fallback in `src/hooks/use-mobile.tsx`: `MediaQueryList.addEventListener("change")` is not supported on older iOS Safari (needs `addListener/removeListener` fallback).
4) Viewport is currently `width=device-width, initial-scale=1.0`; safe-area usage exists, but `viewport-fit=cover` is missing.

Implementation plan:
1) Harden initial page boot (high priority)
   - File: `index.html`
   - Convert non-critical tracking scripts to non-blocking load (`defer`/lazy injection after app start).
   - Keep app bootstrap independent: ensure `/src/main.tsx` is never gated by third-party scripts.
   - Wrap tracker init calls in defensive checks to avoid startup exceptions.

2) Add explicit iOS safe-mode flag
   - File: `src/main.tsx`
   - Detect iOS WebKit at runtime and add `html.ios-webkit` class once.
   - This allows precise fallback CSS instead of broad `@supports` rules that can accidentally hide content.

3) Apply targeted iOS rendering fallbacks (not global nukes)
   - File: `src/index.css`
   - Under `.ios-webkit`, replace problematic effects only on risky layers:
     - Disable/reduce `backdrop-filter` on fixed/sticky nav and full-screen overlays.
     - Disable decorative `mix-blend-mode` and very large blur glows.
     - Keep content visible by replacing blur with opaque/semi-opaque background tokens.
   - Avoid blanket opacity rules.

4) Remove transform+fixed nav conflict on iOS
   - File: `src/components/layout/Navbar.tsx`
   - On iOS safe mode, disable initial motion transform for the nav (or switch nav animation to opacity only).
   - Keep `sticky` behavior for iOS and avoid compositing-heavy transitions on the top bar.

5) Patch JS compatibility fallbacks
   - File: `src/hooks/use-mobile.tsx`
   - Add `addListener/removeListener` fallback when `addEventListener` is unavailable on `MediaQueryList`.
   - Optional hardening: guard other non-critical APIs used on user interaction paths (`navigator.clipboard`, `sendBeacon`) to prevent secondary crashes.

6) Update viewport/meta for iOS layout stability
   - File: `index.html`
   - Change viewport to include `viewport-fit=cover`.
   - Keep safe-area CSS already in place and verify no clipped/hidden content.

7) Verify end-to-end on published build
   - Test routes on iOS Safari + iOS Chrome: `/`, `/index`, `/index.html`.
   - Confirm first paint, navbar visibility, hero visibility, and scroll behavior.
   - Re-check console for unhandled errors and verify no blank screen regressions.

Technical details (why this should fix it):
- iOS browsers all use WebKit; compositing bugs are triggered by combinations of `fixed/sticky + backdrop-filter + transforms + blend/large blur`.
- A synchronous third-party `<script>` in `<head>` can block rendering on iOS under privacy/network constraints.
- `MediaQueryList.addEventListener` fallback prevents hard runtime failures on older iOS Safari engines.
- `viewport-fit=cover` aligns with existing safe-area usage and reduces iOS viewport edge-case rendering issues.

Minimal-risk rollout order:
1) `index.html` script loading + viewport fix
2) `use-mobile.tsx` fallback
3) iOS-safe CSS overrides
4) navbar iOS animation downgrade
5) publish and validate on physical iOS devices
