
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

---

# Authentication Setup & Troubleshooting

## Overview

The app uses Supabase for authentication. The frontend sends Supabase JWT access tokens to the backend, which validates them using the Supabase JWT secret.

## Configuration

### Frontend Configuration (app.json)

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://ilobeaszwnfbwebemmji.supabase.co",
      "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "backendUrl": "https://jn958xzmbtrp3dkq4pzf9x4gqbxb8sh3.app.specular.dev"
    }
  }
}
```

### Backend Configuration (Environment Variables)

The backend needs these environment variables:

```bash
SUPABASE_URL=https://ilobeaszwnfbwebemmji.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=<your_jwt_secret_from_supabase_dashboard>
```

**CRITICAL**: The JWT secret is found in Supabase Dashboard → Settings → API → JWT Secret

### Production Build Configuration (eas.json)

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://ilobeaszwnfbwebemmji.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "EXPO_PUBLIC_BACKEND_URL": "https://jn958xzmbtrp3dkq4pzf9x4gqbxb8sh3.app.specular.dev"
      }
    }
  }
}
```

## Authentication Flow

1. **User signs in** via Supabase Auth (email/password or OAuth)
2. **Supabase returns** a session with an `access_token` (JWT)
3. **Frontend stores** the session in AsyncStorage (handled by Supabase client)
4. **SupabaseAuthContext** loads the session on app start and provides it to the app
5. **API calls** retrieve the access token from the session via `getSupabaseAccessToken()`
6. **Authorization header** is added: `Authorization: Bearer <access_token>`
7. **Backend validates** the JWT token using the `SUPABASE_JWT_SECRET`
8. **Backend extracts** the user ID from the validated token (`token.sub`)

## Key Components

### SupabaseAuthContext
- Loads the Supabase session on app start
- Provides `user`, `session`, `loadingAuth`, and `isSessionReady` to the app
- Listens for auth state changes (sign in, sign out, token refresh)

### utils/api.ts
- `getSupabaseAccessToken()`: Retrieves the access token from the active session
- `apiCall()`: Automatically adds the Authorization header to all requests
- `authenticatedApiCall()`: Ensures a token exists before making the request

### app/index.tsx
- Waits for `isSessionReady` before redirecting
- Ensures the session is fully loaded before any API calls are made

## Troubleshooting

### 401 Unauthorized Errors

**Symptoms**: Backend returns 401 for authenticated requests

**Possible Causes**:
1. **Backend JWT secret not configured**
   - Check that `SUPABASE_JWT_SECRET` is set on the backend
   - Verify it matches the JWT secret in Supabase Dashboard → Settings → API

2. **Session not loaded before API call**
   - Check console logs for "Session is ready" messages
   - Ensure `isSessionReady` is true before making API calls

3. **Token expired**
   - Supabase tokens expire after 1 hour by default
   - The Supabase client should auto-refresh tokens
   - Check console logs for token expiration times

4. **Authorization header not sent**
   - Check console logs for "Authorization header added" messages
   - Verify the header is present in the request

**Solutions**:
- Configure the backend JWT secret
- Wait for `isSessionReady` before making API calls
- Check backend logs for authentication errors
- Verify the token is being sent in the Authorization header

### 404 User Not Found (profile_stats)

**Symptoms**: Backend returns 404 "User not found" for profile stats

**Possible Causes**:
1. **profile_stats row doesn't exist for the user**
   - The database trigger may not have run when the user signed up
   - The trigger may not be enabled

**Solutions**:
1. Create the database trigger:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'display_name')
  ON CONFLICT (id) DO NOTHING;
  
  -- Create profile_stats
  INSERT INTO public.profile_stats (user_id, post_count, follower_count, following_count)
  VALUES (new.id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

2. Manually create profile_stats for existing users:
```sql
INSERT INTO profile_stats (user_id, post_count, follower_count, following_count)
SELECT id, 0, 0, 0 FROM profiles
ON CONFLICT (user_id) DO NOTHING;
```

### Session Not Loading

**Symptoms**: App shows loading spinner indefinitely

**Possible Causes**:
1. **Supabase credentials not configured**
   - Check that `app.json` has the correct `supabaseUrl` and `supabaseAnonKey`

2. **Network issues**
   - Check that the device has internet connectivity
   - Verify Supabase is accessible

**Solutions**:
- Verify Supabase credentials in `app.json`
- Check network connectivity
- Check console logs for Supabase errors

### Production Build Issues

**Symptoms**: Auth works in development but not in production builds

**Possible Causes**:
1. **Environment variables not set for production**
   - Check that `eas.json` has the production env vars

2. **Deep link scheme not configured**
   - Verify `scheme: "floomingo"` is set in `app.json`
   - Add `floomingo://**` to Supabase redirect URLs

**Solutions**:
- Configure production env vars in `eas.json`
- Set up deep link scheme
- Add redirect URLs in Supabase Dashboard

## Debugging Checklist

When debugging auth issues, check the following in order:

1. ✅ **Frontend**: Session is loaded (`isSessionReady: true`)
2. ✅ **Frontend**: Access token is retrieved (`getSupabaseAccessToken()` returns a token)
3. ✅ **Frontend**: Authorization header is added to requests
4. ✅ **Backend**: JWT secret is configured (`SUPABASE_JWT_SECRET`)
5. ✅ **Backend**: Token validation is working (check backend logs)
6. ✅ **Database**: profile and profile_stats rows exist for the user
7. ✅ **Database**: RLS policies allow the intended operations

## Console Log Messages

### Successful Auth Flow

```
[SupabaseAuthProvider] Initializing auth state
[SupabaseAuthProvider] Fetching initial session from Supabase
[SupabaseAuthProvider] Initial session loaded: true user: <user_id>
[SupabaseAuthProvider] Session access token available: true
[API] Fetching Supabase session for access token
[API] Retrieved Supabase access token from session
[API] ✓ Authorization header added with Supabase access token
[API] GET https://backend.url/api/endpoint
[API] Response status: 200 OK
[API] ✓ Success: <response_data>
```

### Failed Auth Flow (401)

```
[API] Fetching Supabase session for access token
[API] Retrieved Supabase access token from session
[API] ✓ Authorization header added with Supabase access token
[API] GET https://backend.url/api/endpoint
[API] Response status: 401 Unauthorized
[API] ❌ Error response (401): {"error":"Unauthorized"}
[API] 401 Unauthorized - Possible causes:
  1. Supabase session expired or invalid
  2. Backend not configured to validate Supabase JWT tokens
  3. Missing or incorrect SUPABASE_JWT_SECRET on backend
```
