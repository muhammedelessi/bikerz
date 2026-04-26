-- Add missing user_id column to trainers, referenced by approval trigger
ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill from email match if possible (best-effort)
UPDATE public.trainers t
SET user_id = u.id
FROM auth.users u
WHERE t.user_id IS NULL AND lower(u.email) = lower(t.email);

-- Add FK to auth.users
ALTER TABLE public.trainers
  DROP CONSTRAINT IF EXISTS trainers_user_id_fkey;
ALTER TABLE public.trainers
  ADD CONSTRAINT trainers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Unique index so a user maps to exactly one trainer row
CREATE UNIQUE INDEX IF NOT EXISTS trainers_user_id_unique ON public.trainers(user_id) WHERE user_id IS NOT NULL;