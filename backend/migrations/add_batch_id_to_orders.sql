-- Add batch_id column to orders table
-- Run this script once on the database to support multi-business order grouping.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS batch_id VARCHAR(60) NULL DEFAULT NULL,
  ADD INDEX idx_orders_batch_id (batch_id);
