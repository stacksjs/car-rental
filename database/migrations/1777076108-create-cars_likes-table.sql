CREATE TABLE IF NOT EXISTS "cars_likes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER not null,
  "car_id" INTEGER not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);