import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useGHLFormWebhook } from "@/hooks/useGHLFormWebhook";
import { useLanguage } from "@/contexts/LanguageContext";
import { createGuestAccount, sendPasswordReset, updateProfile } from "@/services/supabase.service";
import { COUNTRIES } from "@/data/countryCityData";

export function useGuestSignup() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { sendFormData } = useGHLFormWebhook();
  const [guestSigningUp, setGuestSigningUp] = useState(false);

  const generatePassword = useCallback(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => chars[b % chars.length]).join("");
  }, []);

  const handleGuestSignup = useCallback(
    async (
      email: string,
      fullName: string,
      profileData: {
        phone: string;
        city: string;
        country: string;
        postalCode: string;
      },
    ): Promise<string | null> => {
      setGuestSigningUp(true);
      try {
        const password = generatePassword();
        const { data, error } = await createGuestAccount(email.trim(), fullName.trim(), password);

        if (error) {
          if (error.message?.includes("already registered") || error.message?.includes("already exists")) {
            toast.error(t("auth.signup.emailExists"));
            return null;
          }
          throw error;
        }

        if (!data.user) throw new Error("Account creation failed");

        await new Promise((resolve) => setTimeout(resolve, 500));

        // Resolve country English name from code
        const countryEntry = COUNTRIES.find(
          (c) => c.code === profileData.country || c.en === profileData.country || c.ar === profileData.country,
        );
        const countryName = countryEntry ? countryEntry.code : profileData.country;

        // Resolve city English name
        const cityEntry = countryEntry?.cities.find((c) => c.ar === profileData.city || c.en === profileData.city);
        const cityName = cityEntry ? cityEntry.en : profileData.city;

        // Clean phone — remove leading zero
        const digits = profileData.phone.replace(/[^0-9+]/g, "");
        const cleanPhone = digits.startsWith("00") ? "+" + digits.slice(2) : digits;

        await updateProfile(data.user.id, {
          full_name: fullName.trim(),
          phone: cleanPhone,
          city: cityName,
          country: countryName,
          postal_code: profileData.postalCode || null,
          profile_complete: true,
        });

        sendFormData({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: cleanPhone,
          country: countryName,
          city: cityName,
          address: [cityName, countryName].filter(Boolean).join(", "),
          orderStatus: "not purchased",
          courses: "[]",
          totalPurchased: 0,
          dateOfBirth: "",
          gender: "",
          isRTL,
        });

        sendPasswordReset(email.trim());
        return data.user.id;
      } catch (err: any) {
        console.error("Guest signup error:", err);
        toast.error(err.message || t("checkout.failedToCreateAccount"));
        return null;
      } finally {
        setGuestSigningUp(false);
      }
    },
    [generatePassword, t, sendFormData, isRTL],
  );

  return { guestSigningUp, handleGuestSignup };
}
