CREATE TABLE IF NOT EXISTS "relocation_applications" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "relocation_id" INTEGER,
  "user_id" INTEGER,
  "status" TEXT,
  "message" TEXT,
  "approved_at" TEXT,
  "rejected_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
