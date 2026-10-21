CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
REVOKE ALL ON public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated, service_role;

CREATE SEQUENCE public.support_ticket_seq START 101;
REVOKE ALL ON SEQUENCE public.support_ticket_seq FROM PUBLIC, anon, authenticated;

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  subject_category text NOT NULL CHECK (subject_category IN ('account','roblox_verification','buying_experience','selling_experience','file_purchase','auction','payments','ownership_transfer','refund_dispute','report','technical','business','other')),
  custom_topic text CHECK (custom_topic IS NULL OR char_length(custom_topic) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 5000),
  contact_email text NOT NULL CHECK (char_length(contact_email) <= 254 AND contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text CHECK (phone IS NULL OR (char_length(phone) <= 32 AND phone ~ '^[0-9+()\-.\s]{7,32}$')),
  relevant_url text CHECK (relevant_url IS NULL OR (char_length(relevant_url) <= 500 AND relevant_url ~* '^https?://')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_on_customer','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  admin_notes text CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT other_needs_topic CHECK (subject_category <> 'other' OR custom_topic IS NOT NULL)
);
CREATE INDEX support_tickets_created_idx ON public.support_tickets (created_at DESC);
CREATE INDEX support_tickets_email_idx ON public.support_tickets (lower(contact_email), created_at DESC);

REVOKE ALL ON public.support_tickets FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read tickets" ON public.support_tickets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.support_tickets_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  -- Only status, priority and notes are editable after creation.
  NEW.ticket_number := OLD.ticket_number; NEW.subject_category := OLD.subject_category;
  NEW.custom_topic := OLD.custom_topic; NEW.description := OLD.description;
  NEW.contact_email := OLD.contact_email; NEW.phone := OLD.phone;
  NEW.relevant_url := OLD.relevant_url; NEW.created_at := OLD.created_at;
  RETURN NEW;
END $$;
CREATE TRIGGER support_tickets_touch BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.support_tickets_touch();

-- Public submission path: the only way to create a ticket. Returns the ticket number only.
CREATE OR REPLACE FUNCTION public.submit_support_ticket(
  _category text, _custom_topic text, _description text, _email text, _phone text, _url text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE num text; recent int; prio text;
BEGIN
  SELECT count(*) INTO recent FROM public.support_tickets
    WHERE lower(contact_email) = lower(trim(_email)) AND created_at > now() - interval '1 hour';
  IF recent >= 5 THEN RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001'; END IF;
  prio := CASE WHEN _category IN ('payments','refund_dispute','ownership_transfer') THEN 'high' ELSE 'normal' END;
  num := 'BOT-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-' || lpad(nextval('public.support_ticket_seq')::text, 6, '0');
  INSERT INTO public.support_tickets (ticket_number, subject_category, custom_topic, description, contact_email, phone, relevant_url, priority)
  VALUES (num, _category,
    CASE WHEN _category = 'other' THEN nullif(trim(_custom_topic), '') ELSE NULL END,
    trim(_description), lower(trim(_email)), nullif(trim(_phone), ''), nullif(trim(_url), ''), prio);
  RETURN num;
END $$;
REVOKE ALL ON FUNCTION public.submit_support_ticket(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_support_ticket(text,text,text,text,text,text) TO anon, authenticated;
