CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "provider" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "event_type" TEXT,
  "received_at" TEXT not null default CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_event_id_unique" ON "webhook_events" ("provider", "event_id");
