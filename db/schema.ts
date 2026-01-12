import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const seasons = pgTable(
  "seasons",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    isActive: boolean("is_active").notNull().default(false),
    sourceUrlPlayersLounge: text("source_url_players_lounge"),
    sourceUrlFixtures: text("source_url_fixtures"),
    sourceUrlStandings: text("source_url_standings"),
    playfootballTeamName: text("playfootball_team_name"),
  },
  (table) => ({
    slugUnique: uniqueIndex("seasons_slug_unique").on(table.slug),
  })
);

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    displayName: text("display_name").notNull(),
    handle: text("handle").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    handleUnique: uniqueIndex("players_handle_unique").on(table.handle),
  })
);

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "restrict" }),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  opponent: text("opponent").notNull(),
  venue: text("venue"),
  goalsFor: integer("goals_for").notNull().default(0),
  goalsAgainst: integer("goals_against").notNull().default(0),
  matchCostGbp: numeric("match_cost_gbp", { precision: 10, scale: 2 })
    .notNull()
    .default("70.00"),
  notes: text("notes"),
});

export const appearances = pgTable(
  "appearances",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    played: boolean("played").notNull().default(false),
    goals: integer("goals").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    matchSharePence: integer("match_share_pence"),
  },
  (table) => ({
    matchPlayerUnique: uniqueIndex("appearances_match_player_unique").on(
      table.matchId,
      table.playerId
    ),
  })
);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  seasonId: integer("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "restrict" }),
  paidAt: timestamp("paid_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  amountGbp: numeric("amount_gbp", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
});

export const externalLeagueSnapshots = pgTable("external_league_snapshots", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  source: text("source").notNull(),
  payloadJson: jsonb("payload_json").notNull(),
  status: text("status").notNull().default("ok"),
  statusMessage: text("status_message"),
});

export const adminLoginAttempts = pgTable("admin_login_attempts", {
  ip: text("ip").primaryKey(),
  count: integer("count").notNull().default(0),
  firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
