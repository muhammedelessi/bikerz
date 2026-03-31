
-- Enums
CREATE TYPE public.training_type AS ENUM ('theory', 'practical');
CREATE TYPE public.training_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE public.training_status AS ENUM ('active', 'archived');
CREATE TYPE public.trainer_status AS ENUM ('active', 'inactive');

-- Trainings table
CREATE TABLE public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  type training_type NOT NULL DEFAULT 'theory',
  description_ar text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  level training_level NOT NULL DEFAULT 'beginner',
  status training_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active trainings" ON public.trainings FOR SELECT USING (status = 'active' OR is_admin(auth.uid()));
CREATE POLICY "Admins can manage trainings" ON public.trainings FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Trainers table
CREATE TABLE public.trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  photo_url text,
  bio_ar text NOT NULL DEFAULT '',
  bio_en text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  bike_type text NOT NULL DEFAULT '',
  years_of_experience integer NOT NULL DEFAULT 0,
  services text[] DEFAULT '{}',
  status trainer_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active trainers" ON public.trainers FOR SELECT USING (status = 'active' OR is_admin(auth.uid()));
CREATE POLICY "Admins can manage trainers" ON public.trainers FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Trainer courses junction table
CREATE TABLE public.trainer_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  price decimal NOT NULL DEFAULT 0,
  duration_hours decimal NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT '',
  available_schedule jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trainer_id, training_id)
);
ALTER TABLE public.trainer_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view trainer courses" ON public.trainer_courses FOR SELECT USING (true);
CREATE POLICY "Admins can manage trainer courses" ON public.trainer_courses FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Trainer reviews table
CREATE TABLE public.trainer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  student_name text NOT NULL DEFAULT '',
  rating integer NOT NULL DEFAULT 5,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trainer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON public.trainer_reviews FOR SELECT USING (true);
CREATE POLICY "Admins can manage reviews" ON public.trainer_reviews FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Training students table
CREATE TABLE public.training_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  enrolled_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage students" ON public.training_students FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Storage bucket for trainer photos
INSERT INTO storage.buckets (id, name, public) VALUES ('trainer-photos', 'trainer-photos', true);
CREATE POLICY "Anyone can view trainer photos" ON storage.objects FOR SELECT USING (bucket_id = 'trainer-photos');
CREATE POLICY "Admins can upload trainer photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'trainer-photos' AND (SELECT is_admin(auth.uid())));
CREATE POLICY "Admins can update trainer photos" ON storage.objects FOR UPDATE USING (bucket_id = 'trainer-photos' AND (SELECT is_admin(auth.uid())));
CREATE POLICY "Admins can delete trainer photos" ON storage.objects FOR DELETE USING (bucket_id = 'trainer-photos' AND (SELECT is_admin(auth.uid())));
