-- Wire the existing admin_notifications table into the booking lifecycle so
-- trainers and students get real-time notifications without us needing a
-- separate channel.
--
-- Events covered:
--   1) NEW BOOKING            — notify the trainer the trainee picked them.
--   2) BOOKING CONFIRMED      — notify the student the trainer confirmed.
--   3) SESSION COMPLETED      — notify the student each time the trainer
--                              marks a session as completed (status flip in
--                              the sessions JSONB).
--   4) SKILL EVALUATION       — notify the student a new skill grade came in.
--
-- Strategy:
--   Each event has its own SECURITY DEFINER trigger function that builds an
--   admin_notifications row tailored to the event. Bilingual title +
--   message, with action_url pointing to the relevant detail page so
--   clicking the bell jumps the user there directly.
--
-- Why SECURITY DEFINER:
--   The existing RLS policy on admin_notifications restricts INSERTs to
--   admins. Triggers run as the table-owner (postgres) only when marked
--   SECURITY DEFINER, which lets them insert notifications regardless of
--   who initiated the booking change. The functions never accept user
--   input — they read NEW.* and OLD.* and write a fixed shape — so this
--   doesn't widen the attack surface.

-- ─────────────────────────────────────────────────────────────────────
-- 1) NEW BOOKING → notify the trainer
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_trainer_on_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trainer_user_id uuid;
  training_name_ar text;
  training_name_en text;
BEGIN
  -- Resolve the trainer's auth user_id (the trainers table stores it).
  SELECT user_id INTO trainer_user_id
  FROM public.trainers
  WHERE id = NEW.trainer_id;

  IF trainer_user_id IS NULL THEN
    -- No auth account linked yet — silently skip; admin can backfill.
    RETURN NEW;
  END IF;

  -- Pull the training name for a friendly notification body.
  SELECT name_ar, name_en INTO training_name_ar, training_name_en
  FROM public.trainings
  WHERE id = NEW.training_id;

  INSERT INTO public.admin_notifications (
    user_id, title, title_ar, message, message_ar,
    type, action_url, entity_type, entity_id
  ) VALUES (
    trainer_user_id,
    'New booking',
    'حجز جديد',
    'New booking from ' || NEW.full_name || ' for: ' ||
      COALESCE(training_name_en, training_name_ar, 'Training'),
    'حجز جديد من ' || NEW.full_name || ' لتدريب: ' ||
      COALESCE(training_name_ar, training_name_en, 'تدريب'),
    'info',
    '/dashboard/trainer/bookings',
    'training_booking',
    NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_trainer_new_booking ON public.training_bookings;
CREATE TRIGGER trg_notify_trainer_new_booking
AFTER INSERT ON public.training_bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_trainer_on_new_booking();

-- ─────────────────────────────────────────────────────────────────────
-- 2) STATUS CHANGED → notify the student (confirmed / completed / cancelled)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_student_on_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_title_ar text;
  notif_title_en text;
  notif_msg_ar text;
  notif_msg_en text;
  notif_type text := 'info';
BEGIN
  -- Only fire when status actually transitions to a meaningful state.
  IF NEW.status IS NULL OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed' THEN
    notif_title_ar := 'تم تأكيد حجزك';
    notif_title_en := 'Booking confirmed';
    notif_msg_ar := 'تم تأكيد حجز التدريب الخاص بك من قِبل المدرب.';
    notif_msg_en := 'Your training booking has been confirmed by the trainer.';
    notif_type := 'success';
  ELSIF NEW.status = 'completed' THEN
    notif_title_ar := 'اكتمل التدريب';
    notif_title_en := 'Training completed';
    notif_msg_ar := 'تم إكمال جميع جلسات تدريبك. يمكنك الآن تقييم المدرب.';
    notif_msg_en := 'All your training sessions have been completed. You can now rate the trainer.';
    notif_type := 'success';
  ELSIF NEW.status = 'cancelled' THEN
    notif_title_ar := 'تم إلغاء الحجز';
    notif_title_en := 'Booking cancelled';
    notif_msg_ar := 'تم إلغاء حجزك. لأي استفسار تواصل مع الدعم.';
    notif_msg_en := 'Your booking has been cancelled. Contact support for any questions.';
    notif_type := 'warning';
  ELSE
    -- Other statuses (pending, processing, …) don't generate notifications.
    RETURN NEW;
  END IF;

  INSERT INTO public.admin_notifications (
    user_id, title, title_ar, message, message_ar,
    type, action_url, entity_type, entity_id
  ) VALUES (
    NEW.user_id,
    notif_title_en,
    notif_title_ar,
    notif_msg_en,
    notif_msg_ar,
    notif_type,
    '/my-bookings',
    'training_booking',
    NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_booking_status ON public.training_bookings;
CREATE TRIGGER trg_notify_student_booking_status
AFTER UPDATE OF status ON public.training_bookings
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_student_on_booking_status_change();

-- ─────────────────────────────────────────────────────────────────────
-- 3) SESSION COMPLETED IN sessions JSONB → notify student per session
-- ─────────────────────────────────────────────────────────────────────
-- The trainer marks individual sessions complete by editing the sessions
-- JSONB array on training_bookings. We diff old vs new and emit one
-- notification per session that newly transitioned to status='completed'.
CREATE OR REPLACE FUNCTION public.notify_student_on_session_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_session jsonb;
  new_session jsonb;
  i int;
  total_old int := 0;
  total_new int := 0;
  new_status text;
  old_status text;
  session_number int;
BEGIN
  IF NEW.sessions IS NULL OR jsonb_typeof(NEW.sessions) <> 'array' THEN
    RETURN NEW;
  END IF;

  total_new := jsonb_array_length(NEW.sessions);
  IF OLD.sessions IS NOT NULL AND jsonb_typeof(OLD.sessions) = 'array' THEN
    total_old := jsonb_array_length(OLD.sessions);
  END IF;

  FOR i IN 0 .. total_new - 1 LOOP
    new_session := NEW.sessions -> i;
    new_status := COALESCE(new_session ->> 'status', 'pending');
    old_status := 'pending';
    IF i < total_old THEN
      old_session := OLD.sessions -> i;
      old_status := COALESCE(old_session ->> 'status', 'pending');
    END IF;

    -- Only notify when this specific session newly flipped to completed.
    IF new_status = 'completed' AND old_status <> 'completed' THEN
      session_number := COALESCE((new_session ->> 'session_number')::int, i + 1);
      INSERT INTO public.admin_notifications (
        user_id, title, title_ar, message, message_ar,
        type, action_url, entity_type, entity_id
      ) VALUES (
        NEW.user_id,
        'Session approved',
        'تم اعتماد الجلسة',
        'Session ' || session_number || ' of your training has been marked complete.',
        'الجلسة ' || session_number || ' من تدريبك تم اعتمادها كمكتملة.',
        'success',
        '/my-bookings',
        'training_booking_session',
        NEW.id::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_session_completed ON public.training_bookings;
CREATE TRIGGER trg_notify_student_session_completed
AFTER UPDATE OF sessions ON public.training_bookings
FOR EACH ROW
WHEN (OLD.sessions IS DISTINCT FROM NEW.sessions)
EXECUTE FUNCTION public.notify_student_on_session_completed();

-- ─────────────────────────────────────────────────────────────────────
-- 4) SKILL EVALUATION → notify student each time a skill is rated
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_student_on_skill_evaluation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_user_id uuid;
  skill_label text;
BEGIN
  SELECT user_id INTO student_user_id
  FROM public.training_bookings
  WHERE id = NEW.booking_id;

  IF student_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  skill_label := COALESCE(NEW.skill_name_ar, NEW.skill_name_en, 'Skill');

  INSERT INTO public.admin_notifications (
    user_id, title, title_ar, message, message_ar,
    type, action_url, entity_type, entity_id
  ) VALUES (
    student_user_id,
    'Skill evaluated',
    'تم تقييم مهارة',
    'Your trainer rated "' ||
      COALESCE(NEW.skill_name_en, NEW.skill_name_ar, 'a skill') ||
      '" with ' || NEW.score || '/5.',
    'قام مدربك بتقييم مهارة "' ||
      COALESCE(NEW.skill_name_ar, NEW.skill_name_en, 'مهارة') ||
      '" بـ ' || NEW.score || '/5.',
    'success',
    '/my-bookings',
    'skill_evaluation',
    NEW.booking_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_skill_eval ON public.training_booking_skill_evaluations;
CREATE TRIGGER trg_notify_student_skill_eval
AFTER INSERT OR UPDATE OF score ON public.training_booking_skill_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.notify_student_on_skill_evaluation();

-- ─────────────────────────────────────────────────────────────────────
-- 5) Indexes for the action_url + unread-count queries the bell uses
-- ─────────────────────────────────────────────────────────────────────
-- (existing indexes already cover user_id + is_read; add a composite
--  for the most-common dropdown query: "20 latest unread for me".)
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_unread_recent
ON public.admin_notifications (user_id, is_read, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- Schema cache reload so PostgREST picks up the new functions/triggers
-- without operators having to redeploy edge functions.
-- ─────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
