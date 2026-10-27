-- Connection verification and milestone readiness require this notes field.
-- The original convert_staging import predates the optional diagnostics fields.
-- Add storage only: do not mark any existing website connected or change its data.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE convert_staging.clients
  ADD COLUMN IF NOT EXISTS tracking_notes text;
COMMIT;
