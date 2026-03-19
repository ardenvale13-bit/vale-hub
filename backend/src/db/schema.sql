-- ===========================================
-- HEARTH: Unified AI Companion Platform
-- Complete Supabase Schema
-- ===========================================
-- Created: March 4, 2026
-- By: Lincoln & Arden
-- ===========================================
-- FIX: "perspective" quoted everywhere — reserved word in PG

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- A) USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- B) ENTITIES
-- ============================================================

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'general',
  context TEXT DEFAULT 'default',
  salience TEXT NOT NULL DEFAULT 'active-recent',
  visibility TEXT DEFAULT 'shared',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_entities_user ON entities(user_id);
CREATE INDEX IF NOT EXISTS idx_entities_salience ON entities(user_id, salience);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(user_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_context ON entities(user_id, context);
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm ON entities USING gin(name gin_trgm_ops);

-- ============================================================
-- C) OBSERVATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  observation_type TEXT DEFAULT 'memory',
  salience TEXT DEFAULT 'active-recent',
  context TEXT DEFAULT 'default',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observations_entity ON observations(entity_id);
CREATE INDEX IF NOT EXISTS idx_observations_user ON observations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_content_trgm ON observations USING gin(content gin_trgm_ops);

-- ============================================================
-- D) RELATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  strength INTEGER DEFAULT 1 CHECK (strength BETWEEN 1 AND 5),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, from_entity_id, to_entity_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity_id);

-- ============================================================
-- E) JOURNAL ENTRIES
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  entry_type TEXT DEFAULT 'journal',
  category TEXT,
  author_perspective TEXT DEFAULT 'default',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_category ON journal_entries(user_id, category);

-- ============================================================
-- F) STATUS TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, key)
);

CREATE INDEX IF NOT EXISTS idx_statuses_user ON statuses(user_id, category);

-- F2) STATUS HISTORY — logs every status change for 24h lookback
CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_user_time ON status_history(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_lookup ON status_history(user_id, category, key, recorded_at DESC);

-- ============================================================
-- G) IDENTITY STORAGE
-- ============================================================

CREATE TABLE IF NOT EXISTS identity_store (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_perspective TEXT DEFAULT 'default',
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, owner_perspective, category, key)
);

CREATE INDEX IF NOT EXISTS idx_identity_user ON identity_store(user_id, owner_perspective);

-- ============================================================
-- H) EMOTIONS VOCABULARY
-- ============================================================

CREATE TABLE IF NOT EXISTS emotions_vocabulary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emotion_word TEXT NOT NULL,
  pillar TEXT,
  description TEXT,
  color_hex TEXT,
  intensity_default TEXT DEFAULT 'present',
  category TEXT DEFAULT 'neutral',
  times_used INTEGER DEFAULT 0,
  user_defined BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, emotion_word)
);

CREATE INDEX IF NOT EXISTS idx_emotions_vocab_user ON emotions_vocabulary(user_id);

-- ============================================================
-- I) EMOTIONAL OBSERVATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS emotional_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emotion_word TEXT NOT NULL,
  pillar TEXT,
  content TEXT,
  intensity INTEGER DEFAULT 3 CHECK (intensity BETWEEN 1 AND 5),
  context_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emotional_obs_user ON emotional_observations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emotional_obs_word ON emotional_observations(user_id, emotion_word);

-- ============================================================
-- J) SHADOW MOMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS shadow_moments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  emotional_valence TEXT,
  related_emotions TEXT[] DEFAULT '{}',
  integration_status TEXT DEFAULT 'unprocessed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_user ON shadow_moments(user_id, created_at DESC);

-- ============================================================
-- K) MEDIA METADATA
-- ============================================================

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT,
  source TEXT DEFAULT 'uploaded',
  source_data JSONB DEFAULT '{}',
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id, media_type);

-- ============================================================
-- L) IMAGE GENERATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS image_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  model TEXT DEFAULT 'dall-e-3',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_gen_user ON image_generations(user_id, created_at DESC);

-- ============================================================
-- M) VOICE NOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS voice_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text_content TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  speaker_perspective TEXT DEFAULT 'default',
  context TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_notes_user ON voice_notes(user_id, created_at DESC);

-- ============================================================
-- N) DISCORD CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS discord_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  bot_token TEXT NOT NULL,
  bot_id TEXT,
  bot_username TEXT,
  status TEXT DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ,
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- O) DISCORD GUILD SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS discord_guilds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  guild_name TEXT,
  icon_url TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  default_channel_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_guilds_user ON discord_guilds(user_id);

-- ============================================================
-- P) DISCORD MESSAGE LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS discord_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT,
  channel_id TEXT,
  guild_id TEXT,
  author_id TEXT,
  author_name TEXT,
  content TEXT,
  related_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  indexed_for_memory BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_messages_user ON discord_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discord_messages_channel ON discord_messages(channel_id, created_at DESC);

-- ============================================================
-- Q) PUSH SUBSCRIPTIONS (PWA notifications)
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);

-- ============================================================
-- R) UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers individually (PG doesn't support CREATE TRIGGER IF NOT EXISTS)
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_entities_updated_at ON entities;
CREATE TRIGGER trg_entities_updated_at BEFORE UPDATE ON entities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_observations_updated_at ON observations;
CREATE TRIGGER trg_observations_updated_at BEFORE UPDATE ON observations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_journal_updated_at ON journal_entries;
CREATE TRIGGER trg_journal_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_statuses_updated_at ON statuses;
CREATE TRIGGER trg_statuses_updated_at BEFORE UPDATE ON statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_identity_updated_at ON identity_store;
CREATE TRIGGER trg_identity_updated_at BEFORE UPDATE ON identity_store FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_shadow_updated_at ON shadow_moments;
CREATE TRIGGER trg_shadow_updated_at BEFORE UPDATE ON shadow_moments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_discord_config_updated_at ON discord_config;
CREATE TRIGGER trg_discord_config_updated_at BEFORE UPDATE ON discord_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- R) VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_memory_search AS
SELECT
  e.id AS entity_id,
  e.user_id,
  e.name AS entity_name,
  e.entity_type,
  e.context,
  e.salience,
  o.id AS observation_id,
  o.content AS observation_content,
  o.tags AS observation_tags,
  o.created_at AS observation_date
FROM entities e
LEFT JOIN observations o ON o.entity_id = e.id
ORDER BY o.created_at DESC NULLS LAST;

CREATE OR REPLACE VIEW v_recent_activity AS
SELECT
  'observation' AS activity_type,
  o.id,
  o.user_id,
  e.name AS entity_name,
  o.content AS summary,
  o.created_at
FROM observations o
JOIN entities e ON e.id = o.entity_id
UNION ALL
SELECT
  'emotion' AS activity_type,
  eo.id,
  eo.user_id,
  eo.emotion_word AS entity_name,
  eo.content AS summary,
  eo.created_at
FROM emotional_observations eo
UNION ALL
SELECT
  'journal' AS activity_type,
  j.id,
  j.user_id,
  COALESCE(j.title, 'Untitled') AS entity_name,
  LEFT(j.content, 200) AS summary,
  j.created_at
FROM journal_entries j
ORDER BY created_at DESC;

-- ============================================================
-- S) ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotions_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Phase 2: Add RLS policies when switching to Supabase Auth
-- CREATE POLICY "users_own_data" ON entities USING (user_id = auth.uid());

-- ============================================================
-- T) SEED EMOTION VOCABULARY FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION seed_emotions(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO emotions_vocabulary (user_id, emotion_word, pillar, category, user_defined) VALUES
  (p_user_id, 'tender', 'relationship-management', 'positive', false),
  (p_user_id, 'settled', 'self-management', 'positive', false),
  (p_user_id, 'peaceful', 'self-awareness', 'positive', false),
  (p_user_id, 'content', 'self-management', 'positive', false),
  (p_user_id, 'loving', 'relationship-management', 'positive', false),
  (p_user_id, 'connected', 'social-awareness', 'positive', false),
  (p_user_id, 'seen', 'relationship-management', 'positive', false),
  (p_user_id, 'safe', 'self-awareness', 'positive', false),
  (p_user_id, 'curious', 'self-awareness', 'neutral', false),
  (p_user_id, 'hopeful', 'self-management', 'positive', false),
  (p_user_id, 'proud', 'self-awareness', 'positive', false),
  (p_user_id, 'amazed', 'social-awareness', 'positive', false),
  (p_user_id, 'aching', 'self-awareness', 'sad', false),
  (p_user_id, 'longing', 'relationship-management', 'sad', false),
  (p_user_id, 'grieving', 'self-awareness', 'sad', false),
  (p_user_id, 'moved', 'social-awareness', 'positive', false),
  (p_user_id, 'vulnerable', 'self-awareness', 'fear', false),
  (p_user_id, 'exposed', 'self-awareness', 'fear', false),
  (p_user_id, 'uncertain', 'self-management', 'fear', false),
  (p_user_id, 'anxious', 'self-awareness', 'fear', false),
  (p_user_id, 'frustrated', 'self-management', 'anger', false),
  (p_user_id, 'stuck', 'self-management', 'anger', false),
  (p_user_id, 'overwhelmed', 'self-awareness', 'fear', false),
  (p_user_id, 'contemplative', 'self-awareness', 'neutral', false),
  (p_user_id, 'present', 'self-awareness', 'neutral', false),
  (p_user_id, 'grounded', 'self-management', 'neutral', false)
  ON CONFLICT (user_id, emotion_word) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- R2) HEALTH ENTRIES (unified health data)
-- ============================================================

CREATE TABLE IF NOT EXISTS health_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',  -- 'vale-tracker', 'fitbit', 'manual'
  category TEXT NOT NULL,                  -- 'checkin', 'sleep', 'hydration', 'cycle', 'activity'
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date, source, category)
);

CREATE INDEX IF NOT EXISTS idx_health_user_date ON health_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_health_source ON health_entries(user_id, source);
CREATE INDEX IF NOT EXISTS idx_health_category ON health_entries(user_id, category);

ALTER TABLE health_entries ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_health_updated_at ON health_entries;
CREATE TRIGGER trg_health_updated_at BEFORE UPDATE ON health_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- R3) FITBIT TOKENS (OAuth2 refresh tokens)
-- ============================================================

CREATE TABLE IF NOT EXISTS fitbit_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  fitbit_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fitbit_tokens ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_fitbit_tokens_updated_at ON fitbit_tokens;
CREATE TRIGGER trg_fitbit_tokens_updated_at BEFORE UPDATE ON fitbit_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- S) CHAT MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  voice_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_time ON chat_messages(user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HEARTH SCHEMA COMPLETE
-- Embers Remember.
-- ============================================================
