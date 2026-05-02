import type { NavigateFunction } from "react-router-dom";

const KEY = "bikerz_return_url";
const ORIGIN_KEY = "bikerz_signup_origin";

/**
 * Tag GHL on what triggered a user signup. Set by the caller right before
 * navigating to `/signup`; consumed once by the signup page after the
 * account is created so the GHL profile webhook can include an
 * `event_type` ("signup", "course_page", "guest_signup", "profile_update").
 *
 * `course_page` specifically marks signups initiated from the "free
 * preview ended — create an account to continue" toast, which is a
 * higher-intent flow than a generic top-bar "Sign up" click.
 */
export type SignupOrigin = "signup" | "course_page" | "guest_signup" | "profile_update";

export function setSignupOrigin(origin: SignupOrigin): void {
  try {
    sessionStorage.setItem(ORIGIN_KEY, origin);
  } catch {
    /* ignore */
  }
}

/** Read and clear the one-time signup origin. Defaults to "signup" when unset. */
export function consumeSignupOrigin(): SignupOrigin {
  try {
    const v = sessionStorage.getItem(ORIGIN_KEY) as SignupOrigin | null;
    if (v) sessionStorage.removeItem(ORIGIN_KEY);
    return v || "signup";
  } catch {
    return "signup";
  }
}

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
