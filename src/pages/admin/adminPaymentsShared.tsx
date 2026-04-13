import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, CreditCard, Banknote, GraduationCap } from "lucide-react";

export interface UnifiedPayment {
  id: string;
  user_id: string;
  course_id: string | null;
  /** Tap training booking link (for admin trainer payments). */
  training_id?: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  payment_method?: string;
  reference_number?: string | null;
  notes?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  charge_id?: string | null;
  card_brand?: string | null;
  card_last_four?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  error_message?: string | null;
  webhook_verified?: boolean | null;
  metadata?: Record<string, unknown> | null;
  tap_response?: Record<string, unknown> | null;
  device_info?: string | null;
  profile?: {
    full_name: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    postal_code: string | null;
    profile_complete: boolean;
  } | null;
  course?: {
    title: string | null;
    title_ar: string | null;
    price: number | null;
    discount_percentage: number | null;
  } | null;
  source: "manual" | "tap" | "training_booking";
  /** Populated when source is training_booking (paid practical training). */
  training_booking_meta?: {
    booking_status: string;
    payment_status: string;
    training_name_ar: string | null;
    training_name_en: string | null;
    trainer_name_ar: string | null;
    trainer_name_en: string | null;
  } | null;
}

export const normalizeStatus = (status: string, source: "manual" | "tap" | "training_booking"): string => {
  if (source === "training_booking") {
    if (status === "paid" || status === "succeeded" || status === "captured") return "approved";
    if (status === "failed" || status === "refunded" || status === "cancelled") return "rejected";
    return "pending";
  }
  if (source === "tap") {
    if (status === "succeeded" || status === "captured") return "approved";
    if (status === "failed" || status === "cancelled" || status === "expired" || status === "declined")
      return "rejected";
    if (status === "pending" || status === "processing" || status === "initiated") return "pending";
  }
  return status;
};

export const tapErrorTranslations: Record<string, { en: string; ar: string }> = {
  "101": { en: "Insufficient funds", ar: "رصيد غير كافٍ" },
  "102": { en: "Card expired", ar: "البطاقة منتهية الصلاحية" },
  "103": { en: "Card declined", ar: "تم رفض البطاقة" },
  "104": { en: "Invalid card number", ar: "رقم بطاقة غير صالح" },
  "105": { en: "Limit exceeded", ar: "تم تجاوز الحد المسموح" },
  "106": { en: "Card not supported", ar: "البطاقة غير مدعومة" },
  "107": { en: "Restricted card", ar: "بطاقة مقيّدة" },
  "108": { en: "Authentication failed", ar: "فشل التحقق" },
  "109": { en: "3D Secure failed", ar: "فشل التحقق الثلاثي" },
  "110": { en: "Transaction not permitted", ar: "العملية غير مسموحة" },
  "200": { en: "Communication error", ar: "خطأ في الاتصال" },
  "301": { en: "Transaction timeout", ar: "انتهت مهلة العملية" },
  "302": { en: "Transaction cancelled", ar: "تم إلغاء العملية" },
  "303": { en: "Duplicate transaction", ar: "عملية مكررة" },
  "401": { en: "Authentication required", ar: "مطلوب التحقق من الهوية" },
  "501": { en: "Gateway error", ar: "خطأ في بوابة الدفع" },
  "502": { en: "Gateway timeout", ar: "انتهت مهلة بوابة الدفع" },
  "507": { en: "Card declined by issuing bank (Card Issuer)", ar: "تم رفض البطاقة من قبل البنك المُصدر" },
};

export const getTranslatedErrorReason = (code: string | null, isRTL: boolean): string | null => {
  if (!code) return null;
  const translation = tapErrorTranslations[code];
  if (translation) return isRTL ? translation.ar : translation.en;
  return null;
};

export const getPriceBreakdown = (payment: UnifiedPayment) => {
  const meta = payment.metadata || {};
  const originalAmount = (meta.original_amount as number) || (meta.price_before_tax as number) || null;
  const couponDiscount = (meta.coupon_discount as number) || 0;
  const couponCode = (meta.coupon_code as string) || null;
  const courseDiscount = (meta.course_discount as number) || 0;

  const vatAmount = (meta.vat_amount as number) || null;
  const vatPct = (meta.vat_percentage as number) || 0;
  const hasVat = vatAmount !== null && vatAmount > 0;

  const amountBeforeVAT = hasVat ? payment.amount - vatAmount! : payment.amount;
  const calculatedVAT = hasVat ? vatAmount! : 0;

  return {
    originalAmount,
    couponDiscount,
    couponCode,
    vatAmount: calculatedVAT,
    amountBeforeVAT,
    courseDiscount,
    hasVat,
    vatPct,
  };
};

export const getFailureDetails = (payment: UnifiedPayment, isRTL: boolean) => {
  if (normalizeStatus(payment.status, payment.source) !== "rejected") return null;
  const resp = payment.tap_response || {};
  const response = resp.response as Record<string, unknown> | undefined;
  const gateway = resp.gateway as Record<string, unknown> | undefined;
  const code = (response?.code as string) || gateway?.response?.toString() || null;
  const translatedReason = getTranslatedErrorReason(code, isRTL);
  const tapDeclineMessage = (response?.message as string) || null;
  return {
    reason:
      translatedReason || payment.error_message || tapDeclineMessage || (isRTL ? "فشل الدفع" : "Payment failed"),
    code,
    gatewayResponse: (gateway?.response as string) || null,
    translatedReason,
    tapDeclineMessage,
  };
};

export const getPaymentMethodLabel = (payment: UnifiedPayment) => {
  if (payment.source === "manual") return payment.payment_method || "-";
  if (payment.source === "training_booking") return payment.payment_method || "Tap";
  const method = payment.payment_method?.toLowerCase() || "";
  if (method.includes("apple")) return "Apple Pay";
  if (method.includes("google")) return "Google Pay";
  if (payment.card_brand) {
    return `${payment.card_brand} •••• ${payment.card_last_four || ""}`;
  }
  return method || "Card";
};

export const getStatusBadge = (status: string, source: "manual" | "tap" | "training_booking", isRTL: boolean) => {
  const norm = normalizeStatus(status, source);
  const original = (source === "tap" || source === "training_booking") && norm !== status ? ` (${status})` : "";
  switch (norm) {
    case "pending":
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          <Clock className="w-3 h-3 me-1" />
          {isRTL ? "معلق" : "Pending"}
          {original}
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="w-3 h-3 me-1" />
          {isRTL ? "معتمد" : "Approved"}
          {original}
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
          <XCircle className="w-3 h-3 me-1" />
          {isRTL ? "مرفوض" : "Rejected"}
          {original}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const getSourceBadge = (source: "manual" | "tap" | "training_booking", isRTL: boolean) => {
  if (source === "training_booking") {
    return (
      <Badge variant="outline" className="bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300">
        <GraduationCap className="w-3 h-3 me-1" />
        {isRTL ? "تدريب" : "Training"}
      </Badge>
    );
  }
  if (source === "tap") {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
        <CreditCard className="w-3 h-3 me-1" />
        {isRTL ? "بطاقة" : "Card"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground border-muted">
      <Banknote className="w-3 h-3 me-1" />
      {isRTL ? "يدوي" : "Manual"}
    </Badge>
  );
};
