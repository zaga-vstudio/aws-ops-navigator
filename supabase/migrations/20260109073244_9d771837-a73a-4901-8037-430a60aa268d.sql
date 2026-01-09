-- Create table to store resource snapshots for drift detection
CREATE TABLE public.resource_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  resource_type TEXT NOT NULL, -- 'ec2', 'rds', 'security_group', 'vpc', etc.
  resource_id TEXT NOT NULL, -- AWS resource ID
  resource_arn TEXT, -- AWS ARN if available
  snapshot_hash TEXT NOT NULL, -- Hash of the configuration
  configuration JSONB NOT NULL, -- Full configuration snapshot
  source TEXT NOT NULL DEFAULT 'cloudhub', -- 'cloudhub' or 'aws_console' or 'initial'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource_type, resource_id)
);

-- Create table to store detected drift events
CREATE TABLE public.drift_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_name TEXT,
  previous_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL,
  changes JSONB NOT NULL, -- What changed
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  severity TEXT NOT NULL DEFAULT 'warning' -- 'info', 'warning', 'critical'
);

-- Enable RLS
ALTER TABLE public.resource_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drift_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for resource_snapshots
CREATE POLICY "Users can view their own snapshots" 
ON public.resource_snapshots 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own snapshots" 
ON public.resource_snapshots 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own snapshots" 
ON public.resource_snapshots 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own snapshots" 
ON public.resource_snapshots 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for drift_events
CREATE POLICY "Users can view their own drift events" 
ON public.drift_events 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own drift events" 
ON public.drift_events 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drift events" 
ON public.drift_events 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drift events" 
ON public.drift_events 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_resource_snapshots_user_type ON public.resource_snapshots(user_id, resource_type);
CREATE INDEX idx_drift_events_user_acknowledged ON public.drift_events(user_id, acknowledged);
CREATE INDEX idx_drift_events_detected_at ON public.drift_events(detected_at DESC);