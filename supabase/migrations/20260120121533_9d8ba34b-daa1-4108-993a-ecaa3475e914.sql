-- Create cost data cache table to reduce AWS Cost Explorer API calls
CREATE TABLE public.cost_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_breakdown JSONB DEFAULT '[]'::jsonb,
  anomalies JSONB DEFAULT '[]'::jsonb,
  total_cost DECIMAL(12,2) DEFAULT 0,
  historical_costs JSONB DEFAULT '[]'::jsonb,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '6 hours'),
  historical_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.cost_data_cache ENABLE ROW LEVEL SECURITY;

-- Users can only view their own cache
CREATE POLICY "Users can view their own cost cache"
ON public.cost_data_cache
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own cache
CREATE POLICY "Users can insert their own cost cache"
ON public.cost_data_cache
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own cache
CREATE POLICY "Users can update their own cost cache"
ON public.cost_data_cache
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own cache
CREATE POLICY "Users can delete their own cost cache"
ON public.cost_data_cache
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_cost_data_cache_updated_at
BEFORE UPDATE ON public.cost_data_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_cost_data_cache_user_id ON public.cost_data_cache(user_id);
CREATE INDEX idx_cost_data_cache_expires_at ON public.cost_data_cache(expires_at);