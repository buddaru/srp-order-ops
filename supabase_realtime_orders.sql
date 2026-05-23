-- Enable Realtime for the orders table.
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- Full row data on all events (required for DELETE to carry old row values)
ALTER TABLE orders REPLICA IDENTITY FULL;

-- Add to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
