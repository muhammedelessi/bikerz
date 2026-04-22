export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay';
export type PaymentStatus = 'idle' | 'processing' | 'verifying' | 'succeeded' | 'failed';

export type TapPaymentKind = 'course' | 'training_booking' | 'course_bundle';

export interface TapPaymentConfig {
  /** Video course id (omit when paymentKind is training_booking or course_bundle) */
  courseId?: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  /** Billing from checkout form — used by Tap charge when profile is stale or wrong */
  billingCity?: string;
  billingCountry?: string;
  couponId?: string;
  paymentMethod?: PaymentMethod;
  tokenId?: string;
  amount?: number;
  courseName?: string;
  isRTL?: boolean;
  couponSeriesId?: string;
  couponNumber?: number;
  couponCode?: string;
  paymentKind?: TapPaymentKind;
  /** Required when paymentKind is training_booking */
  trainerCourseId?: string;
  /** `trainings.id` for this practical session (sent as course_id / training_id to the payment API) */
  trainingId?: string;
  /** When paymentKind is course_bundle */
  bundleCourseIds?: string[];
  bundleOriginalSar?: number;
  bundleDiscountPct?: number;
  bundleFinalSar?: number;
  /** User's display currency (must match bundle pricing on server) */
  currencyCodeForPricing?: string;
  /** Local currency units per 1 SAR — same as CurrencyContext `exchangeRate`; keeps Tap charge aligned with on-screen totals */
  exchangeRatePerSar?: number;
}

export interface CheckoutCourse {
  id: string;
  title: string;
  title_ar: string | null;
  price: number;
  discount_percentage?: number | null;
  discount_expires_at?: string | null;
  thumbnail_url: string | null;
  vat_percentage?: number | null;
}

export interface AppliedCoupon {
  coupon_id?: string | null;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  final_amount: number;
  coupon_series_id?: string | null;
  coupon_number?: number | null;
  coupon_code?: string | null;
}

export interface ValidationErrors {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
}
