-- Add discount_percentage column to courses table
ALTER TABLE public.courses ADD COLUMN discount_percentage numeric DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.courses.discount_percentage IS 'Discount percentage (0-100). When > 0, the original price is shown with strikethrough and the discounted price is displayed.';