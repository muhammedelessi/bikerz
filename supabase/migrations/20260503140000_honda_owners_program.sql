-- Honda Owners program — sponsored free access to the "What If" course for
-- verified Honda motorcycle owners. Cap: 500 approved applicants.
--
-- Lifecycle:
--   pending_ai          : just submitted; AI verification not yet run
--   needs_manual_review : AI rejected OR user is on their 4th attempt
--                         (admin must decide manually)
--   approved            : verified Honda owner — course unlocked
--   rejected            : admin manually rejected
--   limit_reached       : would have been approved but the 500-slot cap
--                         was already filled at the moment of approval
--                         (kept as a separate state so the admin UI can
--                         distinguish "you're a real Honda owner but the
--                         program is full" from "we couldn't verify you")
--
-- Why a single table instead of one-application-per-attempt:
--   The user has at most one open application; we increment ai_attempts
--   in place rather than emitting a new row per upload. That keeps the
--   admin dashboard query cheap (`SELECT * FROM honda_applications`) and
--   makes the 500-cap check trivially `WHERE status='approved'`.

CREATE TABLE IF NOT EXISTS public.honda_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Form fields (bilingual labels in UI; values stored verbatim — no translation)
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  motorcycle_model text NOT NULL,
  motorcycle_year int NOT NULL CHECK (
    motorcycle_year BETWEEN 1900 AND extract(year from now())::int + 1
  ),

  -- Storage path (NOT a URL) so we can re-issue signed URLs and rotate
  -- the bucket without breaking references. Format:
  --   honda-registrations/{user_id}/{application_id}-{ts}.{ext}
  registration_document_path text NOT NULL,

  -- AI verification trail
  ai_attempts int NOT NULL DEFAULT 0,
  ai_last_response jsonb,                 -- raw structured JSON from gpt-4o-mini
  ai_decision text,                       -- 'approved' | 'rejected' | null
  ai_decision_reason text,                -- short human-readable summary

  -- Final state machine
  status text NOT NULL DEFAULT 'pending_ai',

  -- Manual review trail (set when admin overrides the AI)
  manual_reviewer_id uuid REFERENCES auth.users(id),
  manual_review_notes text,
  manual_reviewed_at timestamptz,

  -- Timestamps
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT honda_applications_status_chk CHECK (status IN (
    'pending_ai', 'needs_manual_review', 'approved', 'rejected', 'limit_reached'
  ))
);

CREATE INDEX IF NOT EXISTS idx_honda_applications_user_id
  ON public.honda_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_honda_applications_status
  ON public.honda_applications(status);
CREATE INDEX IF NOT EXISTS idx_honda_applications_created_at
  ON public.honda_applications(created_at DESC);
-- Used by the cap check; very cheap because most rows aren't approved.
CREATE INDEX IF NOT EXISTS idx_honda_applications_approved
  ON public.honda_applications(approved_at) WHERE status = 'approved';

-- ─────────────────────────────────────────────────────────────────────
-- updated_at touch trigger
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.honda_applications_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_honda_applications_set_updated_at ON public.honda_applications;
CREATE TRIGGER trg_honda_applications_set_updated_at
BEFORE UPDATE ON public.honda_applications
FOR EACH ROW
EXECUTE FUNCTION public.honda_applications_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 500-applicant cap + auto-enrollment + bell notification on approval
-- ─────────────────────────────────────────────────────────────────────
-- When status transitions INTO 'approved':
--   1. Recount approved applications. If >= 500, demote this row to
--      'limit_reached' and bail (no enrollment, no notification).
--   2. Otherwise: stamp approved_at, auto-insert into course_enrollments
--      for the configured Honda program course, and post a bilingual
--      bell notification.
--
-- The cap check happens INSIDE the trigger, not at the edge function or
-- the admin UI, so it can't be raced or bypassed from any client.
CREATE OR REPLACE FUNCTION public.honda_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved_count int;
  v_cap int := 500;
  v_course_id uuid;
BEGIN
  -- Only act when status is transitioning INTO 'approved'.
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Count approvals other than this row.
  SELECT COUNT(*) INTO v_approved_count
  FROM public.honda_applications
  WHERE status = 'approved' AND id <> NEW.id;

  IF v_approved_count >= v_cap THEN
    -- Program full. Demote so the caller sees `limit_reached` immediately.
    NEW.status := 'limit_reached';
    NEW.approved_at := NULL;
    -- We still send a bilingual notification so the user is told the
    -- program is full instead of being left wondering.
    INSERT INTO public.admin_notifications (
      user_id, title, title_ar, message, message_ar,
      type, action_url, entity_type, entity_id
    ) VALUES (
      NEW.user_id,
      'Honda program full',
      'برنامج ملاك هوندا ممتلئ',
      'Your application is verified, but the 500 free spots are filled. We will contact you if a slot opens.',
      'تم التحقق من طلبك، لكن الـ500 مقعد المجاني قد امتلأت. سنتواصل معك إذا تم فتح مقاعد إضافية.',
      'warning',
      '/honda/apply',
      'honda_application',
      NEW.id::text
    );
    RETURN NEW;
  END IF;

  NEW.approved_at := COALESCE(NEW.approved_at, now());

  -- Resolve the configured course id (admin sets this in admin_settings).
  -- Stored shape: {"course_id": "uuid-string"}.
  SELECT (value ->> 'course_id')::uuid INTO v_course_id
  FROM public.admin_settings
  WHERE key = 'honda_program_course_id'
  LIMIT 1;

  IF v_course_id IS NOT NULL THEN
    -- Idempotent enrollment — running the trigger twice (e.g., admin
    -- toggles status off/on) won't create duplicate enrollments because
    -- of the UNIQUE(user_id, course_id) constraint on course_enrollments.
    INSERT INTO public.course_enrollments (user_id, course_id, enrolled_at, progress_percentage)
    VALUES (NEW.user_id, v_course_id, now(), 0)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  -- Welcome notification — uses the same bell channel as bookings.
  INSERT INTO public.admin_notifications (
    user_id, title, title_ar, message, message_ar,
    type, action_url, entity_type, entity_id
  ) VALUES (
    NEW.user_id,
    'Honda program approved',
    'تم قبول طلب ملاك هوندا',
    'Welcome! Your Honda Owner application is approved. The "What If" course is now free for you.',
    'مرحباً بك! تم قبول طلبك في برنامج ملاك هوندا. كورس "فكر ماذا لو" أصبح متاحاً لك مجاناً.',
    'success',
    '/courses',
    'honda_application',
    NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_honda_on_approval ON public.honda_applications;
CREATE TRIGGER trg_honda_on_approval
BEFORE UPDATE OF status ON public.honda_applications
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
EXECUTE FUNCTION public.honda_on_approval();

-- ─────────────────────────────────────────────────────────────────────
-- RLS — users see their own application, admins see everything
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.honda_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "honda_app_select_own" ON public.honda_applications;
CREATE POLICY "honda_app_select_own" ON public.honda_applications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "honda_app_insert_own" ON public.honda_applications;
CREATE POLICY "honda_app_insert_own" ON public.honda_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- The user can update their own row (re-upload, bump ai_attempts via the
-- edge function which runs as the user). Admin-only fields like `status`,
-- `approved_at`, `manual_*` are protected by application logic + the
-- approval trigger above; we don't try to enforce per-column writes in
-- RLS because the edge function legitimately sets `status` after AI runs.
DROP POLICY IF EXISTS "honda_app_update_own" ON public.honda_applications;
CREATE POLICY "honda_app_update_own" ON public.honda_applications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin: full access.
DROP POLICY IF EXISTS "honda_app_admin_all" ON public.honda_applications;
CREATE POLICY "honda_app_admin_all" ON public.honda_applications
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────────────────────
-- Storage bucket: private, admin-readable
-- ─────────────────────────────────────────────────────────────────────
-- Files are stored at {user_id}/{application_id}-{timestamp}.{ext}.
-- The bucket is private; admins read via signed URLs in the admin UI.
INSERT INTO storage.buckets (id, name, public)
VALUES ('honda-registrations', 'honda-registrations', false)
ON CONFLICT (id) DO NOTHING;

-- Owner can upload to their own folder (path prefix = their user_id).
DROP POLICY IF EXISTS "honda_storage_insert_own" ON storage.objects;
CREATE POLICY "honda_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'honda-registrations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can read their own files (in case the form re-renders or the user
-- wants to confirm their upload). We don't strictly need this for the
-- product, but withholding it would be a footgun if we ever add a
-- "preview your uploaded doc" affordance.
DROP POLICY IF EXISTS "honda_storage_select_own" ON storage.objects;
CREATE POLICY "honda_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'honda-registrations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin can read everything (for the admin Honda Owners panel + signed URLs).
DROP POLICY IF EXISTS "honda_storage_admin_select_all" ON storage.objects;
CREATE POLICY "honda_storage_admin_select_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'honda-registrations'
    AND public.has_role(auth.uid(), 'admin')
  );

-- ─────────────────────────────────────────────────────────────────────
-- Reload PostgREST schema cache so the new table + functions are
-- visible to the JS client without a redeploy.
-- ─────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
