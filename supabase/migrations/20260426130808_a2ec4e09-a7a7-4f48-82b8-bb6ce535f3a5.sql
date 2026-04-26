-- Fix incorrect FK on trainer_applications.user_id (was referencing profiles.id, which is the row PK,
-- not the auth user id). All app code and triggers treat user_id as the auth.users id.
ALTER TABLE public.trainer_applications
  DROP CONSTRAINT IF EXISTS trainer_applications_user_id_fkey;

ALTER TABLE public.trainer_applications
  ADD CONSTRAINT trainer_applications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Same issue for reviewed_by: reviewers are admins identified by auth user id, not profiles.id.
ALTER TABLE public.trainer_applications
  DROP CONSTRAINT IF EXISTS trainer_applications_reviewed_by_fkey;

ALTER TABLE public.trainer_applications
  ADD CONSTRAINT trainer_applications_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;