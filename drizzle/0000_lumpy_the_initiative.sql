CREATE TABLE "appearances" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"played" boolean DEFAULT false NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_league_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"status_message" text
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"opponent" text NOT NULL,
	"venue" text,
	"goals_for" integer DEFAULT 0 NOT NULL,
	"goals_against" integer DEFAULT 0 NOT NULL,
	"match_cost_gbp" numeric(10, 2) DEFAULT '70.00' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"season_id" integer NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount_gbp" numeric(10, 2) NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"handle" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"is_active" boolean DEFAULT false NOT NULL,
	"source_url_players_lounge" text,
	"source_url_fixtures" text,
	"source_url_standings" text
);
--> statement-breakpoint
ALTER TABLE "appearances" ADD CONSTRAINT "appearances_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appearances" ADD CONSTRAINT "appearances_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_league_snapshots" ADD CONSTRAINT "external_league_snapshots_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appearances_match_player_unique" ON "appearances" USING btree ("match_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_handle_unique" ON "players" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_slug_unique" ON "seasons" USING btree ("slug");