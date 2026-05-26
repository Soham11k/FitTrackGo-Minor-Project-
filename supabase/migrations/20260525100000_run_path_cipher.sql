-- Encrypted GPS path (client-side AES-GCM, see lib/encryption/user-data-cipher.ts).
-- Legacy rows keep readable path JSONB; new encrypted inserts set path_cipher and path NULL.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS path_cipher text;

COMMENT ON COLUMN runs.path_cipher IS 'Optional FTUSRfld1:-prefixed ciphertext of path JSON; plaintext path JSONB is null when used.';
