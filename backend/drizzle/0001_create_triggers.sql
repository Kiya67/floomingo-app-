-- Function to recalculate stats for a user
CREATE OR REPLACE FUNCTION recalculate_profile_stats(p_user_id text)
RETURNS void AS $$
DECLARE
  v_post_count integer;
  v_follower_count integer;
  v_following_count integer;
BEGIN
  -- Count posts
  SELECT COUNT(*) INTO v_post_count FROM posts WHERE user_id = p_user_id AND deleted_at IS NULL;

  -- Count followers (users following this user)
  SELECT COUNT(*) INTO v_follower_count FROM follows WHERE following_id = p_user_id;

  -- Count following (users this user follows)
  SELECT COUNT(*) INTO v_following_count FROM follows WHERE follower_id = p_user_id;

  -- Update or insert stats
  INSERT INTO profile_stats (user_id, post_count, follower_count, following_count, updated_at)
  VALUES (p_user_id, v_post_count, v_follower_count, v_following_count, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET post_count = v_post_count,
      follower_count = v_follower_count,
      following_count = v_following_count,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger: Increment post count when a post is created
CREATE OR REPLACE FUNCTION increment_post_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profile_stats (user_id, post_count, follower_count, following_count, updated_at)
  VALUES (NEW.user_id, 1, 0, 0, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET post_count = profile_stats.post_count + 1,
      updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_created_increment_count ON posts;
CREATE TRIGGER post_created_increment_count
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION increment_post_count();

-- Trigger: Decrement post count when a post is deleted (soft delete)
CREATE OR REPLACE FUNCTION decrement_post_count_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    INSERT INTO profile_stats (user_id, post_count, follower_count, following_count, updated_at)
    VALUES (NEW.user_id, 0, 0, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET post_count = GREATEST(0, profile_stats.post_count - 1),
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_deleted_decrement_count ON posts;
CREATE TRIGGER post_deleted_decrement_count
AFTER UPDATE ON posts
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION decrement_post_count_soft_delete();

-- Trigger: Increment follower/following counts when follow is created
CREATE OR REPLACE FUNCTION increment_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment following count for follower
  INSERT INTO profile_stats (user_id, post_count, follower_count, following_count, updated_at)
  VALUES (NEW.follower_id, 0, 0, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET following_count = profile_stats.following_count + 1,
      updated_at = NOW();

  -- Increment follower count for following
  INSERT INTO profile_stats (user_id, post_count, follower_count, following_count, updated_at)
  VALUES (NEW.following_id, 0, 1, 0, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET follower_count = profile_stats.follower_count + 1,
      updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS follow_created_increment_counts ON follows;
CREATE TRIGGER follow_created_increment_counts
AFTER INSERT ON follows
FOR EACH ROW
EXECUTE FUNCTION increment_follow_counts();

-- Trigger: Decrement follower/following counts when follow is deleted
CREATE OR REPLACE FUNCTION decrement_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrement following count for follower
  INSERT INTO profile_stats (user_id, post_count, follower_count, following_count, updated_at)
  VALUES (OLD.follower_id, 0, 0, 0, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET following_count = GREATEST(0, profile_stats.following_count - 1),
      updated_at = NOW();

  -- Decrement follower count for following
  INSERT INTO profile_stats (user_id, post_count, follower_count, following_count, updated_at)
  VALUES (OLD.following_id, 0, 0, 0, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET follower_count = GREATEST(0, profile_stats.follower_count - 1),
      updated_at = NOW();

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS follow_deleted_decrement_counts ON follows;
CREATE TRIGGER follow_deleted_decrement_counts
AFTER DELETE ON follows
FOR EACH ROW
EXECUTE FUNCTION decrement_follow_counts();

-- Function to safely increment view count
CREATE OR REPLACE FUNCTION increment_view(p_post_id uuid)
RETURNS bigint AS $$
DECLARE
  v_new_count bigint;
BEGIN
  -- Increment view count in post_stats
  UPDATE post_stats
  SET view_count = view_count + 1
  WHERE post_id = p_post_id
  RETURNING view_count INTO v_new_count;

  -- If no row exists, create one (shouldn't happen in normal flow)
  IF v_new_count IS NULL THEN
    INSERT INTO post_stats (post_id, view_count)
    VALUES (p_post_id, 1)
    ON CONFLICT (post_id) DO UPDATE
    SET view_count = post_stats.view_count + 1
    RETURNING view_count INTO v_new_count;
  END IF;

  RETURN v_new_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Initialize post_stats when a post is created
CREATE OR REPLACE FUNCTION init_post_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO post_stats (post_id, view_count)
  VALUES (NEW.id, 0)
  ON CONFLICT (post_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_created_init_stats ON posts;
CREATE TRIGGER post_created_init_stats
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION init_post_stats();
