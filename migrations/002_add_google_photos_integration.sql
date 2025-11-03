-- Migration: Add Google Photos Integration Support
-- This migration adds tables and columns needed for Google Photos Picker API integration

-- Add Google OAuth tokens to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_photos_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_photos_connected_at TIMESTAMPTZ;

-- Create table for Google Photos sessions
CREATE TABLE IF NOT EXISTS google_photos_sessions (
    id TEXT PRIMARY KEY, -- Google session ID
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    picker_uri TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'expired', 'cancelled'
    media_items_set BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
    completed_at TIMESTAMPTZ
);

-- Create table for imported Google Photos
CREATE TABLE IF NOT EXISTS google_photos_imports (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES google_photos_sessions(id) ON DELETE SET NULL,
    photo_id BIGINT REFERENCES photos(id) ON DELETE SET NULL, -- Link to photos table after upload
    google_media_item_id TEXT NOT NULL, -- Google's media item ID
    base_url TEXT NOT NULL, -- Base URL for accessing the photo
    mime_type TEXT NOT NULL,
    filename TEXT,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    base_url_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '60 minutes',
    metadata JSONB, -- Store additional metadata

    -- Prevent duplicate imports
    UNIQUE(user_id, google_media_item_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_photos_sessions_user_id ON google_photos_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_google_photos_sessions_status ON google_photos_sessions(status);
CREATE INDEX IF NOT EXISTS idx_google_photos_sessions_created_at ON google_photos_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_google_photos_imports_user_id ON google_photos_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_google_photos_imports_session_id ON google_photos_imports(session_id);
CREATE INDEX IF NOT EXISTS idx_google_photos_imports_photo_id ON google_photos_imports(photo_id);
CREATE INDEX IF NOT EXISTS idx_google_photos_imports_google_media_item_id ON google_photos_imports(google_media_item_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE google_photos_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_photos_imports ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view their own Google Photos sessions"
    ON google_photos_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google Photos sessions"
    ON google_photos_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google Photos sessions"
    ON google_photos_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google Photos sessions"
    ON google_photos_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Users can only see their own imports
CREATE POLICY "Users can view their own Google Photos imports"
    ON google_photos_imports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google Photos imports"
    ON google_photos_imports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google Photos imports"
    ON google_photos_imports FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google Photos imports"
    ON google_photos_imports FOR DELETE
    USING (auth.uid() = user_id);

-- Add source field to photos table to track where photos came from
ALTER TABLE photos
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual_upload', -- 'manual_upload', 'google_photos', 'other'
ADD COLUMN IF NOT EXISTS source_id TEXT; -- For tracking original source ID (e.g., Google media item ID)

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-update updated_at for google_photos_sessions
CREATE TRIGGER update_google_photos_sessions_updated_at
    BEFORE UPDATE ON google_photos_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE google_photos_sessions IS 'Stores Google Photos Picker API sessions for tracking user photo selections';
COMMENT ON TABLE google_photos_imports IS 'Tracks photos imported from Google Photos via the Picker API';
COMMENT ON COLUMN profiles.google_access_token IS 'OAuth 2.0 access token for Google Photos API (encrypted recommended)';
COMMENT ON COLUMN profiles.google_refresh_token IS 'OAuth 2.0 refresh token for obtaining new access tokens (encrypted recommended)';
COMMENT ON COLUMN google_photos_imports.base_url_expires_at IS 'Google Photos base URLs expire after 60 minutes';
