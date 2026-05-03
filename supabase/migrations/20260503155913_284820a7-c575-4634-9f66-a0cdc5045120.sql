
-- Honda Owners program: applications table, approval trigger, RLS, storage policies, ensure-bucket RPC.

CREATE TABLE IF NOT EXISTS public.honda_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  motorcycle_model text NOT NULL,
  motorcycle_year int NOT NULL CHECK (
    motorcycle_year BETWEEN 1900 AND 2100
  ),
  registration_document_path text NOT NULL,
  ai_attempts int NOT NULL DEFAULT 0,
  ai_last_response jsonb,
  ai_decision text,
  ai_decision_reason text,
  status text NOT NULL DEFAULT 'pending_ai',
  manual_reviewer_id uuid REFERENCES auth.users(id),
  manual_review_notes text,
  manual_reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT honda_applications_status_chk CHECK (status IN (
    'pending_ai', 'needs_manual_review', 'approved', 'rejected', 'limit_reached'
  ))
);

CREATE INDEX IF NOT EXISTS idx_honda_applications_user_id ON public.honda_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_honda_applications_status ON public.honda_applications(status);
CREATE INDEX IF NOT EXISTS idx_honda_applications_created_at ON public.honda_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_honda_applications_approved
  ON public.honda_applications(approved_at) WHERE status = 'approved';

CREATE OR REPLACE FUNCTION public.honda_applications_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_honda_applications_set_updated_at ON public.honda_applications;
CREATE TRIGGER trg_honda_applications_set_updated_at
BEFORE UPDATE ON public.honda_applications
FOR EACH ROW EXECUTE FUNCTION public.honda_applications_set_updated_at();

CREATE OR REPLACE FUNCTION public.honda_on_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_approved_count int;
  v_cap int := 500;
  v_course_id uuid;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_approved_count FROM public.honda_applications
  WHERE status = 'approved' AND id <> NEW.id;

  IF v_approved_count >= v_cap THEN
    NEW.status := 'limit_reached';
    NEW.approved_at := NULL;
    INSERT INTO public.admin_notifications (user_id, title, title_ar, message, message_ar, type, action_url, entity_type, entity_id)
    VALUES (NEW.user_id, 'Honda program full', 'برنامج ملاك هوندا ممتلئ',
      'Your application is verified, but the 500 free spots are filled. We will contact you if a slot opens.',
      'تم التحقق من طلبك، لكن الـ500 مقعد المجاني قد امتلأت. سنتواصل معك إذا تم فتح مقاعد إضافية.',
      'warning', '/honda/apply', 'honda_application', NEW.id::text);
    RETURN NEW;
  END IF;

  NEW.approved_at := COALESCE(NEW.approved_at, now());

  SELECT (value ->> 'course_id')::uuid INTO v_course_id
  FROM public.admin_settings WHERE key = 'honda_program_course_id' LIMIT 1;

  IF v_course_id IS NOT NULL THEN
    INSERT INTO public.course_enrollments (user_id, course_id, enrolled_at, progress_percentage)
    VALUES (NEW.user_id, v_course_id, now(), 0)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  INSERT INTO public.admin_notifications (user_id, title, title_ar, message, message_ar, type, action_url, entity_type, entity_id)
  VALUES (NEW.user_id, 'Honda program approved', 'تم قبول طلب ملاك هوندا',
    'Welcome! Your Honda Owner application is approved. The "What If" course is now free for you.',
    'مرحباً بك! تم قبول طلبك في برنامج ملاك هوندا. كورس "فكر ماذا لو" أصبح متاحاً لك مجاناً.',
    'success', '/courses', 'honda_application', NEW.id::text);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_honda_on_approval ON public.honda_applications;
CREATE TRIGGER trg_honda_on_approval
BEFORE UPDATE OF status ON public.honda_applications
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
EXECUTE FUNCTION public.honda_on_approval();

ALTER TABLE public.honda_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "honda_app_select_own" ON public.honda_applications;
CREATE POLICY "honda_app_select_own" ON public.honda_applications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "honda_app_insert_own" ON public.honda_applications;
CREATE POLICY "honda_app_insert_own" ON public.honda_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "honda_app_update_own" ON public.honda_applications;
CREATE POLICY "honda_app_update_own" ON public.honda_applications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "honda_app_admin_all" ON public.honda_applications;
CREATE POLICY "honda_app_admin_all" ON public.honda_applications
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Storage bucket + policies (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('honda-registrations', 'honda-registrations', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "honda_storage_insert_own" ON storage.objects;
CREATE POLICY "honda_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'honda-registrations' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "honda_storage_select_own" ON storage.objects;
CREATE POLICY "honda_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'honda-registrations' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "honda_storage_update_own" ON storage.objects;
CREATE POLICY "honda_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'honda-registrations' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'honda-registrations' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "honda_storage_delete_own" ON storage.objects;
CREATE POLICY "honda_storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'honda-registrations' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "honda_storage_admin_select_all" ON storage.objects;
CREATE POLICY "honda_storage_admin_select_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'honda-registrations' AND public.is_admin(auth.uid()));

-- Ensure-bucket RPC
CREATE OR REPLACE FUNCTION public.ensure_honda_storage_bucket()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('honda-registrations', 'honda-registrations', false)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_honda_storage_bucket() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_honda_storage_bucket() TO authenticated;

NOTIFY pgrst, 'reload schema';
