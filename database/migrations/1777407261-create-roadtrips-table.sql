CREATE TABLE IF NOT EXISTS "roadtrips" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER,
  "title" TEXT,
  "origin_address" TEXT,
  "origin_city" TEXT,
  "destination_address" TEXT,
  "destination_city" TEXT,
  "earliest_start_date" TEXT,
  "latest_end_date" TEXT,
  "total_estimated_miles" TEXT,
  "status" TEXT,
  "notes" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);