
-- Step 1: Store the encryption key in Supabase Vault
SELECT vault.create_secret(
  'aws_credentials_encryption_key',
  'aws_credentials_encryption_key'
);

-- Step 2: Update encrypt_secret to read key from Vault
CREATE OR REPLACE FUNCTION public.encrypt_secret(secret text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  encryption_key text;
BEGIN
  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'aws_credentials_encryption_key'
  LIMIT 1;

  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found in vault';
  END IF;

  RETURN pgp_sym_encrypt(secret, encryption_key);
END;
$$;

-- Step 3: Update decrypt_secret to read key from Vault
CREATE OR REPLACE FUNCTION public.decrypt_secret(encrypted_data bytea, nonce bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  encryption_key text;
BEGIN
  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'aws_credentials_encryption_key'
  LIMIT 1;

  IF encryption_key IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;
