-- Fix encrypt_secret and decrypt_secret to use pgcrypto instead of pgsodium.valid_key
-- This removes the dependency on the non-existent "decrypted_secret" column
-- while still ensuring credentials are stored encrypted at rest.

-- Ensure pgcrypto extension is available (no-op if already installed)
create extension if not exists pgcrypto with schema public;

-- Encrypt a secret value using a symmetric key
create or replace function public.encrypt_secret(secret text)
  returns bytea
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  -- pgp_sym_encrypt returns bytea encrypted with the given passphrase
  -- The passphrase is stored only in this function definition on the server,
  -- never exposed to the client application.
  return pgp_sym_encrypt(secret, 'aws_credentials_encryption_key');
end;
$$;

-- Decrypt a previously encrypted value
create or replace function public.decrypt_secret(encrypted_data bytea, nonce bytea)
  returns text
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  -- "nonce" parameter is kept for backwards compatibility but not used
  return pgp_sym_decrypt(encrypted_data, 'aws_credentials_encryption_key');
exception
  when others then
    -- In case of any error (corrupted data, wrong key, etc.) return NULL
    return null;
end;
$$;