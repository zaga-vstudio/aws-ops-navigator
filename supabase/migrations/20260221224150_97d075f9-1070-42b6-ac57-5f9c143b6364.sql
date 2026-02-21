ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS ses_sender_email text DEFAULT NULL;