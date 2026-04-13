export interface FormWebhookData {
  full_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  address?: string;
  courseName?: string;
  amount?: string;
  /** ISO currency code for the amount (e.g. SAR) */
  currency?: string;
  orderStatus?: string;
  courses?: string;
  totalPurchased?: number;
  dateOfBirth?: string;
  gender?: string;
  isRTL?: boolean;
  silent?: boolean;
  /** Contact / support ticket (Contact Us page) */
  ticket_subject?: string;
  ticket_message?: string;
  ticket_category?: string;
}
