import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const marketCache = sqliteTable("market_cache", {
  cacheKey: text("cache_key").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
