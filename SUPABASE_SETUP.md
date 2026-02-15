
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

## Configuration

The Supabase URL and Anon Key are already configured in `app.json`:
- `supabaseUrl`: Your Supabase project URL
- `supabaseAnonKey`: Your Supabase anonymous key

## Features

- **Sign Up**: Creates a new user account and profile in the `profiles` table
- **Sign In**: Authenticates existing users
- **Light/Dark Mode**: Automatically adapts to the user's system preferences
  - Light mode: Pink to orange gradient background
  - Dark mode: Black gradient background
- **Profile Data**: Stores user information including:
  - Email (required)
  - Full Name (required)
  - Username (optional)
  - Bio (optional)

## Usage

Navigate to `/auth` to access the authentication screen. Users can toggle between Sign In and Sign Up modes.
