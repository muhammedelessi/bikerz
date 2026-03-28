export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay';
export type PaymentStatus = 'idle' | 'processing' | 'verifying' | 'succeeded' | 'failed';

export interface TapPaymentConfig {
  courseId: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  couponId?: string;
  paymentMethod?: PaymentMethod;
  tokenId?: string;
}

export interface CheckoutCourse {
  id: string;
  title: string;
  title_ar: string | null;
  price: number;
  discount_percentage?: number | null;
  thumbnail_url: string | null;
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
