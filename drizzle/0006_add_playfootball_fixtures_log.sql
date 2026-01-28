CREATE TABLE "playfootball_fixtures_log" (
  "id" serial PRIMARY KEY,
  "season_id" integer NOT NULL REFERENCES "seasons"("id") ON DELETE cascade,
  "fixture_key" text NOT NULL,
  "kickoff_at" timestamp with time zone,
  "date_label" text,
  "time" text,
  "pitch" text,
  "home" text NOT NULL,
  "away" text NOT NULL,
  "score_home" integer,
  "score_away" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "playfootball_fixtures_unique" ON "playfootball_fixtures_log" ("season_id", "fixture_key");
