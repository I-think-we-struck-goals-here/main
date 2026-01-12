import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { matches, seasons } from "@/db/schema";

export const dynamic = "force-dynamic";

type AdminMatchesPageProps = {
  searchParams?: { created?: string; updated?: string; deleted?: string; error?: string };
};

const STATUS_COPY: Record<string, string> = {
  created: "Match saved.",
  updated: "Match updated.",
  deleted: "Match deleted.",
};

const ERROR_COPY: Record<string, string> = {
  missing: "Select a match to edit or delete.",
  not_found: "Match not found.",
};

export default async function AdminMatchesPage({
  searchParams,
}: AdminMatchesPageProps) {
  const statusKey = searchParams?.created
    ? "created"
    : searchParams?.updated
      ? "updated"
      : searchParams?.deleted
        ? "deleted"
        : null;
  const statusMessage = statusKey ? STATUS_COPY[statusKey] : undefined;
  const errorMessage = searchParams?.error
    ? ERROR_COPY[searchParams.error]
    : undefined;

  const matchRows = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      opponent: matches.opponent,
      goalsFor: matches.goalsFor,
      goalsAgainst: matches.goalsAgainst,
      venue: matches.venue,
      seasonId: seasons.id,
      seasonName: seasons.name,
      seasonSlug: seasons.slug,
    })
    .from(matches)
    .innerJoin(seasons, eq(matches.seasonId, seasons.id))
    .orderBy(desc(matches.playedAt));

  const matchesBySeason = new Map<
    number,
    {
      seasonId: number;
      seasonName: string;
      seasonSlug: string;
      matches: typeof matchRows;
    }
  >();

  for (const match of matchRows) {
    const existing = matchesBySeason.get(match.seasonId);
    if (existing) {
      existing.matches.push(match);
      continue;
    }
    matchesBySeason.set(match.seasonId, {
      seasonId: match.seasonId,
      seasonName: match.seasonName,
      seasonSlug: match.seasonSlug,
      matches: [match],
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Match log</h2>
            <p className="text-sm text-white/60">
              Review, edit, or delete logged fixtures.
            </p>
          </div>
          <Link
            href="/admin/matches/new"
            className="rounded-2xl bg-lime-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900"
          >
            Log match
          </Link>
        </div>
        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs uppercase tracking-wide text-rose-100">
            {errorMessage}
          </div>
        ) : null}
        {statusMessage ? (
          <div className="mt-4 rounded-2xl border border-lime-300/40 bg-lime-400/10 px-4 py-3 text-xs uppercase tracking-wide text-lime-100">
            {statusMessage}
          </div>
        ) : null}
      </section>

      {matchRows.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/60">No matches logged yet.</p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {[...matchesBySeason.values()].map((group) => (
            <section
              key={group.seasonId}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{group.seasonName}</h3>
                  <p className="text-xs text-white/50">{group.seasonSlug}</p>
                </div>
                <Link
                  href={`/season/${group.seasonSlug}`}
                  className="text-xs uppercase tracking-wide text-white/60 hover:text-white"
                >
                  View season page
                </Link>
              </div>
              <div className="mt-4 grid gap-3">
                {group.matches.map((match) => {
                  const playedAt = new Date(match.playedAt).toLocaleString(
                    "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  );
                  const venue = match.venue ? ` · ${match.venue}` : "";
                  return (
                    <div
                      key={match.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {match.opponent}
                        </p>
                        <p className="text-xs text-white/60">
                          {playedAt}
                          {venue} · {match.goalsFor}-{match.goalsAgainst}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                        <Link
                          href={`/admin/matches/${match.id}`}
                          className="rounded-xl border border-white/10 px-3 py-2 hover:border-white/30 hover:text-white"
                        >
                          Edit
                        </Link>
                        <form action="/admin/matches/delete" method="post">
                          <input type="hidden" name="matchId" value={match.id} />
                          <button className="rounded-xl border border-rose-300/40 px-3 py-2 text-rose-200 hover:border-rose-200">
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
