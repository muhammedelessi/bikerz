import type { NavigateFunction } from "react-router-dom";

const KEY = "bikerz_return_url";

/** Persist current path + query so user returns here after signup/login. */
export function setReturnUrlFromCurrentLocation(): void {
  try {
    sessionStorage.setItem(KEY, window.location.pathname + window.location.search);
  } catch {
    /* ignore */
  }
}

export function setReturnUrl(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    /* ignore */
  }
}

/** Read and clear one-time return URL (prefer over query `returnTo` when both exist). */
export function consumeReturnUrl(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}

export function navigateToSignup(navigate: NavigateFunction): void {
  setReturnUrlFromCurrentLocation();
  navigate("/signup");
}
