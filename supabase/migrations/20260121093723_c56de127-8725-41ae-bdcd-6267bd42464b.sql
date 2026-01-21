-- Add cost_explorer_enabled column to notification_preferences
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS cost_explorer_enabled boolean DEFAULT false;

-- Add column to track when cost explorer was last charged
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS cost_explorer_last_charged_at timestamp with time zone;