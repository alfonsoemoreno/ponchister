import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const songs = pgTable(
  "songs",
  {
    id: serial("id").primaryKey(),
    artist: text("artist").notNull(),
    title: text("title").notNull(),
    year: integer("year"),
    youtubeUrl: text("youtube_url").notNull(),
    isSpanish: boolean("isspanish").notNull().default(false),
    youtubeStatus: text("youtube_status"),
    youtubeValidationMessage: text("youtube_validation_message"),
    youtubeValidationCode: integer("youtube_validation_code"),
    youtubeValidatedAt: timestamp("youtube_validated_at", {
      withTimezone: true,
    }),
    catalogStatus: text("catalog_status").notNull().default("pending"),
    scope: text("scope").notNull().default("public"),
    ownerUserId: integer("owner_user_id").references(() => adminUsers.id, {
      onDelete: "cascade",
    }),
    sourceSongId: integer("source_song_id"),
    createdBy: integer("created_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    approvedBy: integer("approved_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    publicYoutubeUrlIdx: uniqueIndex("songs_public_youtube_url_unique")
      .on(table.youtubeUrl)
      .where(sql`${table.scope} = 'public'`),
    personalOwnerYoutubeUrlIdx: uniqueIndex("songs_personal_owner_youtube_url_unique")
      .on(table.ownerUserId, table.youtubeUrl)
      .where(sql`${table.scope} = 'personal'`),
  })
);

export const playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  scope: text("scope").notNull().default("public"),
  ownerUserId: integer("owner_user_id").references(() => adminUsers.id, {
    onDelete: "cascade",
  }),
  createdBy: integer("created_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  publicPlaylistNameIdx: uniqueIndex("playlists_public_name_unique")
    .on(table.name)
    .where(sql`${table.scope} = 'public'`),
  personalOwnerPlaylistNameIdx: uniqueIndex("playlists_personal_owner_name_unique")
    .on(table.ownerUserId, table.name)
    .where(sql`${table.scope} = 'personal'`),
}));

export const playlistSongs = pgTable(
  "playlist_songs",
  {
    id: serial("id").primaryKey(),
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    songId: integer("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedBy: integer("added_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    playlistSongUniqueIdx: uniqueIndex("playlist_songs_playlist_song_unique").on(
      table.playlistId,
      table.songId
    ),
  })
);

export const gameSessions = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  mode: text("mode").notNull().default("auto"),
  yearMin: integer("year_min"),
  yearMax: integer("year_max"),
  onlySpanish: boolean("only_spanish").notNull().default(false),
  timerEnabled: boolean("timer_enabled").notNull().default(false),
  playlistId: integer("playlist_id"),
  playlistName: text("playlist_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
