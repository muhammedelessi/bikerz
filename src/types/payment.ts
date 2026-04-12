export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay';
export type PaymentStatus = 'idle' | 'processing' | 'verifying' | 'succeeded' | 'failed';

export type TapPaymentKind = 'course' | 'training_booking';

export interface TapPaymentConfig {
  /** Video course id (omit when paymentKind is training_booking) */
  courseId?: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  couponId?: string;
  paymentMethod?: PaymentMethod;
  tokenId?: string;
  amount?: number;
  courseName?: string;
  isRTL?: boolean;
  paymentKind?: TapPaymentKind;
  /** Required when paymentKind is training_booking */
  trainerCourseId?: string;
  /** `trainings.id` for this practical session (sent as course_id / training_id to the payment API) */
  trainingId?: string;
}

export interface CheckoutCourse {
  id: string;
  title: string;
  title_ar: string | null;
  price: number;
  discount_percentage?: number | null;
  thumbnail_url: string | null;
  vat_percentage?: number | null;
}

export interface AppliedCoupon {
  coupon_id: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  final_amount: number;
}

export interface ValidationErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
}
