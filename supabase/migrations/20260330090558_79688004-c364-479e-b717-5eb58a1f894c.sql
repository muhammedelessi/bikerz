
CREATE TABLE public.community_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  has_motorcycle BOOLEAN NOT NULL DEFAULT false,
  considering_purchase TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (no auth required)
CREATE POLICY "Anyone can insert community members"
ON public.community_members
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can view
CREATE POLICY "Admins can manage community members"
ON public.community_members
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));
