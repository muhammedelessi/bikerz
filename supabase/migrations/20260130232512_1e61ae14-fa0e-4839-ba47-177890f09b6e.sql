-- Table to record individual mistake events (silent tracking)
CREATE TABLE public.user_mistake_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mistake_type TEXT NOT NULL CHECK (mistake_type IN ('knowledge', 'scenario_judgment', 'overconfidence')),
  concept_area TEXT NOT NULL,
  situation_type TEXT,
  source_type TEXT NOT NULL,
  source_id UUID,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  context_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store detected patterns (grouped mistakes)
CREATE TABLE public.user_mistake_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('knowledge_gap', 'risk_underestimation', 'reaction_timing', 'situational_awareness')),
  concept_area TEXT NOT NULL,
  situation_type TEXT,
  occurrence_count INTEGER NOT NULL DEFAULT 2,
  strength_score NUMERIC NOT NULL DEFAULT 0.5,
  last_occurrence_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  decay_factor NUMERIC NOT NULL DEFAULT 0.1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, concept_area, situation_type)
);

-- Table for pending reinforcement actions
CREATE TABLE public.user_reinforcement_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pattern_id UUID REFERENCES public.user_mistake_patterns(id) ON DELETE CASCADE,
  reinforcement_type TEXT NOT NULL CHECK (reinforcement_type IN ('lesson_suggestion', 'recap_insert', 'scenario_inject', 'pace_adjustment')),
  target_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  target_chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  content_data JSONB DEFAULT '{}'::jsonb,
  is_delivered BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_mistake_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mistake_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reinforcement_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_mistake_events (users can only access their own data)
CREATE POLICY "Users can insert their own mistake events"
ON public.user_mistake_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own mistake events"
ON public.user_mistake_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage all mistake events"
ON public.user_mistake_events FOR ALL
USING (is_admin(auth.uid()));

-- RLS Policies for user_mistake_patterns
CREATE POLICY "Users can view their own patterns"
ON public.user_mistake_patterns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patterns"
ON public.user_mistake_patterns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patterns"
ON public.user_mistake_patterns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all patterns"
ON public.user_mistake_patterns FOR ALL
USING (is_admin(auth.uid()));

-- RLS Policies for user_reinforcement_queue
CREATE POLICY "Users can view their own reinforcement queue"
ON public.user_reinforcement_queue FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reinforcements"
ON public.user_reinforcement_queue FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reinforcements"
ON public.user_reinforcement_queue FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reinforcements"
ON public.user_reinforcement_queue FOR ALL
USING (is_admin(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_mistake_events_user_concept ON public.user_mistake_events(user_id, concept_area);
CREATE INDEX idx_mistake_events_created ON public.user_mistake_events(created_at DESC);
CREATE INDEX idx_mistake_patterns_user_active ON public.user_mistake_patterns(user_id, is_active);
CREATE INDEX idx_reinforcement_queue_pending ON public.user_reinforcement_queue(user_id, is_delivered, is_dismissed);

-- Trigger for updating updated_at on patterns
CREATE TRIGGER update_user_mistake_patterns_updated_at
BEFORE UPDATE ON public.user_mistake_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();