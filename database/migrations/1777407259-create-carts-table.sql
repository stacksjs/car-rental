CREATE TABLE IF NOT EXISTS "carts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "status" TEXT CHECK ("status" IN ('active', 'abandoned', 'converted', 'expired')) default 'active',
  "total_items" INTEGER default 0,
  "subtotal" INTEGER default 0,
  "tax_amount" INTEGER default 0,
  "discount_amount" INTEGER default 0,
  "total" INTEGER default 0,
  "expires_at" TEXT,
  "currency" TEXT default 'USD',
  "notes" TEXT,
  "applied_coupon_id" INTEGER,
  "customer_id" INTEGER,
  "coupon_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);