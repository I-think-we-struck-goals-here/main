import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import {
  appearances,
  adminLoginAttempts,
  externalLeagueSnapshots,
  matches,
  payments,
  players,
  playfootballFixturesLog,
  seasons,
} from "./schema";

export type Season = InferSelectModel<typeof seasons>;
export type NewSeason = InferInsertModel<typeof seasons>;

export type Player = InferSelectModel<typeof players>;
export type NewPlayer = InferInsertModel<typeof players>;

export type Match = InferSelectModel<typeof matches>;
export type NewMatch = InferInsertModel<typeof matches>;

export type Appearance = InferSelectModel<typeof appearances>;
export type NewAppearance = InferInsertModel<typeof appearances>;

export type Payment = InferSelectModel<typeof payments>;
export type NewPayment = InferInsertModel<typeof payments>;

export type ExternalLeagueSnapshot = InferSelectModel<
  typeof externalLeagueSnapshots
>;
export type NewExternalLeagueSnapshot = InferInsertModel<
  typeof externalLeagueSnapshots
>;

export type PlayfootballFixtureLog = InferSelectModel<
  typeof playfootballFixturesLog
>;
export type NewPlayfootballFixtureLog = InferInsertModel<
  typeof playfootballFixturesLog
>;

export type AdminLoginAttempt = InferSelectModel<typeof adminLoginAttempts>;
export type NewAdminLoginAttempt = InferInsertModel<typeof adminLoginAttempts>;
