CREATE TABLE IF NOT EXISTS "car_photos" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "url" TEXT,
  "caption" TEXT,
  "position" REAL,
  "is_primary" INTEGER,
  "car_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);