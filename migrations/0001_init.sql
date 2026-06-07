-- Quoda initial schema (D1 / SQLite)

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  limits_json TEXT NOT NULL
);
INSERT INTO plans (id, name, limits_json) VALUES
 ('free', 'Free', '{"dynamicCodes":3,"staticCodes":-1,"analyticsRetentionDays":30,"logoUpload":true}'),
 ('pro',  'Pro',  '{"dynamicCodes":-1,"staticCodes":-1,"analyticsRetentionDays":365,"logoUpload":true}');

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  plan_id TEXT NOT NULL DEFAULT 'free' REFERENCES plans(id),
  onboarded_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_folders_user ON folders(user_id);

CREATE TABLE qr_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,                 -- url|text|wifi|email|tel|sms|vcard|pdf|menu|business|appstore|social
  title TEXT NOT NULL,
  is_dynamic INTEGER NOT NULL DEFAULT 0,
  short_code TEXT UNIQUE,             -- null for static codes
  destination TEXT,                   -- current redirect target (dynamic)
  content_json TEXT NOT NULL,         -- type-specific payload
  design_json TEXT NOT NULL,          -- colors/shape/eyes/logo/frame/ecc
  folder_id TEXT REFERENCES folders(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_qr_user ON qr_codes(user_id);
CREATE INDEX idx_qr_short ON qr_codes(short_code);

CREATE TABLE dynamic_pages (
  qr_id TEXT PRIMARY KEY REFERENCES qr_codes(id),
  kind TEXT NOT NULL,                 -- menu|business|social|appstore|pdf
  data_json TEXT NOT NULL,
  asset_keys TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE scans (
  id TEXT PRIMARY KEY,
  qr_id TEXT NOT NULL REFERENCES qr_codes(id),
  ts INTEGER NOT NULL,
  country TEXT,
  city TEXT,
  device TEXT,
  referer TEXT
);
CREATE INDEX idx_scans_qr_ts ON scans(qr_id, ts);

CREATE TABLE scan_daily (
  qr_id TEXT NOT NULL,
  day TEXT NOT NULL,                  -- YYYY-MM-DD
  country TEXT,
  device TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (qr_id, day, country, device)
);
