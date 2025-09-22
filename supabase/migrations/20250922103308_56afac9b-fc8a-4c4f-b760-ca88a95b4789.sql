-- Update aws_configurations table to make access_key_id and secret_access_key NOT NULL
-- since they will be required after the new signup flow
ALTER TABLE public.aws_configurations 
ALTER COLUMN access_key_id SET NOT NULL,
ALTER COLUMN secret_access_key SET NOT NULL;

-- Add a new column to track if the initial AWS setup is completed
ALTER TABLE public.user_setup 
ADD COLUMN aws_setup_completed BOOLEAN DEFAULT FALSE;