-- Fix encrypt_secret and decrypt_secret functions to include extensions schema
-- The pgcrypto extension functions are in the extensions schema, not public

CREATE OR REPLACE FUNCTION public.encrypt_secret(secret text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN pgp_sym_encrypt(secret, 'aws_credentials_encryption_key');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_secret(encrypted_data bytea, nonce bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_data, 'aws_credentials_encryption_key');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;