CREATE TABLE IF NOT EXISTS "reviews" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "car_id" INTEGER,
  "booking_id" INTEGER,
  "user_id" INTEGER,
  "rating" REAL,
  "body" TEXT,
  "response" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);