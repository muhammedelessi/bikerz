ALTER TABLE public.trainer_reviews
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trainer_reviews_trainer_user_unique_idx
ON public.trainer_reviews (trainer_id, user_id)
WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can insert own reviews" ON public.trainer_reviews;
CREATE POLICY "Users can insert own reviews"
  ON public.trainer_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON public.trainer_reviews;
CREATE POLICY "Users can update own reviews"
  ON public.trainer_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
