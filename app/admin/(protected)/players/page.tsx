import { db } from "@/db";
import { players } from "@/db/schema";

import { createPlayer, updatePlayer } from "./actions";

export const dynamic = "force-dynamic";

type AdminPlayersPageProps = {
  searchParams?: { error?: string };
};

const ERROR_COPY: Record<string, string> = {
  missing: "Add a player name before saving.",
  duplicate: "That name already exists.",
};

export default async function AdminPlayersPage({
  searchParams,
}: AdminPlayersPageProps) {
  const error = searchParams?.error
    ? ERROR_COPY[searchParams.error]
    : undefined;
  const playerRows = await db
    .select()
    .from(players)
    .orderBy(players.displayName);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Add player</h2>
        <p className="text-sm text-white/60">
          Fast-create a player profile for match logging and leaderboards.
        </p>
        {error ? (
          <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-2 text-xs uppercase tracking-wide text-amber-100">
            {error}
          </div>
        ) : null}
        <form
          action={createPlayer}
          className="mt-4 grid gap-3 md:grid-cols-3"
        >
          <input
            name="displayName"
            placeholder="Display name"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              name="isActive"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-white/20 bg-white/10"
            />
            Active
          </label>
          <button className="rounded-2xl bg-lime-300 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-900">
            Create player
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Roster</h2>
        <div className="mt-4 flex flex-col gap-4">
          {playerRows.map((player) => (
            <form
              key={player.id}
              action={updatePlayer}
              className="grid items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 md:grid-cols-4"
            >
              <input type="hidden" name="playerId" value={player.id} />
              <input
                name="displayName"
                defaultValue={player.displayName}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={player.isActive}
                  className="h-4 w-4 rounded border-white/20 bg-white/10"
                />
                Active
              </label>
              <button className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:border-white/30 hover:text-white">
                Save
              </button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
