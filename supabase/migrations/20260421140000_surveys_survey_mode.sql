-- Survey evaluation mode: scored (quiz) vs preference (community percentages only)
ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS survey_mode text
  NOT NULL DEFAULT 'scored'
  CHECK (survey_mode IN ('scored', 'preference'));

UPDATE public.surveys SET survey_mode = 'preference'
  WHERE type IN ('bike_types', 'bike_subtypes', 'bike_models');

UPDATE public.surveys SET survey_mode = 'scored'
  WHERE type IN ('brands', 'custom');
