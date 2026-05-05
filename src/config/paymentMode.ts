/**
 * Payment-mode switch.
 *
 * 'hosted'   — full Tap redirect: user clicks Pay → backend creates a charge
 *              with no client-tokenized card → Tap returns a redirect_url to
 *              its hosted form → we window.location.assign() the user there
 *              → user enters card + OTP on Tap's domain → redirected back
 *              to /payment-success?tap_id=... for verification. This bypasses
 *              the embedded card SDK iframe AND the inline 3DS iframe — the
 *              two surfaces with the most reported issues — at the cost of
 *              briefly showing Tap's branding instead of ours.
 *
 * 'embedded' — current flow: Tap Card SDK iframe inside our checkout, inline
 *              3DS modal with postMessage handshake. Branded, but more moving
 *              parts that can break.
 *
 * Set to 'hosted' as a stop-gap while embedded-flow issues are investigated.
 * Flip back to 'embedded' once we're confident the iframe stack is solid.
 *
 * To change at runtime without a code edit, set VITE_TAP_PAYMENT_MODE to
 * 'embedded' or 'hosted' in the build environment.
 */
export type PaymentMode = "hosted" | "embedded";

const ENV_MODE = (import.meta.env?.VITE_TAP_PAYMENT_MODE as string | undefined)?.toLowerCase();

export const PAYMENT_MODE: PaymentMode =
  ENV_MODE === "embedded" ? "embedded" : "hosted";

export const isHostedMode = () => PAYMENT_MODE === "hosted";
export const isEmbeddedMode = () => PAYMENT_MODE === "embedded";
