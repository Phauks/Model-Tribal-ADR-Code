-- Create an account (Trevor, Nov. 23, 2026): someone new types an email
-- address and chooses a password, and the account is made only when they type
-- the code sent to that address. The chosen password waits here, already
-- hashed the same way as accounts.password_hash, until the code is used; it
-- goes when the code is used, replaced or expires. It never replaces a
-- password an account already has (src/lib/server/accounts.ts, useCode).
ALTER TABLE sign_in_codes ADD COLUMN new_password_hash TEXT;
ALTER TABLE sign_in_codes ADD COLUMN new_password_salt TEXT;
ALTER TABLE sign_in_codes ADD COLUMN new_password_iterations INTEGER;
ALTER TABLE sign_in_codes ADD COLUMN new_password_keyed INTEGER NOT NULL DEFAULT 0 CHECK (new_password_keyed IN (0, 1));
