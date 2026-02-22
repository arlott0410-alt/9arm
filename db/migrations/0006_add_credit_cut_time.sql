ALTER TABLE credit_cuts ADD COLUMN cut_time TEXT NOT NULL DEFAULT '2000-01-01T00:00';
UPDATE credit_cuts SET cut_time = strftime('%Y-%m-%dT%H:%M', datetime(created_at/1000, 'unixepoch')) WHERE cut_time = '2000-01-01T00:00';
