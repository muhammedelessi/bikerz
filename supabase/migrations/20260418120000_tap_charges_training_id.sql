-- Practical training program id for trainer-session Tap charges (course_id stays for video courses only)
ALTER TABLE public.tap_charges
  ADD COLUMN IF NOT EXISTS training_id uuid REFERENCES public.trainings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tap_charges_training_id ON public.tap_charges(training_id);

COMMENT ON COLUMN public.tap_charges.training_id IS 'trainings.id for trainer booking payments; tap_charges.course_id remains for video course purchases.';
