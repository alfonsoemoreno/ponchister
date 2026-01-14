import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const songs = pgTable(
  "songs",
  {
    id: serial("id").primaryKey(),
    artist: text("artist").notNull(),
    title: text("title").notNull(),
    year: integer("year"),
    youtubeUrl: text("youtube_url").notNull(),
    isSpanish: boolean("isspanish").notNull().default(false),
  },
  (table) => ({
    youtubeUrlIdx: uniqueIndex("songs_youtube_url_unique").on(table.youtubeUrl),
  })
);

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
