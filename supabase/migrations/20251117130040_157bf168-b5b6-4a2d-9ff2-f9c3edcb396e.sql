-- Simply drop plain text columns from user_aws_credentials
-- This will require users to re-enter credentials, which is acceptable for security
ALTER TABLE public.user_aws_credentials 
  DROP COLUMN IF EXISTS access_key_id,
  DROP COLUMN IF EXISTS secret_access_key;

-- Drop plain text columns from aws_configurations
ALTER TABLE public.aws_configurations 
  DROP COLUMN IF EXISTS access_key_id,
  DROP COLUMN IF EXISTS secret_access_key,
  DROP COLUMN IF EXISTS session_token,
  DROP COLUMN IF EXISTS role_arn;

-- Make encrypted columns NOT NULL after users re-enter credentials
-- For now, keep them nullable to allow credential re-entry
COMMENT ON COLUMN public.user_aws_credentials.encrypted_access_key IS 'Encrypted AWS access key - users must re-enter credentials after migration';
COMMENT ON COLUMN public.user_aws_credentials.encrypted_secret_key IS 'Encrypted AWS secret key - users must re-enter credentials after migration';