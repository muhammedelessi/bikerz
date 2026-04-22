/**
 * Biometric authentication service
 *
 * Uses WebAuthn + platform authenticator (Touch ID, Face ID, Windows Hello, Android fingerprint)
 * to gate access to locally-stored sign-in credentials. After a successful biometric ceremony
 * the saved email/password are decrypted and returned so the caller can sign in.
 *
 * Security model: ciphertext and key material both live on the same device, so this matches
 * the security level of the existing "remember me" feature while adding a biometric UI gate.
 * It is a convenience feature, not a server-verified FIDO credential.
 *
 * Important (Safari / iOS): WebAuthn must run close to a user gesture. Avoid `await`ing
 * unrelated work (e.g. network) before `navigator.credentials.create/get` — see enroll flow in UI.
 */

const STORAGE_KEY = "bikerz_biometric_v1";
const RP_NAME = "BIKERZ Academy";

interface StoredBiometric {
  credentialId: string;
  email: string;
  ciphertext: string;
  iv: string;
  salt: string;
  createdAt: number;
}

function b64encode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.byteLength; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function b64decode(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getRpId(): string {
  return window.location.hostname;
}

/** WebAuthn user.id must be 1–64 bytes (UTF-8). Long emails are truncated deterministically. */
function webauthnUserId(email: string): Uint8Array {
  const buf = new TextEncoder().encode(email.trim().toLowerCase());
  if (buf.byteLength === 0) return new Uint8Array([0x30]);
  if (buf.byteLength <= 64) return buf;
  return buf.slice(0, 64);
}

export function isBiometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    const anyPK = window.PublicKeyCredential as unknown as {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
    };
    if (typeof anyPK.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await anyPK.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {
    return false;
  }
  return false;
}

function readStored(): StoredBiometric | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredBiometric;
  } catch {
    return null;
  }
}

function writeStored(data: StoredBiometric): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getEnrolledEmail(): string | null {
  const s = readStored();
  return s?.email ?? null;
}

export function isBiometricEnrolled(): boolean {
  return readStored() !== null;
}

export function clearBiometric(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function deriveKey(credentialIdBytes: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    credentialIdBytes as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 120_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPassword(
  credentialIdBytes: Uint8Array,
  password: string,
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(credentialIdBytes, salt);
  const enc = new TextEncoder().encode(password);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc);
  return {
    ciphertext: b64encode(cipherBuf),
    iv: b64encode(iv),
    salt: b64encode(salt),
  };
}

async function decryptPassword(credentialIdBytes: Uint8Array, stored: StoredBiometric): Promise<string> {
  const key = await deriveKey(credentialIdBytes, b64decode(stored.salt));
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(stored.iv) as BufferSource },
    key,
    b64decode(stored.ciphertext),
  );
  return new TextDecoder().decode(plainBuf);
}

export type BiometricErrorCode =
  | "BIOMETRIC_UNSUPPORTED"
  | "BIOMETRIC_NOT_ENROLLED"
  | "BIOMETRIC_CANCELLED"
  | "BIOMETRIC_DECRYPT_FAILED"
  | "NOT_ALLOWED"
  | "UNKNOWN";

/** Map DOMException / Error to a stable code for UI. */
export function normalizeBiometricError(err: unknown): { code: BiometricErrorCode; message: string } {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);

  if (msg === "BIOMETRIC_NOT_ENROLLED" || msg === "BIOMETRIC_UNSUPPORTED" || msg === "BIOMETRIC_DECRYPT_FAILED") {
    return { code: msg as BiometricErrorCode, message: msg };
  }
  if (name === "NotAllowedError" || msg.includes("NotAllowedError")) {
    return { code: "NOT_ALLOWED", message: name || msg };
  }
  if (name === "AbortError" || msg.includes("AbortError")) {
    return { code: "BIOMETRIC_CANCELLED", message: name || msg };
  }
  if (name === "SecurityError" || msg.includes("SecurityError")) {
    return { code: "BIOMETRIC_UNSUPPORTED", message: name || msg };
  }
  if (name === "InvalidStateError" || msg.includes("InvalidStateError")) {
    return { code: "NOT_ALLOWED", message: name || msg };
  }
  if (name === "NotSupportedError" || msg.includes("NotSupportedError")) {
    return { code: "BIOMETRIC_UNSUPPORTED", message: name || msg };
  }
  return { code: "UNKNOWN", message: msg };
}

/**
 * Enroll biometric for the given email + password. Prompts the OS biometric sheet.
 * Call this directly from a click handler — do not await unrelated async work before this
 * (Safari will block Face ID / Touch ID). Pre-check platform with isPlatformAuthenticatorAvailable in the UI.
 */
export async function enrollBiometric(email: string, password: string): Promise<void> {
  if (!isBiometricSupported()) {
    throw new Error("BIOMETRIC_UNSUPPORTED");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = webauthnUserId(email);

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: { name: RP_NAME, id: getRpId() },
    user: {
      id: userIdBytes as BufferSource,
      name: email,
      displayName: email,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    timeout: 60_000,
    attestation: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "discouraged",
    },
  };

  // First await in this function must be WebAuthn (iOS user-activation requirement).
  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error("BIOMETRIC_CANCELLED");

  const rawId = new Uint8Array(credential.rawId);
  const { ciphertext, iv, salt } = await encryptPassword(rawId, password);

  writeStored({
    credentialId: b64encode(rawId),
    email,
    ciphertext,
    iv,
    salt,
    createdAt: Date.now(),
  });
}

/**
 * Prompt the OS biometric sheet to unlock saved credentials.
 * Prefer calling from a click handler without setState/await before this in the handler.
 */
export async function authenticateBiometric(): Promise<{ email: string; password: string }> {
  const stored = readStored();
  if (!stored) throw new Error("BIOMETRIC_NOT_ENROLLED");
  if (!isBiometricSupported()) throw new Error("BIOMETRIC_UNSUPPORTED");

  const keyBytes = b64decode(stored.credentialId);

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: getRpId(),
    timeout: 60_000,
    userVerification: "required",
    allowCredentials: [
      {
        type: "public-key",
        id: keyBytes as BufferSource,
        transports: ["internal"],
      },
    ],
  };

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("BIOMETRIC_CANCELLED");

  try {
    // Always use stored credential id for decryption (same bytes as enrollment; avoids buffer/view quirks).
    const password = await decryptPassword(keyBytes, stored);
    return { email: stored.email, password };
  } catch {
    throw new Error("BIOMETRIC_DECRYPT_FAILED");
  }
}
