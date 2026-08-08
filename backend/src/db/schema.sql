CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  wa_id VARCHAR(64) UNIQUE,
  name VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(32),
  status VARCHAR(32) NOT NULL DEFAULT 'prospect',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts (phone);

CREATE TABLE IF NOT EXISTS conversations (
  chat_id VARCHAR(64) PRIMARY KEY,
  last_read_ts BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(64),
  wa_message_id VARCHAR(128),
  chat_id VARCHAR(64) NOT NULL,
  direction VARCHAR(16) NOT NULL,
  from_me SMALLINT NOT NULL DEFAULT 0,
  body TEXT,
  type VARCHAR(32) NOT NULL DEFAULT 'text',
  ts BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'sent',
  idempotency_key VARCHAR(128) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages (chat_id, ts);
CREATE INDEX IF NOT EXISTS idx_messages_wa ON messages (wa_message_id);
