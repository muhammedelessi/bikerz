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
  // Use eTLD+1 where possible; fall back to hostname.
  return window.location.hostname;
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
    credentialIdBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
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

async function decryptPassword(
  credentialIdBytes: Uint8Array,
  stored: StoredBiometric,
): Promise<string> {
  const key = await deriveKey(credentialIdBytes, b64decode(stored.salt));
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(stored.iv) },
    key,
    b64decode(stored.ciphertext),
  );
  return new TextDecoder().decode(plainBuf);
}

/**
 * Enroll biometric for the given email + password. Prompts the OS biometric sheet.
 * Throws if the user cancels or the platform is unsupported.
 */
export async function enrollBiometric(email: string, password: string): Promise<void> {
  if (!isBiometricSupported()) {
    throw new Error("BIOMETRIC_UNSUPPORTED");
  }
  const available = await isPlatformAuthenticatorAvailable();
  if (!available) {
    throw new Error("PLATFORM_AUTHENTICATOR_UNAVAILABLE");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(email);

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: { name: RP_NAME, id: getRpId() },
    user: {
      id: userIdBytes,
      name: email,
      displayName: email,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    timeout: 60_000,
    attestation: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
    },
  };

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
 * Returns { email, password } on success; throws on cancel/failure.
 */
export async function authenticateBiometric(): Promise<{ email: string; password: string }> {
  const stored = readStored();
  if (!stored) throw new Error("BIOMETRIC_NOT_ENROLLED");
  if (!isBiometricSupported()) throw new Error("BIOMETRIC_UNSUPPORTED");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credentialIdBytes = b64decode(stored.credentialId);

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: getRpId(),
    timeout: 60_000,
    userVerification: "required",
    allowCredentials: [
      {
        type: "public-key",
        id: credentialIdBytes,
        transports: ["internal"],
      },
    ],
  };

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("BIOMETRIC_CANCELLED");

  const rawId = new Uint8Array(assertion.rawId);
  const password = await decryptPassword(rawId, stored);
  return { email: stored.email, password };
}
