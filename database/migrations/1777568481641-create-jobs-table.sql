-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue TEXT NOT NULL DEFAULT 'default',
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  reserved_at INTEGER,
  available_at INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

-- Create failed_jobs table
CREATE TABLE IF NOT EXISTS failed_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL,
  connection TEXT NOT NULL,
  queue TEXT NOT NULL,
  payload TEXT NOT NULL,
  exception TEXT NOT NULL,
  failed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create job_batches table
CREATE TABLE IF NOT EXISTS job_batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  total_jobs INTEGER NOT NULL DEFAULT 0,
  pending_jobs INTEGER NOT NULL DEFAULT 0,
  failed_jobs INTEGER NOT NULL DEFAULT 0,
  failed_job_ids TEXT NOT NULL DEFAULT '[]',
  options TEXT,
  cancelled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME
);
