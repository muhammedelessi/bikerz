/**
 * Support contact configuration.
 *
 * The WhatsApp number is read from a Vite env var so it can be swapped per
 * environment without a code change. We also expose a small helper that
 * builds a wa.me link with a prefilled message — the message text is composed
 * by the caller (e.g. CheckoutWhatsAppHelp) so each context can include the
 * relevant details (course id, error code, charge id…).
 */

/** E.164 number WITHOUT the leading "+" — wa.me requires that format. */
const FALLBACK_WHATSAPP_E164 = "966500000000"; // TODO: replace with the live support number

/** Read from Vite env if present; otherwise fall back. Strip any "+" or spaces. */
function resolveWhatsAppNumber(): string {
  const raw =
    (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SUPPORT_WHATSAPP) ||
    FALLBACK_WHATSAPP_E164;
  return String(raw).replace(/[^0-9]/g, "");
}

export const SUPPORT_WHATSAPP_E164 = resolveWhatsAppNumber();

/**
 * Build a wa.me deep link with a prefilled message.
 *
 * @param message Plain text — newlines are preserved by WhatsApp.
 * @returns Absolute https URL safe to use in `<a href="…" target="_blank">`.
 */
export function buildWhatsAppLink(message: string): string {
  const number = SUPPORT_WHATSAPP_E164;
  const text = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${text}`;
}
