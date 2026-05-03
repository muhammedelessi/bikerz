ALTER TABLE public.trainer_reviews ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_trainer_reviews_user_id ON public.trainer_reviews(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trainer_reviews_user_trainer ON public.trainer_reviews(user_id, trainer_id) WHERE user_id IS NOT NULL;