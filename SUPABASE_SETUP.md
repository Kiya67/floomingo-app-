
# Supabase Setup Instructions

This app uses Supabase for authentication and data storage. The configuration is already set up in `app.json`.

## Database Schema

You need to create a `profiles` table in your Supabase database with the following structure:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

## Storage Buckets

You need to create two storage buckets in your Supabase project for image uploads:

### 1. Avatars Bucket
- **Bucket Name**: `avatars`
- **Public**: Yes (enable public access)
- **File Size Limit**: 2MB recommended
- **Allowed MIME Types**: image/jpeg, image/png, image/jpg

### 2. Covers Bucket
- **Bucket Name**: `covers`
- **Public**: Yes (enable public access)
- **File Size Limit**: 5MB recommended
- **Allowed MIME Types**: image/jpeg, image/png, image/jpg

### Storage Policies (CRITICAL - MUST BE SET UP)

⚠️ **IMPORTANT**: The storage buckets MUST have proper RLS policies or uploads will fail with "row-level security policy" errors.

For **BOTH** the `avatars` and `covers` buckets, you need to create the following policies in the Supabase Dashboard:

#### Step-by-step instructions:

1. Go to **Storage** in your Supabase Dashboard
2. Click on the bucket name (`avatars` or `covers`)
3. Click on **Policies** tab
4. Click **New Policy**
5. Create the following policies:

**Policy 1: Allow authenticated users to upload**
```sql
-- Policy name: "Users can upload their own images"
-- Allowed operation: INSERT
-- Policy definition:
(bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
```

**Policy 2: Allow public read access**
```sql
-- Policy name: "Public read access"
-- Allowed operation: SELECT
-- Policy definition:
bucket_id = 'avatars'
```

**Policy 3: Allow users to update their own images**
```sql
-- Policy name: "Users can update their own images"
-- Allowed operation: UPDATE
-- Policy definition:
(bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
```

**Policy 4: Allow users to delete their own images**
```sql
-- Policy name: "Users can delete their own images"
-- Allowed operation: DELETE
-- Policy definition:
(bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
```

**Repeat the same 4 policies for the `covers` bucket** (just replace `'avatars'` with `'covers'` in the policy definitions).

### Alternative: SQL Script for Storage Policies

If you prefer to use SQL, you can run this in the Supabase SQL Editor:

```sql
-- Policies for avatars bucket
CREATE POLICY "Users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policies for covers bucket
CREATE POLICY "Users can upload covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'covers' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public read access for covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

CREATE POLICY "Users can update their covers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'covers' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their covers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'covers' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## Configuration

The Supabase URL and Anon Key are already configured in `app.json`:
- `supabaseUrl`: Your Supabase project URL
- `supabaseAnonKey`: Your Supabase anonymous key

## Features

- **Sign Up**: Creates a new user account and profile in the `profiles` table
- **Sign In**: Authenticates existing users
- **Edit Profile**: Users can update their profile information including:
  - Name (required) - stored as `display_name`
  - Username (optional)
  - Bio (optional)
  - Profile Photo (avatar) - stored in `avatars` bucket
  - Cover Photo - stored in `covers` bucket
- **Light/Dark Mode**: Automatically adapts to the user's system preferences
  - Light mode: Pink to orange gradient background
  - Dark mode: Black gradient background
- **Profile Display**: Shows user information on the profile tab:
  - Name, username, and bio (email and password are NOT displayed)
  - Profile photo and cover photo
  - Stats (posts, followers, following)

## Usage

1. Navigate to `/auth` to access the authentication screen
2. Sign up with your email, password, name, username (optional), and bio (optional)
3. After signing in, navigate to the Profile tab to view your profile
4. Tap "Edit Profile" to update your information and upload photos
5. Profile and cover photos are automatically uploaded to Supabase storage

## Troubleshooting

### "new row violates row-level security policy" error when uploading images

This means the storage bucket policies are not set up correctly. Follow the **Storage Policies** section above to create the required policies for both `avatars` and `covers` buckets.

### "Could not find the 'full_name' column" error

The database schema uses `display_name` instead of `full_name`. Make sure your `profiles` table has a `display_name` column (not `full_name`).

### Images not displaying after upload

1. Make sure the storage buckets are set to **Public**
2. Verify that the "Public read access" policy is created for both buckets
3. Check that the image URLs are being saved correctly in the `avatar_url` and `cover_url` columns
