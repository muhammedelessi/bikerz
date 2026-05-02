-- 1) Add videos & skills to trainings
ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS videos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Skill evaluations per booking
CREATE TABLE IF NOT EXISTS public.training_booking_skill_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.training_bookings(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL,
  skill_index integer NOT NULL,
  skill_name_ar text,
  skill_name_en text,
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, skill_index)
);

CREATE INDEX IF NOT EXISTS idx_tbse_booking ON public.training_booking_skill_evaluations(booking_id);
CREATE INDEX IF NOT EXISTS idx_tbse_trainer ON public.training_booking_skill_evaluations(trainer_id);

ALTER TABLE public.training_booking_skill_evaluations ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins manage skill evaluations"
ON public.training_booking_skill_evaluations
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Trainer (owner of the booking) can manage their own evaluations
CREATE POLICY "Trainer can view own evaluations"
ON public.training_booking_skill_evaluations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trainers t
    WHERE t.id = training_booking_skill_evaluations.trainer_id
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Trainer can insert own evaluations"
ON public.training_booking_skill_evaluations
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trainers t
    WHERE t.id = training_booking_skill_evaluations.trainer_id
      AND t.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.training_bookings tb
    WHERE tb.id = training_booking_skill_evaluations.booking_id
      AND tb.trainer_id = training_booking_skill_evaluations.trainer_id
  )
);

CREATE POLICY "Trainer can update own evaluations"
ON public.training_booking_skill_evaluations
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trainers t
    WHERE t.id = training_booking_skill_evaluations.trainer_id
      AND t.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trainers t
    WHERE t.id = training_booking_skill_evaluations.trainer_id
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Trainer can delete own evaluations"
ON public.training_booking_skill_evaluations
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trainers t
    WHERE t.id = training_booking_skill_evaluations.trainer_id
      AND t.user_id = auth.uid()
  )
);

-- Student (booking owner) can view their evaluations
CREATE POLICY "Student can view own evaluations"
ON public.training_booking_skill_evaluations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.training_bookings tb
    WHERE tb.id = training_booking_skill_evaluations.booking_id
      AND tb.user_id = auth.uid()
  )
);

CREATE TRIGGER trg_tbse_updated_at
BEFORE UPDATE ON public.training_booking_skill_evaluations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();