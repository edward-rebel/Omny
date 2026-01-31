import { pool } from './db';

const initSQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  display_name VARCHAR,
  profile_image_url VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table for authentication
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  participants JSONB NOT NULL,
  raw_transcript TEXT NOT NULL,
  summary TEXT,
  key_takeaways JSONB NOT NULL,
  topics_discussed JSONB,
  follow_ups JSONB NOT NULL,
  effectiveness_score INTEGER NOT NULL,
  went_well JSONB NOT NULL,
  areas_to_improve JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Themes table
CREATE TABLE IF NOT EXISTS themes (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  last_update TEXT NOT NULL,
  context TEXT,
  updates JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  meeting_id INTEGER NOT NULL REFERENCES meetings(id),
  project_id INTEGER REFERENCES projects(id),
  task TEXT NOT NULL,
  owner TEXT NOT NULL,
  due TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Meta insights table
CREATE TABLE IF NOT EXISTS meta_insights (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  average_score INTEGER NOT NULL,
  total_meetings INTEGER NOT NULL,
  strengths JSONB NOT NULL,
  opportunities JSONB NOT NULL,
  trends JSONB NOT NULL,
  narrative_went_well TEXT,
  narrative_areas_to_improve TEXT,
  last_updated TIMESTAMP DEFAULT NOW() NOT NULL
);

-- System prompts table
CREATE TABLE IF NOT EXISTS system_prompts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  prompt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add source column to meetings table (for webhook vs manual)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Add theme reference to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS theme_id INTEGER REFERENCES themes(id);
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_theme_id_fkey;
ALTER TABLE projects
  ADD CONSTRAINT projects_theme_id_fkey
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE SET NULL;

-- API Keys table for webhook authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
`;

export async function initializeDatabase(): Promise<void> {
  console.log('Initializing database schema...');
  try {
    await pool.query(initSQL);
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
}
