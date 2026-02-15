
# Supabase Setup Instructions

This app uses Supabase for authentication and data storage. The configuration is already set up in `app.json`.

## Database Schema

You need to create a `profiles` table in your Supabase database with the following structure:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
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

### Storage Policies

For both buckets, create the following policies:

```sql
-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload their own images"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (true);

-- Allow users to update their own images
CREATE POLICY "Users can update their own images"
  ON storage.objects FOR UPDATE
  USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own images"
  ON storage.objects FOR DELETE
  USING (auth.uid()::text = (storage.foldername(name))[1]);
```

## Configuration

The Supabase URL and Anon Key are already configured in `app.json`:
- `supabaseUrl`: Your Supabase project URL
- `supabaseAnonKey`: Your Supabase anonymous key

## Features

- **Sign Up**: Creates a new user account and profile in the `profiles` table
- **Sign In**: Authenticates existing users
- **Edit Profile**: Users can update their profile information including:
  - Full Name (required)
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
