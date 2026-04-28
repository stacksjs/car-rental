CREATE TABLE IF NOT EXISTS "products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "price" INTEGER,
  "image_url" TEXT,
  "is_available" INTEGER,
  "inventory_count" INTEGER,
  "preparation_time" INTEGER,
  "allergens" TEXT,
  "nutritional_info" TEXT,
  "category_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);