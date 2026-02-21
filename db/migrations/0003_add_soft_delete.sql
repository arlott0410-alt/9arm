-- Soft delete for transfers
ALTER TABLE transfers ADD COLUMN deleted_at INTEGER;
ALTER TABLE transfers ADD COLUMN deleted_by INTEGER REFERENCES users(id);
ALTER TABLE transfers ADD COLUMN delete_reason TEXT;

-- Soft delete for transactions
ALTER TABLE transactions ADD COLUMN deleted_at INTEGER;
ALTER TABLE transactions ADD COLUMN deleted_by INTEGER REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN delete_reason TEXT;
