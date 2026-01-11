import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { externalLeagueSnapshots } from "@/db/schema";
import { getActiveSeason } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function LeaguePage() {
  const activeSeason = await getActiveSeason();

  if (!activeSeason) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">League data unavailable</h1>
        <p className="mt-2 text-sm text-black/60">
          Create a season first, then enable PlayFootball syncing.
        </p>
      </section>
    );
  }

  const [snapshot] = await db
    .select()
    .from(externalLeagueSnapshots)
    .where(eq(externalLeagueSnapshots.seasonId, activeSeason.id))
    .orderBy(desc(externalLeagueSnapshots.fetchedAt))
    .limit(1);

  if (!snapshot) {
    return (
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          League
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-black">
          No cached snapshot
        </h1>
        <p className="mt-2 text-sm text-black/60">
          When PlayFootball syncing is enabled, fixtures and standings will show
          here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-black/40">
        League
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-black">
        Latest snapshot
      </h1>
      <p className="mt-2 text-sm text-black/60">
        Last updated: {snapshot.fetchedAt.toISOString()}
      </p>
      <pre className="mt-4 max-h-[420px] overflow-auto rounded-2xl bg-black/5 p-4 text-xs text-black/70">
        {JSON.stringify(snapshot.payloadJson, null, 2)}
      </pre>
      <p className="mt-4 text-xs text-black/50">
        Data from PlayFootball (cached).
      </p>
    </section>
  );
}
