CREATE TABLE IF NOT EXISTS "taggable" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "slug" TEXT not null,
  "description" TEXT,
  "order" INTEGER not null default 0,
  "is_active" INTEGER not null default 1,
  "taggable_id" INTEGER not null,
  "taggable_type" TEXT not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);