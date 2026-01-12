import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { externalLeagueSnapshots } from "@/db/schema";
import type { ExternalLeagueSnapshot, Season } from "@/db/types";

const JINA_BASE_URL = "https://r.jina.ai/http://";
const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;

export type LeagueFixture = {
  dateLabel: string;
  time: string;
  pitch: string | null;
  home: string;
  away: string;
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
    const team = cells[1];
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
    const team = match[1]?.trim();
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
    const vsLine = homeLine ? nextNonEmpty(lines, homeLine.index + 1) : null;
    const awayLine = vsLine ? nextNonEmpty(lines, vsLine.index + 1) : null;

    if (!homeLine || !vsLine || !awayLine) {
      continue;
    }

    if (vsLine.value.toLowerCase() !== "vs") {
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
      /^(\d{1,2}:\d{2})\s+([^\[]+)?\[([^\]]+)\]\([^\)]+\)\s*vs?\s*\[([^\]]+)\]/i
    );
    if (!match) {
      continue;
    }

    const time = match[1];
    const pitch = match[2]?.trim() || null;
    const home = match[3]?.trim();
    const away = match[4]?.trim();
    if (!home || !away) {
      continue;
    }

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

export const getPlayFootballTeamName = (season?: Season | null) =>
  season?.playfootballTeamName?.trim() || "I think we struck goals here";

export const isPlayFootballTeam = (team: string, season?: Season | null) => {
  return (
    normalizeTeamName(team) ===
    normalizeTeamName(getPlayFootballTeamName(season))
  );
};

const normalizeSnapshot = (
  snapshot: ExternalLeagueSnapshot
): PlayFootballSnapshot => {
  const payload = snapshot.payloadJson as Partial<PlayFootballSnapshot>;
  return {
    fixtures: payload.fixtures ?? [],
    standings: payload.standings ?? [],
    fetchedAt: snapshot.fetchedAt.toISOString(),
  };
};

const getSourceUrls = (season: Season) => {
  const fixturesUrl = season.sourceUrlFixtures?.trim() || null;
  const standingsUrl = season.sourceUrlStandings?.trim() || null;
  return { fixturesUrl, standingsUrl };
};

export const getPlayFootballSnapshot = async (
  season: Season,
  options: { force?: boolean } = {}
): Promise<PlayFootballSnapshot | null> => {
  const { fixturesUrl, standingsUrl } = getSourceUrls(season);
  if (!fixturesUrl && !standingsUrl) {
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
    const [fixturesMarkdown, standingsMarkdown] = await Promise.all([
      fixturesUrl ? fetchMarkdown(fixturesUrl) : Promise.resolve(""),
      standingsUrl ? fetchMarkdown(standingsUrl) : Promise.resolve(""),
    ]);

    const payload: PlayFootballSnapshot = {
      fixtures: fixturesUrl ? parseFixtures(fixturesMarkdown) : [],
      standings: standingsUrl ? parseStandings(standingsMarkdown) : [],
      fetchedAt: new Date().toISOString(),
    };

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
