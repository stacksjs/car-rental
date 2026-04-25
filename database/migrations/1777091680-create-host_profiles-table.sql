CREATE TABLE IF NOT EXISTS "host_profiles" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER,
  "bio" TEXT,
  "joined_at" TEXT,
  "trips" TEXT,
  "rating" TEXT,
  "response_rate" TEXT,
  "response_time" TEXT,
  "verified" TEXT,
  "all_star" TEXT,
  "stripe_account_id" INTEGER,
  "charges_enabled" TEXT,
  "payouts_enabled" TEXT,
  "platform_fee_bps" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);