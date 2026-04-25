CREATE TABLE IF NOT EXISTS "extras" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT,
  "name" TEXT,
  "description" TEXT,
  "price_per_day" REAL,
  "icon" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);