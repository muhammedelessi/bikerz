-- Fix overly permissive RLS policies for page_view_events and funnel_events

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_view_events;
DROP POLICY IF EXISTS "Anyone can insert funnel events" ON public.funnel_events;

-- Create more secure policies - allow authenticated users or track anonymous with session
CREATE POLICY "Authenticated users can insert page views" ON public.page_view_events 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR user_id IS NULL);

CREATE POLICY "Authenticated users can insert funnel events" ON public.funnel_events 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR user_id IS NULL);