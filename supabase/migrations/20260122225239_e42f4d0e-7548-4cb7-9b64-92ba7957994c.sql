-- Create support ticket categories enum
CREATE TYPE public.ticket_category AS ENUM (
  'technical',
  'billing',
  'course_content',
  'account',
  'refund',
  'certificate',
  'other'
);

-- Create support ticket priority enum
CREATE TYPE public.ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- Create support ticket status enum
CREATE TYPE public.ticket_status AS ENUM (
  'open',
  'in_progress',
  'waiting_response',
  'resolved',
  'closed'
);

-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  assigned_to UUID,
  category ticket_category NOT NULL DEFAULT 'other',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  status ticket_status NOT NULL DEFAULT 'open',
  subject TEXT NOT NULL,
  subject_ar TEXT,
  description TEXT NOT NULL,
  description_ar TEXT,
  course_id UUID REFERENCES public.courses(id),
  sla_due_at TIMESTAMP WITH TIME ZONE,
  first_response_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ticket messages/replies table
CREATE TABLE public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  message_ar TEXT,
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_tickets_user ON public.support_tickets(user_id);
CREATE INDEX idx_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_tickets_priority ON public.support_tickets(priority);
CREATE INDEX idx_tickets_assigned ON public.support_tickets(assigned_to);
CREATE INDEX idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Users can view their own tickets"
  ON public.support_tickets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets"
  ON public.support_tickets
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all tickets"
  ON public.support_tickets
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for ticket_messages
CREATE POLICY "Users can view messages of their tickets"
  ON public.ticket_messages
  FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM public.support_tickets WHERE user_id = auth.uid()
    ) AND is_internal_note = false
  );

CREATE POLICY "Users can add messages to their tickets"
  ON public.ticket_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    ticket_id IN (
      SELECT id FROM public.support_tickets WHERE user_id = auth.uid()
    ) AND is_internal_note = false
  );

CREATE POLICY "Admins can view all messages"
  ON public.ticket_messages
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all messages"
  ON public.ticket_messages
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-generate ticket number
CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ticket_number();

-- Function to set SLA based on priority
CREATE OR REPLACE FUNCTION public.set_ticket_sla()
RETURNS TRIGGER AS $$
BEGIN
  -- Set SLA based on priority (in hours)
  CASE NEW.priority
    WHEN 'urgent' THEN NEW.sla_due_at := NOW() + INTERVAL '4 hours';
    WHEN 'high' THEN NEW.sla_due_at := NOW() + INTERVAL '8 hours';
    WHEN 'medium' THEN NEW.sla_due_at := NOW() + INTERVAL '24 hours';
    WHEN 'low' THEN NEW.sla_due_at := NOW() + INTERVAL '72 hours';
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-set SLA
CREATE TRIGGER set_sla_on_create
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ticket_sla();

-- Trigger for updated_at
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();