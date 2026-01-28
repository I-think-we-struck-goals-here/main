import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { externalLeagueSnapshots, playfootballFixturesLog } from "@/db/schema";
import type { ExternalLeagueSnapshot, Season } from "@/db/types";

const JINA_BASE_URL = "https://r.jina.ai/http://";
const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;

export type LeagueFixture = {
  dateLabel: string;
  time: string;
  pitch: string | null;
  home: string;
  away: string;
  scoreHome: number | null;
  scoreAway: number | null;
  kickoffAt: string | null;
};

export type LeagueStanding = {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

export type PlayFootballSnapshot = {
  fixtures: LeagueFixture[];
  standings: LeagueStanding[];
  fetchedAt: string;
};

const toJinaUrl = (url: string) => {
  const normalized = url.startsWith("http") ? url : `https://${url}`;
  const hostPath = normalized.replace(/^https?:\/\//, "");
  return `${JINA_BASE_URL}${hostPath}`;
};

const fetchMarkdown = async (url: string) => {
  const response = await fetch(toJinaUrl(url), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`PlayFootball fetch failed: ${response.status}`);
  }
  const text = await response.text();
  const marker = "Markdown Content:";
  const markerIndex = text.indexOf(marker);
  return markerIndex >= 0 ? text.slice(markerIndex + marker.length).trim() : text;
};

const parseNumberTokens = (value: string) => {
  return value
    .trim()
    .split(/\s+/)
    .flatMap((token) => {
      if (/^-?\d+$/.test(token)) {
        return [Number(token)];
      }
      const dashMatch = token.match(/^(\d+)-(\d+)$/);
      if (dashMatch) {
        return [Number(dashMatch[1]), -Number(dashMatch[2])];
      }
      return [];
    });
};

export const formatPlayFootballTeamName = (value: string) => {
  const withoutMarkdown = value.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const withoutUrls = withoutMarkdown.replace(/https?:\/\/\S+/g, "").trim();
  return withoutUrls || value.trim();
};

const scoreRegex = /(\d{1,2})\s*[-–]\s*(\d{1,2})/;
const scoreTokenRegex = /^\d{1,2}$/;

const extractScoreFromLine = (line: string) => {
  const match = line.match(scoreRegex);
  if (!match) {
    return { scoreHome: null, scoreAway: null };
  }
  return {
    scoreHome: Number(match[1]),
    scoreAway: Number(match[2]),
  };
};

const parseStandingsTable = (lines: string[]) => {
  const standings: LeagueStanding[] = [];
  let inTable = false;

  for (const line of lines) {
    if (!inTable) {
      if (/\|\s*Name\s*\|\s*P\s*\|/i.test(line)) {
        inTable = true;
      }
      continue;
    }

    if (!line.startsWith("|")) {
      break;
    }

    if (/\|\s*-+\s*\|/.test(line)) {
      continue;
    }

    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (cells.length < 10) {
      continue;
    }

    const position = Number(cells[0]);
    const team = formatPlayFootballTeamName(cells[1]);
    const played = Number(cells[2]);
    const won = Number(cells[3]);
    const drawn = Number(cells[4]);
    const lost = Number(cells[5]);
    const goalsFor = Number(cells[6]);
    const goalsAgainst = Number(cells[7]);
    const goalDiff = Number(cells[8]);
    const points = Number(cells[9]);

    if (!team || Number.isNaN(position)) {
      continue;
    }

    standings.push({
      position,
      team,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDiff,
      points,
    });
  }

  return standings;
};

const parseStandings = (markdown: string): LeagueStanding[] => {
  const lines = markdown
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tableStandings = parseStandingsTable(lines);
  if (tableStandings.length) {
    return tableStandings;
  }

  const regex =
    /\[([^\]]+)\]\(http:\/\/portal\.playfootball\.net\/Leagues\/TeamProfile[^)]+\)([^*\n]+?)\*\*(?:\[(\d+)\][^*]*|(\d+))\*\*/g;
  const standings: LeagueStanding[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const team = formatPlayFootballTeamName(match[1]?.trim() ?? "");
    if (!team) {
      continue;
    }
    const statsPart = match[2] ?? "";
    const points = Number(match[3] ?? match[4] ?? 0);
    const tokens = parseNumberTokens(statsPart);
    const played = tokens[0] ?? 0;
    const won = tokens[1] ?? 0;
    const drawn = tokens[2] ?? 0;
    const lost = tokens[3] ?? 0;
    const goalsFor =
      tokens.length >= 4 ? tokens[tokens.length - 4] : tokens[6] ?? 0;
    const goalsAgainst =
      tokens.length >= 3 ? tokens[tokens.length - 3] : tokens[7] ?? 0;
    const goalDiff =
      tokens.length >= 2
        ? tokens[tokens.length - 2]
        : goalsFor - goalsAgainst;

    standings.push({
      position: standings.length + 1,
      team,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDiff,
      points,
    });
  }

  return standings;
};

const parseFixtureDateTime = (dateLabel: string, time: string) => {
  const ukMatch = dateLabel.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ukMatch) {
    const day = Number(ukMatch[1]);
    const month = Number(ukMatch[2]);
    const year = Number(ukMatch[3]);
    const [hour, minute] = time.split(":").map(Number);
    if ([day, month, year, hour, minute].some(Number.isNaN)) {
      return null;
    }
    return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
  }

  const parsed = Date.parse(`${dateLabel} ${time}`);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
};

const nextNonEmpty = (lines: string[], startIndex: number) => {
  for (let index = startIndex; index < lines.length; index += 1) {
    const value = lines[index]?.trim();
    if (value) {
      return { value, index };
    }
  }
  return null;
};

const parseLoungeFixtures = (lines: string[]) => {
  const fixtures: LeagueFixture[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const dateTimeMatch = line.match(
      /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})$/
    );
    if (!dateTimeMatch) {
      continue;
    }

    const dateLabel = dateTimeMatch[1];
    const time = dateTimeMatch[2];
    const homeLine = nextNonEmpty(lines, index + 1);
    if (!homeLine) {
      continue;
    }

    const firstAfter = nextNonEmpty(lines, homeLine.index + 1);
    if (!firstAfter) {
      continue;
    }

    let awayLine: { value: string; index: number } | null = null;
    let scoreHome: number | null = null;
    let scoreAway: number | null = null;

    const firstValue = firstAfter.value.trim();
    const firstLower = firstValue.toLowerCase();

    if (firstLower === "vs") {
      awayLine = nextNonEmpty(lines, firstAfter.index + 1);
    } else if (scoreTokenRegex.test(firstValue)) {
      const vsLine = nextNonEmpty(lines, firstAfter.index + 1);
      if (vsLine?.value.toLowerCase() === "vs") {
        const scoreAwayLine = nextNonEmpty(lines, vsLine.index + 1);
        awayLine = scoreAwayLine
          ? nextNonEmpty(lines, scoreAwayLine.index + 1)
          : null;
        if (scoreAwayLine && scoreTokenRegex.test(scoreAwayLine.value)) {
          scoreHome = Number(firstValue);
          scoreAway = Number(scoreAwayLine.value);
        }
      } else {
        const scoreMatch = firstValue.match(scoreRegex);
        if (scoreMatch) {
          scoreHome = Number(scoreMatch[1]);
          scoreAway = Number(scoreMatch[2]);
          awayLine = vsLine;
        }
      }
    } else {
      const scoreMatch = firstValue.match(scoreRegex);
      if (scoreMatch) {
        scoreHome = Number(scoreMatch[1]);
        scoreAway = Number(scoreMatch[2]);
        const maybeVs = nextNonEmpty(lines, firstAfter.index + 1);
        if (maybeVs?.value.toLowerCase() === "vs") {
          awayLine = nextNonEmpty(lines, maybeVs.index + 1);
        } else {
          awayLine = maybeVs;
        }
      }
    }

    if (!awayLine) {
      continue;
    }

    const home = homeLine.value;
    const away = awayLine.value;
    const key = `${dateLabel}|${time}|${home}|${away}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    fixtures.push({
      dateLabel,
      time,
      pitch: null,
      home,
      away,
      scoreHome,
      scoreAway,
      kickoffAt: parseFixtureDateTime(dateLabel, time),
    });
  }

  return fixtures;
};

const parseFixtures = (markdown: string): LeagueFixture[] => {
  const lines = markdown
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fixtures: LeagueFixture[] = [];
  const seen = new Set<string>();
  let currentDate: string | null = null;

  for (const line of lines) {
    if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/.test(line)) {
      currentDate = line;
      continue;
    }

    if (!currentDate) {
      continue;
    }

    const match = line.match(
      /^(\d{1,2}:\d{2})\s+([^\[]+)?\[([^\]]+)\]\([^\)]+\)\s*(?:(\d{1,2})\s*[-–]\s*(\d{1,2}))?\s*vs?\s*\[([^\]]+)\]/i
    );
    if (!match) {
      continue;
    }

    const time = match[1];
    const pitch = match[2]?.trim() || null;
    const home = match[3]?.trim();
    const away = match[6]?.trim();
    if (!home || !away) {
      continue;
    }
    const scoreHome = match[4] ? Number(match[4]) : null;
    const scoreAway = match[5] ? Number(match[5]) : null;
    const fallbackScore =
      scoreHome === null || scoreAway === null
        ? extractScoreFromLine(line)
        : { scoreHome, scoreAway };

    const key = `${currentDate}|${time}|${home}|${away}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    fixtures.push({
      dateLabel: currentDate,
      time,
      pitch,
      home,
      away,
      scoreHome: fallbackScore.scoreHome,
      scoreAway: fallbackScore.scoreAway,
      kickoffAt: parseFixtureDateTime(currentDate, time),
    });
  }

  if (fixtures.length) {
    return fixtures;
  }

  return parseLoungeFixtures(lines);
};

const normalizeTeamName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "");

export const normalizePlayFootballTeamName = (value: string) =>
  normalizeTeamName(value);

export const getPlayFootballTeamName = (season?: Season | null) =>
  season?.playfootballTeamName?.trim() || "I think we struck goals here";

export const isPlayFootballTeam = (team: string, season?: Season | null) => {
  return (
    normalizeTeamName(team) ===
    normalizeTeamName(getPlayFootballTeamName(season))
  );
};

export const filterFixturesForTeam = (
  fixtures: LeagueFixture[],
  season?: Season | null
) => {
  const teamName = getPlayFootballTeamName(season);
  const normalizedTeam = normalizeTeamName(teamName);
  return fixtures.filter(
    (fixture) =>
      normalizeTeamName(fixture.home) === normalizedTeam ||
      normalizeTeamName(fixture.away) === normalizedTeam
  );
};

export const getFixtureOpponent = (
  fixture: LeagueFixture,
  season?: Season | null
) => {
  const teamName = getPlayFootballTeamName(season);
  const normalizedTeam = normalizeTeamName(teamName);
  const isHome = normalizeTeamName(fixture.home) === normalizedTeam;
  const isAway = normalizeTeamName(fixture.away) === normalizedTeam;

  if (isHome) {
    return { opponent: fixture.away, venueLabel: "Home" };
  }
  if (isAway) {
    return { opponent: fixture.home, venueLabel: "Away" };
  }

  return { opponent: `${fixture.home} vs ${fixture.away}`, venueLabel: "" };
};

export type TeamResult = {
  opponent: string;
  outcome: "W" | "D" | "L";
  scored: number;
  conceded: number;
  kickoffAt: string | null;
};

export const getTeamAverages = (results: TeamResult[]) => {
  if (!results.length) {
    return null;
  }
  const totals = results.reduce(
    (acc, result) => {
      acc.scored += result.scored;
      acc.conceded += result.conceded;
      return acc;
    },
    { scored: 0, conceded: 0 }
  );
  const games = results.length;
  return {
    scoredPerGame: totals.scored / games,
    concededPerGame: totals.conceded / games,
    games,
  };
};

export type TeamElo = {
  rating: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
};

type ResultsOptions = {
  activeTeams?: string[];
  ignoredTeams?: string[];
  forfeitTeam?: string;
  forfeitScore?: [number, number];
};

const createTeamFilter = (options: ResultsOptions = {}) => {
  const activeSet = options.activeTeams
    ? new Set(options.activeTeams.map(normalizeTeamName))
    : null;
  const ignoredSet = options.ignoredTeams
    ? new Set(options.ignoredTeams.map(normalizeTeamName))
    : null;
  const forfeitNorm = options.forfeitTeam
    ? normalizeTeamName(options.forfeitTeam)
    : null;
  const forfeitScore = options.forfeitScore ?? [8, 0];

  return (fixture: LeagueFixture) => {
    if (fixture.scoreHome === null || fixture.scoreAway === null) {
      return false;
    }
    const homeNorm = normalizeTeamName(fixture.home);
    const awayNorm = normalizeTeamName(fixture.away);

    if (activeSet && (!activeSet.has(homeNorm) || !activeSet.has(awayNorm))) {
      return false;
    }
    if (ignoredSet && (ignoredSet.has(homeNorm) || ignoredSet.has(awayNorm))) {
      return false;
    }
    if (forfeitNorm && (homeNorm === forfeitNorm || awayNorm === forfeitNorm)) {
      const [forfeitHome, forfeitAway] = forfeitScore;
      const isForfeit =
        (fixture.scoreHome === forfeitHome &&
          fixture.scoreAway === forfeitAway) ||
        (fixture.scoreHome === forfeitAway &&
          fixture.scoreAway === forfeitHome);
      if (isForfeit) {
        return false;
      }
    }
    return true;
  };
};

const getKickoffMs = (fixture: LeagueFixture) => {
  if (!fixture.kickoffAt) {
    return null;
  }
  const parsed = Date.parse(fixture.kickoffAt);
  return Number.isNaN(parsed) ? null : parsed;
};

export const buildTeamResults = (
  fixtures: LeagueFixture[],
  options: ResultsOptions = {}
) => {
  const includeFixture = createTeamFilter(options);
  const resultsByTeam = new Map<string, TeamResult[]>();

  for (const fixture of fixtures) {
    if (!includeFixture(fixture)) {
      continue;
    }
    const homeNorm = normalizeTeamName(fixture.home);
    const awayNorm = normalizeTeamName(fixture.away);
    const homeScore = fixture.scoreHome ?? 0;
    const awayScore = fixture.scoreAway ?? 0;
    const outcomeHome =
      homeScore > awayScore ? "W" : homeScore < awayScore ? "L" : "D";
    const outcomeAway =
      homeScore > awayScore ? "L" : homeScore < awayScore ? "W" : "D";

    const homeResults = resultsByTeam.get(homeNorm) ?? [];
    homeResults.push({
      opponent: formatPlayFootballTeamName(fixture.away),
      outcome: outcomeHome,
      scored: homeScore,
      conceded: awayScore,
      kickoffAt: fixture.kickoffAt,
    });
    resultsByTeam.set(homeNorm, homeResults);

    const awayResults = resultsByTeam.get(awayNorm) ?? [];
    awayResults.push({
      opponent: formatPlayFootballTeamName(fixture.home),
      outcome: outcomeAway,
      scored: awayScore,
      conceded: homeScore,
      kickoffAt: fixture.kickoffAt,
    });
    resultsByTeam.set(awayNorm, awayResults);
  }

  for (const [team, results] of resultsByTeam.entries()) {
    results.sort((a, b) => {
      const aMs = a.kickoffAt ? Date.parse(a.kickoffAt) : 0;
      const bMs = b.kickoffAt ? Date.parse(b.kickoffAt) : 0;
      return bMs - aMs;
    });
    resultsByTeam.set(team, results);
  }

  return resultsByTeam;
};

export const computeTeamElo = (
  fixtures: LeagueFixture[],
  options: ResultsOptions = {}
) => {
  const includeFixture = createTeamFilter(options);
  const ratings = new Map<string, TeamElo>();

  const completed = fixtures
    .filter(includeFixture)
    .slice()
    .sort((a, b) => {
      const aMs = getKickoffMs(a) ?? 0;
      const bMs = getKickoffMs(b) ?? 0;
      return aMs - bMs;
    });

  const ensureTeam = (name: string) => {
    const normalized = normalizeTeamName(name);
    if (!ratings.has(normalized)) {
      ratings.set(normalized, {
        rating: 1000,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      });
    }
    return ratings.get(normalized)!;
  };

  for (const fixture of completed) {
    const home = ensureTeam(fixture.home);
    const away = ensureTeam(fixture.away);

    const homeScore = fixture.scoreHome ?? 0;
    const awayScore = fixture.scoreAway ?? 0;
    const diff = Math.abs(homeScore - awayScore);
    const margin = diff <= 1 ? 1 : 1 + Math.min(3, diff - 1) * 0.25;
    const expectedHome =
      1 / (1 + Math.pow(10, (away.rating - home.rating) / 400));
    const actualHome =
      homeScore > awayScore ? 1 : homeScore < awayScore ? 0 : 0.5;
    const kFactor = 20;
    const delta = kFactor * margin * (actualHome - expectedHome);

    home.rating += delta;
    away.rating -= delta;
    home.games += 1;
    away.games += 1;

    if (actualHome === 1) {
      home.wins += 1;
      away.losses += 1;
    } else if (actualHome === 0) {
      home.losses += 1;
      away.wins += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
    }
  }

  return ratings;
};

const normalizeSnapshot = (
  snapshot: ExternalLeagueSnapshot
): PlayFootballSnapshot => {
  const payload = snapshot.payloadJson as Partial<PlayFootballSnapshot>;
  return {
    fixtures: (payload.fixtures ?? []).map((fixture) => ({
      ...fixture,
      scoreHome: fixture.scoreHome ?? null,
      scoreAway: fixture.scoreAway ?? null,
    })),
    standings: payload.standings ?? [],
    fetchedAt: snapshot.fetchedAt.toISOString(),
  };
};

const getFixtureMergeKey = (fixture: LeagueFixture) => {
  const teams = [fixture.home, fixture.away]
    .map((team) => normalizeTeamName(team))
    .sort()
    .join("|");
  const kickoff = fixture.kickoffAt ?? `${fixture.dateLabel}|${fixture.time}`;
  return `${teams}|${kickoff}`;
};

const mergeFixtures = (
  fixtures: LeagueFixture[],
  results: LeagueFixture[]
) => {
  const merged = new Map<string, LeagueFixture>();

  for (const fixture of fixtures) {
    merged.set(getFixtureMergeKey(fixture), fixture);
  }

  for (const fixture of results) {
    const key = getFixtureMergeKey(fixture);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, fixture);
      continue;
    }

    merged.set(key, {
      ...existing,
      ...fixture,
      scoreHome: fixture.scoreHome ?? existing.scoreHome,
      scoreAway: fixture.scoreAway ?? existing.scoreAway,
      pitch: fixture.pitch ?? existing.pitch,
      kickoffAt: fixture.kickoffAt ?? existing.kickoffAt,
    });
  }

  return Array.from(merged.values());
};

const upsertPlayFootballFixtureLog = async (
  season: Season,
  fixtures: LeagueFixture[]
) => {
  if (!fixtures.length) {
    return;
  }

  const now = new Date();
  const rows = fixtures.map((fixture) => ({
    seasonId: season.id,
    fixtureKey: getFixtureMergeKey(fixture),
    kickoffAt:
      fixture.kickoffAt && !Number.isNaN(Date.parse(fixture.kickoffAt))
        ? new Date(fixture.kickoffAt)
        : null,
    dateLabel: fixture.dateLabel,
    time: fixture.time,
    pitch: fixture.pitch,
    home: fixture.home,
    away: fixture.away,
    scoreHome: fixture.scoreHome,
    scoreAway: fixture.scoreAway,
    updatedAt: now,
    lastSeenAt: now,
  }));

  await db
    .insert(playfootballFixturesLog)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        playfootballFixturesLog.seasonId,
        playfootballFixturesLog.fixtureKey,
      ],
      set: {
        kickoffAt: sql`excluded.kickoff_at`,
        dateLabel: sql`excluded.date_label`,
        time: sql`excluded.time`,
        pitch: sql`excluded.pitch`,
        home: sql`excluded.home`,
        away: sql`excluded.away`,
        scoreHome: sql`excluded.score_home`,
        scoreAway: sql`excluded.score_away`,
        updatedAt: now,
        lastSeenAt: now,
      },
    });
};

const getSourceUrls = (season: Season) => {
  const fixturesUrl = season.sourceUrlFixtures?.trim() || null;
  const resultsUrl = season.sourceUrlResults?.trim() || null;
  const standingsUrl = season.sourceUrlStandings?.trim() || null;
  return { fixturesUrl, resultsUrl, standingsUrl };
};

export const getPlayFootballSnapshot = async (
  season: Season,
  options: { force?: boolean } = {}
): Promise<PlayFootballSnapshot | null> => {
  const { fixturesUrl, resultsUrl, standingsUrl } = getSourceUrls(season);
  if (!fixturesUrl && !resultsUrl && !standingsUrl) {
    return null;
  }

  const [latest] = await db
    .select()
    .from(externalLeagueSnapshots)
    .where(eq(externalLeagueSnapshots.seasonId, season.id))
    .orderBy(desc(externalLeagueSnapshots.fetchedAt))
    .limit(1);

  if (latest && latest.status === "ok" && !options.force) {
    const ageMs = Date.now() - latest.fetchedAt.getTime();
    if (ageMs < SNAPSHOT_TTL_MS) {
      return normalizeSnapshot(latest);
    }
  }

  try {
    const [fixturesMarkdown, resultsMarkdown, standingsMarkdown] =
      await Promise.all([
        fixturesUrl ? fetchMarkdown(fixturesUrl) : Promise.resolve(""),
        resultsUrl ? fetchMarkdown(resultsUrl) : Promise.resolve(""),
        standingsUrl ? fetchMarkdown(standingsUrl) : Promise.resolve(""),
      ]);

    const fixtures = fixturesUrl ? parseFixtures(fixturesMarkdown) : [];
    const results = resultsUrl ? parseFixtures(resultsMarkdown) : [];

    const payload: PlayFootballSnapshot = {
      fixtures: mergeFixtures(fixtures, results),
      standings: standingsUrl ? parseStandings(standingsMarkdown) : [],
      fetchedAt: new Date().toISOString(),
    };

    if (payload.fixtures.length) {
      try {
        await upsertPlayFootballFixtureLog(season, payload.fixtures);
      } catch (logError) {
        console.error("PlayFootball log update failed", logError);
      }
    }

    const [created] = await db
      .insert(externalLeagueSnapshots)
      .values({
        seasonId: season.id,
        fetchedAt: new Date(),
        source: "playfootball",
        payloadJson: payload,
        status: "ok",
      })
      .returning();

    return created ? normalizeSnapshot(created) : payload;
  } catch (error) {
    if (latest) {
      return normalizeSnapshot(latest);
    }

    const message =
      error instanceof Error ? error.message : "PlayFootball sync failed";
    await db.insert(externalLeagueSnapshots).values({
      seasonId: season.id,
      fetchedAt: new Date(),
      source: "playfootball",
      payloadJson: {
        fixtures: [],
        standings: [],
        fetchedAt: new Date().toISOString(),
      },
      status: "error",
      statusMessage: message,
    });
    return null;
  }
};

export const getNextFixtureForTeam = (
  fixtures: LeagueFixture[],
  teamName = getPlayFootballTeamName()
) => {
  const normalizedTeam = normalizeTeamName(teamName);
  const relevant = fixtures.filter((fixture) => {
    return (
      normalizeTeamName(fixture.home) === normalizedTeam ||
      normalizeTeamName(fixture.away) === normalizedTeam
    );
  });

  const withDates = relevant
    .map((fixture) => ({
      ...fixture,
      kickoff:
        fixture.kickoffAt && !Number.isNaN(Date.parse(fixture.kickoffAt))
          ? new Date(fixture.kickoffAt)
          : null,
    }))
    .filter((fixture) => fixture.kickoff);

  withDates.sort(
    (a, b) => (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0)
  );

  const now = Date.now();
  return (
    withDates.find((fixture) => (fixture.kickoff?.getTime() ?? 0) >= now) ??
    withDates[0] ??
    null
  );
};

export const getMostRecentFixtureForTeam = (
  fixtures: LeagueFixture[],
  teamName = getPlayFootballTeamName(),
  options: { graceMs?: number } = {}
) => {
  const normalizedTeam = normalizeTeamName(teamName);
  const relevant = fixtures.filter((fixture) => {
    return (
      normalizeTeamName(fixture.home) === normalizedTeam ||
      normalizeTeamName(fixture.away) === normalizedTeam
    );
  });

  const withDates = relevant
    .map((fixture) => ({
      ...fixture,
      kickoff:
        fixture.kickoffAt && !Number.isNaN(Date.parse(fixture.kickoffAt))
          ? new Date(fixture.kickoffAt)
          : null,
    }))
    .filter((fixture) => fixture.kickoff);

  withDates.sort(
    (a, b) => (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0)
  );

  const now = Date.now();
  const graceMs = options.graceMs ?? 12 * 60 * 60 * 1000;
  const cutoff = now + graceMs;

  const eligible = withDates.filter(
    (fixture) => (fixture.kickoff?.getTime() ?? 0) <= cutoff
  );
  const past = eligible.filter(
    (fixture) => (fixture.kickoff?.getTime() ?? 0) <= now
  );

  return past[past.length - 1] ?? eligible[eligible.length - 1] ?? withDates[0] ?? null;
};

export const refreshPlayFootballSnapshot = async (season: Season) => {
  return getPlayFootballSnapshot(season, { force: true });
};

export const formatDateTimeLocal = (isoString: string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
