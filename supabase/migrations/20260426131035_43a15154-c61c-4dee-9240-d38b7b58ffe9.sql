ALTER TABLE public.trainer_applications
  DROP CONSTRAINT IF EXISTS trainer_applications_status_check;

ALTER TABLE public.trainer_applications
  ADD CONSTRAINT trainer_applications_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));