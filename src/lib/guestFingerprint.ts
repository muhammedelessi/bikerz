const GUEST_FINGERPRINT_KEY = "bikerz_guest_fingerprint";

const simpleHash = (input: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return (hash >>> 0).toString(36);
};

export async function getGuestFingerprint(): Promise<string> {
  try {
    const cached = localStorage.getItem(GUEST_FINGERPRINT_KEY);
    if (cached) return cached;
  } catch {
    // ignore
  }

  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const language = typeof navigator !== "undefined" ? navigator.language : "";
  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  const hardwareConcurrency = typeof navigator !== "undefined" ? String(navigator.hardwareConcurrency || 0) : "0";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const screenSignature =
    typeof screen !== "undefined" ? `${screen.width}x${screen.height}x${screen.colorDepth}` : "0x0x0";

  const raw = [
    userAgent,
    language,
    platform,
    hardwareConcurrency,
    timeZone,
    screenSignature,
  ].join("|");

  const fingerprint = `bfp_${simpleHash(raw)}`;

  try {
    localStorage.setItem(GUEST_FINGERPRINT_KEY, fingerprint);
  } catch {
    // ignore
  }

  return fingerprint;
}
