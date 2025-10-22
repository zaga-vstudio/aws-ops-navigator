-- Enable pgsodium extension for encryption (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Create a function to encrypt sensitive data
CREATE OR REPLACE FUNCTION public.encrypt_secret(secret text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_value bytea;
BEGIN
  -- Use pgsodium to encrypt the secret
  encrypted_value := pgsodium.crypto_secretbox_easy(
    convert_to(secret, 'utf8'),
    (SELECT decrypted_secret FROM pgsodium.valid_key LIMIT 1),
    gen_random_bytes(24)
  );
  RETURN encrypted_value;
END;
$$;

-- Create a function to decrypt sensitive data
CREATE OR REPLACE FUNCTION public.decrypt_secret(encrypted_data bytea, nonce bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  decrypted_value bytea;
BEGIN
  -- Use pgsodium to decrypt the secret
  decrypted_value := pgsodium.crypto_secretbox_open_easy(
    encrypted_data,
    (SELECT decrypted_secret FROM pgsodium.valid_key LIMIT 1),
    nonce
  );
  RETURN convert_from(decrypted_value, 'utf8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Add encrypted columns to user_aws_credentials table
ALTER TABLE public.user_aws_credentials
ADD COLUMN IF NOT EXISTS encrypted_access_key bytea,
ADD COLUMN IF NOT EXISTS encrypted_secret_key bytea,
ADD COLUMN IF NOT EXISTS key_nonce bytea DEFAULT gen_random_bytes(24);

-- Add encrypted columns to aws_configurations table
ALTER TABLE public.aws_configurations
ADD COLUMN IF NOT EXISTS encrypted_access_key bytea,
ADD COLUMN IF NOT EXISTS encrypted_secret_key bytea,
ADD COLUMN IF NOT EXISTS encrypted_session_token bytea,
ADD COLUMN IF NOT EXISTS key_nonce bytea DEFAULT gen_random_bytes(24);

-- Create a secure function to get decrypted AWS credentials
CREATE OR REPLACE FUNCTION public.get_user_aws_credentials(user_id_param uuid)
RETURNS TABLE (
  access_key_id text,
  secret_access_key text,
  region text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the requesting user matches the credential owner
  IF auth.uid() != user_id_param THEN
    RAISE EXCEPTION 'Unauthorized access to credentials';
  END IF;

  RETURN QUERY
  SELECT 
    CASE 
      WHEN uac.encrypted_access_key IS NOT NULL THEN 
        decrypt_secret(uac.encrypted_access_key, uac.key_nonce)
      ELSE 
        uac.access_key_id
    END as access_key_id,
    CASE 
      WHEN uac.encrypted_secret_key IS NOT NULL THEN 
        decrypt_secret(uac.encrypted_secret_key, uac.key_nonce)
      ELSE 
        uac.secret_access_key
    END as secret_access_key,
    uac.region
  FROM public.user_aws_credentials uac
  WHERE uac.user_id = user_id_param
    AND uac.is_active = true
  LIMIT 1;
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_aws_credentials(uuid) TO authenticated;

-- Create a comment to document the encryption approach
COMMENT ON FUNCTION public.get_user_aws_credentials IS 'Securely retrieves and decrypts AWS credentials for authenticated users. This function uses SECURITY DEFINER to bypass RLS and decrypt credentials, but includes authorization checks to ensure users can only access their own credentials.';