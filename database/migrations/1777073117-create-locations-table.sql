CREATE TABLE IF NOT EXISTS "locations" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "state" TEXT,
  "country" TEXT,
  "lat" TEXT,
  "lng" TEXT,
  "listing_count" TEXT,
  "image" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);