-- Add drift scan scheduling columns to notification_preferences
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS drift_scan_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS drift_scan_frequency text DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS drift_scan_last_run timestamp with time zone,
ADD COLUMN IF NOT EXISTS notify_on_drift boolean DEFAULT true;

-- Create index for finding users with enabled scheduled scans
CREATE INDEX IF NOT EXISTS idx_notification_preferences_drift_scan 
ON public.notification_preferences (drift_scan_enabled, drift_scan_frequency) 
WHERE drift_scan_enabled = true;