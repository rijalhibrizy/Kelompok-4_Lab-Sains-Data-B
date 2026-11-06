DROP TABLE IF EXISTS stock_history;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Lainnya',
  unit TEXT NOT NULL,
  stock REAL NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock REAL NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  price REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- item_id tidak memakai foreign key agar riwayat tetap tersimpan setelah bahan dihapus
CREATE TABLE stock_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('awal','masuk','keluar','koreksi','hapus')),
  qty REAL NOT NULL,
  stock_before REAL NOT NULL,
  stock_after REAL NOT NULL,
  note TEXT,
  user_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_history_item ON stock_history(item_id);
CREATE INDEX idx_history_created ON stock_history(created_at);
