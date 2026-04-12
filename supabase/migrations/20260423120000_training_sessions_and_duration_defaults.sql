-- Catalog defaults (used when assigning a training to a trainer).
ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS default_sessions_count integer NOT NULL DEFAULT 1
    CHECK (default_sessions_count >= 1);

ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS default_session_duration_hours double precision NOT NULL DEFAULT 2
    CHECK (default_session_duration_hours > 0);

-- Per-trainer offering: number of sessions in the package (each booking slot still uses duration_hours).
ALTER TABLE public.trainer_courses
  ADD COLUMN IF NOT EXISTS sessions_count integer NOT NULL DEFAULT 1
    CHECK (sessions_count >= 1);

COMMENT ON COLUMN public.trainings.default_sessions_count IS 'Default number of sessions when a trainer is assigned this program.';
COMMENT ON COLUMN public.trainings.default_session_duration_hours IS 'Default hours per session for booking slots when assigning this program.';
COMMENT ON COLUMN public.trainer_courses.sessions_count IS 'Number of sessions in the package for this trainer offer.';
COMMENT ON COLUMN public.trainer_courses.duration_hours IS 'Hours per single session (used for calendar slot length).';
