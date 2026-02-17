import { pgTable, text, timestamp, primaryKey, uuid, uniqueIndex } from 'drizzle-orm/pg-core';

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
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull(),
  postId: text('post_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('board_posts_unique').on(table.boardId, table.postId),
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
