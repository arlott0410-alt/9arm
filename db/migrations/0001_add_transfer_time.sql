-- Add txn_time column for transfer time (HH:mm format)
ALTER TABLE transfers ADD COLUMN txn_time TEXT;
