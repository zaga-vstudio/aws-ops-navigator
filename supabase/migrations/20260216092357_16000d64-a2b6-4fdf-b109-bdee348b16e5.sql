
-- Create monitoring data cache table (similar to cost_data_cache)
CREATE TABLE public.monitoring_data_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  time_range TEXT NOT NULL DEFAULT '24h',
  cpu_metrics JSONB DEFAULT '[]'::jsonb,
  network_in_metrics JSONB DEFAULT '[]'::jsonb,
  network_out_metrics JSONB DEFAULT '[]'::jsonb,
  disk_read_metrics JSONB DEFAULT '[]'::jsonb,
  disk_write_metrics JSONB DEFAULT '[]'::jsonb,
  status_check_metrics JSONB DEFAULT '[]'::jsonb,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + '00:15:00'::interval),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, time_range)
);

-- Enable RLS
ALTER TABLE public.monitoring_data_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own monitoring cache"
  ON public.monitoring_data_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monitoring cache"
  ON public.monitoring_data_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monitoring cache"
  ON public.monitoring_data_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monitoring cache"
  ON public.monitoring_data_cache FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_monitoring_data_cache_updated_at
  BEFORE UPDATE ON public.monitoring_data_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
