CREATE TABLE IF NOT EXISTS "roadtrip_legs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "roadtrip_id" INTEGER,
  "relocation_id" INTEGER,
  "sequence" INTEGER,
  "from_address" TEXT,
  "from_city" TEXT,
  "to_address" TEXT,
  "to_city" TEXT,
  "estimated_distance_miles" TEXT,
  "status" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);