-- Create alert_rules table to store user-defined alert rules
CREATE TABLE public.alert_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    metric TEXT NOT NULL,
    threshold NUMERIC NOT NULL,
    duration INTEGER NOT NULL DEFAULT 5,
    severity TEXT NOT NULL DEFAULT 'warning',
    enabled BOOLEAN NOT NULL DEFAULT true,
    cloudwatch_alarm_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own alert rules" 
ON public.alert_rules 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alert rules" 
ON public.alert_rules 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert rules" 
ON public.alert_rules 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert rules" 
ON public.alert_rules 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_alert_rules_updated_at
BEFORE UPDATE ON public.alert_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();