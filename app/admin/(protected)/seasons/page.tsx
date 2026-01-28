import { desc } from "drizzle-orm";

import { db } from "@/db";
import { seasons } from "@/db/schema";

export const dynamic = "force-dynamic";

type AdminSeasonsPageProps = {
  searchParams?: { error?: string; sync?: string; updated?: string };
};

const ERROR_COPY: Record<string, string> = {
  missing: "Add a name and slug before saving.",
  duplicate: "That season slug is already in use.",
};

const SYNC_COPY: Record<string, string> = {
  updated: "PlayFootball settings saved.",
  refreshed: "PlayFootball snapshot refreshed.",
};

const UPDATED_COPY: Record<string, string> = {
  details: "Season details saved.",
};

export default async function AdminSeasonsPage({
  searchParams,
}: AdminSeasonsPageProps) {
  const error = searchParams?.error
    ? ERROR_COPY[searchParams.error]
    : undefined;
  const syncMessage = searchParams?.sync
    ? SYNC_COPY[searchParams.sync]
    : undefined;
  const updateMessage = searchParams?.updated
    ? UPDATED_COPY[searchParams.updated]
    : undefined;
  const seasonRows = await db
    .select()
    .from(seasons)
    .orderBy(desc(seasons.isActive), desc(seasons.startDate));

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Create season</h2>
        {error ? (
          <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-2 text-xs uppercase tracking-wide text-amber-100">
            {error}
          </div>
        ) : null}
        {syncMessage ? (
          <div className="mt-4 rounded-2xl border border-lime-300/40 bg-lime-400/10 px-4 py-2 text-xs uppercase tracking-wide text-lime-100">
            {syncMessage}
          </div>
        ) : null}
        {updateMessage ? (
          <div className="mt-4 rounded-2xl border border-sky-300/40 bg-sky-400/10 px-4 py-2 text-xs uppercase tracking-wide text-sky-100">
            {updateMessage}
          </div>
        ) : null}
        <form
          action="/admin/seasons/submit"
          method="post"
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          <input type="hidden" name="intent" value="create" />
          <input
            name="name"
            placeholder="Season name"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm"
          />
          <input
            name="slug"
            placeholder="Slug (winter-25-26)"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm"
          />
          <input
            name="startDate"
            type="date"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm"
          />
          <input
            name="endDate"
            type="date"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              name="isActive"
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-white/10"
            />
            Set active
          </label>
          <input
            name="playfootballTeamName"
            placeholder="PlayFootball team name"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm md:col-span-2"
          />
          <input
            name="sourceUrlStandings"
            placeholder="PlayFootball standings URL"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm md:col-span-2"
          />
          <input
            name="sourceUrlFixtures"
            placeholder="PlayFootball fixtures URL"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm md:col-span-2"
          />
          <input
            name="sourceUrlResults"
            placeholder="PlayFootball results URL (players lounge)"
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm md:col-span-2"
          />
          <button className="rounded-2xl bg-lime-300 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-900 md:col-span-2">
            Create season
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Seasons</h2>
        <div className="mt-4 flex flex-col gap-4">
          {seasonRows.map((season) => (
            <div
              key={season.id}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4"
            >
              <form
                action="/admin/seasons/submit"
                method="post"
                className="flex flex-wrap items-center justify-between gap-4"
              >
                <input type="hidden" name="intent" value="activate" />
                <input type="hidden" name="seasonId" value={season.id} />
                <div>
                  <p className="text-base font-semibold">{season.name}</p>
                  <p className="text-xs text-white/60">{season.slug}</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/70">
                  {season.isActive ? (
                    <span className="rounded-full bg-lime-300/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-lime-200">
                      Active
                    </span>
                  ) : null}
                  <button className="rounded-xl border border-white/10 px-3 py-2 text-xs uppercase tracking-wide hover:border-white/30">
                    Set active
                  </button>
                </div>
              </form>
              <form
                action="/admin/seasons/submit"
                method="post"
                className="grid gap-3 md:grid-cols-2"
              >
                <input type="hidden" name="intent" value="update_details" />
                <input type="hidden" name="seasonId" value={season.id} />
                <input
                  name="name"
                  defaultValue={season.name}
                  placeholder="Season name"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm md:col-span-2"
                />
                <input
                  name="startDate"
                  type="date"
                  defaultValue={season.startDate ?? ""}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm"
                />
                <input
                  name="endDate"
                  type="date"
                  defaultValue={season.endDate ?? ""}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm"
                />
                <button className="rounded-xl border border-white/10 px-3 py-2 text-xs uppercase tracking-wide text-white/80 hover:border-white/30 hover:text-white md:col-span-2">
                  Save season details
                </button>
              </form>
              <form
                action="/admin/seasons/submit"
                method="post"
                className="grid gap-3 md:grid-cols-2"
              >
                <input type="hidden" name="intent" value="update_playfootball" />
                <input type="hidden" name="seasonId" value={season.id} />
                <input
                  name="playfootballTeamName"
                  defaultValue={season.playfootballTeamName ?? ""}
                  placeholder="PlayFootball team name"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm md:col-span-2"
                />
                <input
                  name="sourceUrlStandings"
                  defaultValue={season.sourceUrlStandings ?? ""}
                  placeholder="PlayFootball standings URL"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm md:col-span-2"
                />
                <input
                  name="sourceUrlFixtures"
                  defaultValue={season.sourceUrlFixtures ?? ""}
                  placeholder="PlayFootball fixtures URL"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm md:col-span-2"
                />
                <input
                  name="sourceUrlResults"
                  defaultValue={season.sourceUrlResults ?? ""}
                  placeholder="PlayFootball results URL (players lounge)"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm md:col-span-2"
                />
                <button className="rounded-xl border border-white/10 px-3 py-2 text-xs uppercase tracking-wide text-white/80 hover:border-white/30 hover:text-white md:col-span-2">
                  Save PlayFootball settings
                </button>
              </form>
              <form action="/admin/seasons/submit" method="post">
                <input type="hidden" name="intent" value="refresh_playfootball" />
                <input type="hidden" name="seasonId" value={season.id} />
                <button className="rounded-xl border border-lime-300/40 px-3 py-2 text-xs uppercase tracking-wide text-lime-200 hover:border-lime-200">
                  Refresh PlayFootball now
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
