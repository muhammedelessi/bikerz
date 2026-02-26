
-- Prevent duplicate revenue entries from webhook retries
-- First clean up any existing duplicates (keep the earliest)
DELETE FROM public.revenue_analytics a
USING public.revenue_analytics b
WHERE a.id > b.id
  AND a.payment_id = b.payment_id
  AND a.event_type = b.event_type
  AND a.payment_id IS NOT NULL;

-- Add unique constraint on (payment_id, event_type) for non-null payment_ids
CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_analytics_payment_dedup
  ON public.revenue_analytics (payment_id, event_type)
  WHERE payment_id IS NOT NULL;
