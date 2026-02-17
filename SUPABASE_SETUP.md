
# Supabase Database Schema

This document describes the complete database schema for the travel social media app.

## Authentication Tables (Managed by Supabase Auth)
- `auth.users` - User authentication data
- `auth.sessions` - User sessions

## Core Tables

### profiles
User profile information
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### posts
Video posts
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  place_id TEXT,
  place_name TEXT,
  location_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  view_count INTEGER DEFAULT 0
);
```

### follows
User follow relationships
```sql
CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);
```

### post_likes
Post likes
```sql
CREATE TABLE post_likes (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
```

### comments
Post comments
```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### post_shares
Post share tracking
```sql
CREATE TABLE post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  share_target TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### post_stats
Aggregated post statistics
```sql
CREATE TABLE post_stats (
  post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### blocks
User blocks
```sql
CREATE TABLE blocks (
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);
```

### notifications
User notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Trips/Boards System Tables

### boards
User-created trip boards for organizing saved content
```sql
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_boards_user_id ON boards(user_id);
CREATE INDEX idx_boards_updated_at ON boards(updated_at DESC);
```

### board_posts (renamed from board_items)
Videos saved to boards
```sql
CREATE TABLE board_posts (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (board_id, post_id)
);

CREATE INDEX idx_board_posts_board_id ON board_posts(board_id);
CREATE INDEX idx_board_posts_post_id ON board_posts(post_id);
```

### board_places
Places/locations saved to boards
```sql
CREATE TABLE board_places (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  place_name TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  place_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (board_id, place_id)
);

CREATE INDEX idx_board_places_board_id ON board_places(board_id);
```

## Row Level Security (RLS) Policies

### boards
```sql
-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Users can view their own boards
CREATE POLICY "Users can view own boards"
  ON boards FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own boards
CREATE POLICY "Users can create own boards"
  ON boards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own boards
CREATE POLICY "Users can update own boards"
  ON boards FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own boards
CREATE POLICY "Users can delete own boards"
  ON boards FOR DELETE
  USING (auth.uid() = user_id);
```

### board_posts
```sql
-- Enable RLS
ALTER TABLE board_posts ENABLE ROW LEVEL SECURITY;

-- Users can view items in their own boards
CREATE POLICY "Users can view own board posts"
  ON board_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_posts.board_id
      AND boards.user_id = auth.uid()
    )
  );

-- Users can add items to their own boards
CREATE POLICY "Users can add to own boards"
  ON board_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_posts.board_id
      AND boards.user_id = auth.uid()
    )
  );

-- Users can remove items from their own boards
CREATE POLICY "Users can remove from own boards"
  ON board_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_posts.board_id
      AND boards.user_id = auth.uid()
    )
  );
```

### board_places
```sql
-- Enable RLS
ALTER TABLE board_places ENABLE ROW LEVEL SECURITY;

-- Users can view places in their own boards
CREATE POLICY "Users can view own board places"
  ON board_places FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_places.board_id
      AND boards.user_id = auth.uid()
    )
  );

-- Users can add places to their own boards
CREATE POLICY "Users can add places to own boards"
  ON board_places FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_places.board_id
      AND boards.user_id = auth.uid()
    )
  );

-- Users can remove places from their own boards
CREATE POLICY "Users can remove places from own boards"
  ON board_places FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_places.board_id
      AND boards.user_id = auth.uid()
    )
  );
```

## Database Functions

### Update board updated_at timestamp
```sql
CREATE OR REPLACE FUNCTION update_board_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE boards
  SET updated_at = NOW()
  WHERE id = NEW.board_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_board_timestamp_on_post_insert
  AFTER INSERT ON board_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_board_timestamp();

CREATE TRIGGER update_board_timestamp_on_place_insert
  AFTER INSERT ON board_places
  FOR EACH ROW
  EXECUTE FUNCTION update_board_timestamp();
```

## Setup Instructions

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL commands above to create the tables
4. Enable Row Level Security policies
5. Create the database functions and triggers
6. Test the setup by creating a board and saving a post

## Notes

- All timestamps use `TIMESTAMP WITH TIME ZONE` for proper timezone handling
- UUIDs are used for primary keys for better scalability
- Composite primary keys are used for many-to-many relationships
- Indexes are created on foreign keys and frequently queried columns
- RLS policies ensure users can only access their own data
- The `updated_at` field on boards is automatically updated when items are added
