-- Fix get_user_aws_credentials to remove references to non-existent columns
-- The function was trying to access access_key_id and secret_access_key columns
-- that were removed in favor of encrypted_access_key and encrypted_secret_key

CREATE OR REPLACE FUNCTION public.get_user_aws_credentials(user_id_param uuid)
RETURNS TABLE(access_key_id text, secret_access_key text, region text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify the requesting user matches the credential owner
  IF auth.uid() != user_id_param THEN
    RAISE EXCEPTION 'Unauthorized access to credentials';
  END IF;

  RETURN QUERY
  SELECT 
    decrypt_secret(uac.encrypted_access_key, uac.key_nonce) as access_key_id,
    decrypt_secret(uac.encrypted_secret_key, uac.key_nonce) as secret_access_key,
    uac.region
  FROM public.user_aws_credentials uac
  WHERE uac.user_id = user_id_param
    AND uac.is_active = true
  LIMIT 1;
END;
$$;