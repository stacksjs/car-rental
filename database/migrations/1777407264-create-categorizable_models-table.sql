CREATE TABLE IF NOT EXISTS "categorizable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "category_id" INTEGER not null,
  "categorizable_id" INTEGER not null,
  "categorizable_type" TEXT not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP
);