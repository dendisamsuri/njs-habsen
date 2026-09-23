-- `remaining` must be derived, never written by the app (AGENTS.md rule 4).
-- MySQL refuses direct DEFAULT→generated conversion (ERROR 3106): drop + re-add.
ALTER TABLE `leave_balances`
  DROP COLUMN `remaining`,
  ADD COLUMN `remaining` DECIMAL(5, 2) GENERATED ALWAYS AS (`entitlement` - `taken`) VIRTUAL;
