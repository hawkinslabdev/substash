import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  stashId: text("stash_id").notNull(),
  mediaType: text("media_type", { enum: ["scene", "image"] }).notNull(),
  parentId: text("parent_id"),
  body: text("body").notNull(),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

export const likes = sqliteTable("likes", {
  stashId: text("stash_id").primaryKey(),
  mediaType: text("media_type", { enum: ["scene", "image"] }).notNull(),
  title: text("title"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type Like = typeof likes.$inferSelect;

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Setting = typeof settings.$inferSelect;

export const shareLinks = sqliteTable("share_links", {
  token: text("token").primaryKey(),
  originalPath: text("original_path").notNull(),
  stashId: text("stash_id").notNull(),
  mediaType: text("media_type", { enum: ["scene", "image"] }).notNull(),
  hmac: text("hmac").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type ShareLink = typeof shareLinks.$inferSelect;
