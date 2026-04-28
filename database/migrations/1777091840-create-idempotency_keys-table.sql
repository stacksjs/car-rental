CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "scope" TEXT NOT NULL,
  "user_id" INTEGER,
  "key" TEXT NOT NULL,
  "response_status" INTEGER,
  "response_body" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_keys_scope_user_key_unique" ON "idempotency_keys" ("scope", "user_id", "key");
CREATE INDEX IF NOT EXISTS "idempotency_keys_created_at_index" ON "idempotency_keys" ("created_at");
