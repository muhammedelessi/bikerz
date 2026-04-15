import { supabase } from "@/integrations/supabase/client";
import { getGuestFingerprint } from "@/lib/guestFingerprint";

export const GUEST_PREVIEW_KEY_PREFIX = "bikerz_guest_preview_";
export const TRIAL_PENDING_KEY = "bikerz_trial_offer_pending";
export const FREE_TRIAL_KEY = "bikerz_free_trial";

export interface GuestPreviewState {
  watchedVideoId: string;
  startedAt: string;
}

export interface FreeTrialState {
  free_trial_course_id: string;
  free_trial_expires_at: string;
}

const getGuestPreviewKey = (courseId: string): string => `${GUEST_PREVIEW_KEY_PREFIX}${courseId}`;

export const getGuestPreviewState = (courseId: string): GuestPreviewState | null => {
  try {
    const raw = localStorage.getItem(getGuestPreviewKey(courseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestPreviewState;
    if (!parsed?.watchedVideoId || !parsed?.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setGuestPreviewState = (courseId: string, value: GuestPreviewState): void => {
  try {
    localStorage.setItem(getGuestPreviewKey(courseId), JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

export const clearGuestPreviewState = (courseId: string): void => {
  try {
    localStorage.removeItem(getGuestPreviewKey(courseId));
  } catch {
    // ignore
  }
};

export const markTrialOfferPending = (courseId: string): void => {
  try {
    localStorage.setItem(
      TRIAL_PENDING_KEY,
      JSON.stringify({ courseId, requestedAt: new Date().toISOString() }),
    );
  } catch {
    // ignore
  }
};

export const consumeTrialOfferPending = (): { courseId: string } | null => {
  try {
    const raw = localStorage.getItem(TRIAL_PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(TRIAL_PENDING_KEY);
    const parsed = JSON.parse(raw) as { courseId?: string };
    if (!parsed?.courseId) return null;
    return { courseId: parsed.courseId };
  } catch {
    return null;
  }
};

export const activateFreeTrialForCourse = (courseId: string): FreeTrialState => {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const payload: FreeTrialState = {
    free_trial_course_id: courseId,
    free_trial_expires_at: expiresAt,
  };
  try {
    localStorage.setItem(FREE_TRIAL_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
  return payload;
};

export const getActiveFreeTrial = (): FreeTrialState | null => {
  try {
    const raw = localStorage.getItem(FREE_TRIAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FreeTrialState;
    if (!parsed?.free_trial_course_id || !parsed?.free_trial_expires_at) return null;
    const expires = new Date(parsed.free_trial_expires_at).getTime();
    if (!Number.isFinite(expires) || expires <= Date.now()) {
      localStorage.removeItem(FREE_TRIAL_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearGuestPreviewStorage = (): void => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(GUEST_PREVIEW_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(TRIAL_PENDING_KEY);
    localStorage.removeItem(FREE_TRIAL_KEY);
  } catch {
    // ignore
  }
};

interface GuestPreviewCheckResult {
  allowed: boolean;
  reason?: string;
  video_id?: string;
  started_at?: string;
}

interface GuestPreviewRecordResult {
  recorded: boolean;
  reason?: string;
}

export const checkGuestPreviewOnServer = async (courseId: string): Promise<GuestPreviewCheckResult> => {
  try {
    const fingerprint = await getGuestFingerprint();
    const { data, error } = await supabase.functions.invoke("guest-preview-check", {
      body: {
        action: "check",
        fingerprint,
        course_id: courseId,
        video_id: "",
      },
    });

    if (error || !data) {
      return { allowed: true };
    }

    return {
      allowed: Boolean(data.allowed),
      reason: data.reason,
      video_id: data.video_id,
      started_at: data.started_at,
    };
  } catch {
    return { allowed: true };
  }
};

export const recordGuestPreviewOnServer = async (
  courseId: string,
  videoId: string,
): Promise<GuestPreviewRecordResult> => {
  try {
    const fingerprint = await getGuestFingerprint();
    const { data, error } = await supabase.functions.invoke("guest-preview-check", {
      body: {
        action: "record",
        fingerprint,
        course_id: courseId,
        video_id: videoId,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
    });

    if (error || !data) {
      return { recorded: false, reason: "error" };
    }

    return {
      recorded: Boolean(data.recorded),
      reason: data.reason,
    };
  } catch {
    return { recorded: false, reason: "error" };
  }
};
