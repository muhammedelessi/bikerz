import { useCallback } from "react";
import { sendGHLProfileData, type ProfileWebhookData } from "@/services/ghl.service";

/**
 * Sends the user's personal profile fields to the dedicated GHL profile webhook.
 * Trigger on: signup ("registration") and any profile update ("profile_update").
 * Errors are swallowed — webhook delivery is best-effort, never block the UI.
 */
export function useProfileWebhook() {
  const sendProfileData = useCallback(async (data: ProfileWebhookData) => {
    try {
      return await sendGHLProfileData(data);
    } catch (err) {
      console.error("Profile webhook failed:", err);
      return false;
    }
  }, []);

  return { sendProfileData };
}
