import { pgTable, text, timestamp, primaryKey, uuid, uniqueIndex, integer, bigint, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  username: text('username').unique(),
  displayName: text('display_name'),
  email: text('email'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  coverUrl: text('cover_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const blocks = pgTable('blocks', {
  blockerId: text('blocker_id').notNull(),
  blockedId: text('blocked_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.blockerId, table.blockedId] }),
]);

export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  coverUrl: text('cover_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const boardPosts = pgTable('board_posts', {
  boardId: uuid('board_id').notNull(),
  postId: text('post_id').notNull(),
  savedBy: text('saved_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.boardId, table.postId, table.savedBy] }),
]);

export const boardPlaces = pgTable('board_places', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull(),
  postId: text('post_id').notNull(),
  placeId: text('place_id').notNull(),
  placeName: text('place_name').notNull(),
  placeAddress: text('place_address').notNull(),
  placePrimaryType: text('place_primary_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('board_places_unique').on(table.boardId, table.placeId),
]);

export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tripItems = pgTable('trip_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull(),
  postId: text('post_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('trip_items_unique').on(table.tripId, table.postId),
]);

export const profileStats = pgTable('profile_stats', {
  userId: text('user_id').primaryKey(),
  followerCount: integer('follower_count').default(0).notNull(),
  followingCount: integer('following_count').default(0).notNull(),
  postCount: integer('post_count').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  caption: text('caption').notNull(),
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  placeId: text('place_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const postStats = pgTable('post_stats', {
  postId: uuid('post_id').primaryKey(),
  viewCount: bigint('view_count', { mode: 'number' }).default(0).notNull(),
});

export const follows = pgTable('follows', {
  followerId: text('follower_id').notNull(),
  followingId: text('following_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.followerId, table.followingId] }),
  check('no_self_follow', sql`${table.followerId} != ${table.followingId}`),
  index('follows_follower_idx').on(table.followerId),
  index('follows_following_idx').on(table.followingId),
]);
