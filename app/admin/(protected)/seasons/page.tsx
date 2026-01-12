import { desc } from "drizzle-orm";

import { db } from "@/db";
import { seasons } from "@/db/schema";

export const dynamic = "force-dynamic";

type AdminSeasonsPageProps = {
  searchParams?: { error?: string };
};

const ERROR_COPY: Record<string, string> = {
  missing: "Add a name and slug before saving.",
  duplicate: "That season slug is already in use.",
};

export default async function AdminSeasonsPage({
  searchParams,
}: AdminSeasonsPageProps) {
  const error = searchParams?.error
    ? ERROR_COPY[searchParams.error]
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
        <form
          action="/admin/seasons/submit"
          method="post"
          className="mt-4 grid gap-3 md:grid-cols-5"
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
          <button className="rounded-2xl bg-lime-300 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-900">
            Create season
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Seasons</h2>
        <div className="mt-4 flex flex-col gap-4">
          {seasonRows.map((season) => (
            <form
              key={season.id}
              action="/admin/seasons/submit"
              method="post"
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3"
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
          ))}
        </div>
      </section>
    </div>
  );
}
