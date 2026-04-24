CREATE TABLE IF NOT EXISTS "users" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "email" TEXT,
  "password" TEXT,
  "phone" TEXT,
  "date_of_birth" TEXT,
  "license_number" TEXT,
  "license_state" TEXT,
  "avatar_url" TEXT,
  "role" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);