-- Keep trainer_courses.sessions_count + trainer_courses.duration_hours
-- in sync with the canonical fields on trainings.
--
-- Why:
--   - The product owner clarified that trainings.default_sessions_count and
--     trainings.default_session_duration_hours are the SINGLE source of
--     truth for "how many sessions" and "how long is each session".
--   - The trainer_courses join table has its own copies of these values
--     (legacy: each trainer could once override them). Without sync, an
--     admin updating the canonical fields on trainings leaves stale values
--     on every previously-created trainer_courses row → the trainee sees
--     "5 sessions" on the training page and "3 sessions" on the trainer's
--     card for the same offering.
--   - Read-time fallbacks help the public pages, but the booking flow
--     (TrainingBookingFlow) operates on trainer_courses directly, so we
--     also need the underlying rows to stay in lockstep.
--
-- Strategy:
--   1) BACKFILL existing rows once (idempotent).
--   2) AFTER UPDATE trigger on trainings: when the canonical fields change,
--      cascade the new values to all trainer_courses for that training.
--   3) BEFORE INSERT trigger on trainer_courses: if the inserted row leaves
--      sessions_count / duration_hours NULL or zero, copy from trainings.
--
-- Reversibility:
--   The triggers are isolated to this migration. To revert, DROP them and
--   the helper function — the underlying columns on trainer_courses keep
--   their last synced values (no schema change).

-- ── 1) Backfill existing rows from current canonical defaults ─────────
UPDATE public.trainer_courses tc
SET
  sessions_count = COALESCE(t.default_sessions_count, tc.sessions_count),
  duration_hours = COALESCE(t.default_session_duration_hours, tc.duration_hours)
FROM public.trainings t
WHERE tc.training_id = t.id
  AND (
    -- Only touch rows where the canonical defaults are present and the
    -- copy is missing or differs. Avoids needless writes on already-synced
    -- rows.
    (t.default_sessions_count IS NOT NULL AND
       (tc.sessions_count IS DISTINCT FROM t.default_sessions_count))
    OR
    (t.default_session_duration_hours IS NOT NULL AND
       (tc.duration_hours IS DISTINCT FROM t.default_session_duration_hours))
  );

-- ── 2) Function shared by both triggers ───────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_trainer_courses_from_training()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cascade canonical defaults to every trainer_courses row for this
  -- training. We only update rows whose stored copy differs from the new
  -- canonical value, to avoid touching unchanged rows (cheaper + a clean
  -- audit log).
  UPDATE public.trainer_courses tc
  SET
    sessions_count = NEW.default_sessions_count,
    duration_hours = NEW.default_session_duration_hours
  WHERE tc.training_id = NEW.id
    AND (
      tc.sessions_count IS DISTINCT FROM NEW.default_sessions_count
      OR tc.duration_hours IS DISTINCT FROM NEW.default_session_duration_hours
    );

  RETURN NEW;
END;
$$;

-- ── 3) Trigger on trainings: cascade when canonical fields change ─────
DROP TRIGGER IF EXISTS trg_trainings_sync_trainer_courses ON public.trainings;
CREATE TRIGGER trg_trainings_sync_trainer_courses
AFTER UPDATE OF default_sessions_count, default_session_duration_hours
  ON public.trainings
FOR EACH ROW
WHEN (
  OLD.default_sessions_count IS DISTINCT FROM NEW.default_sessions_count
  OR OLD.default_session_duration_hours IS DISTINCT FROM NEW.default_session_duration_hours
)
EXECUTE FUNCTION public.sync_trainer_courses_from_training();

-- ── 4) BEFORE INSERT on trainer_courses: backfill from training defaults ──
CREATE OR REPLACE FUNCTION public.fill_trainer_courses_from_training_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_default_sessions int;
  t_default_duration numeric;
BEGIN
  -- Only fill when the inserter left these unset (NULL or 0). If the
  -- inserter explicitly chose values (e.g. legacy admin path), respect
  -- them — the AFTER UPDATE trigger above will catch any later sync need.
  IF NEW.sessions_count IS NULL OR NEW.sessions_count = 0
     OR NEW.duration_hours IS NULL OR NEW.duration_hours = 0 THEN
    SELECT default_sessions_count, default_session_duration_hours
    INTO t_default_sessions, t_default_duration
    FROM public.trainings
    WHERE id = NEW.training_id;

    IF NEW.sessions_count IS NULL OR NEW.sessions_count = 0 THEN
      NEW.sessions_count := COALESCE(t_default_sessions, NEW.sessions_count, 1);
    END IF;
    IF NEW.duration_hours IS NULL OR NEW.duration_hours = 0 THEN
      NEW.duration_hours := COALESCE(t_default_duration, NEW.duration_hours, 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trainer_courses_fill_from_training ON public.trainer_courses;
CREATE TRIGGER trg_trainer_courses_fill_from_training
BEFORE INSERT ON public.trainer_courses
FOR EACH ROW
EXECUTE FUNCTION public.fill_trainer_courses_from_training_on_insert();
