import { notFound } from "next/navigation";

import LeaderboardTable from "@/components/LeaderboardTable";
import LeaderboardTabs from "@/components/LeaderboardTabs";
import { getSeasonBySlug, getSeasonLeaderboard } from "@/lib/stats";

export const dynamic = "force-dynamic";

type SeasonPageProps = {
  params: { seasonSlug: string };
  searchParams?: { tab?: string };
};

const parseMetric = (value?: string) => {
  if (value === "assists" || value === "games" || value === "owed") {
    return value;
  }
  return "goals";
};

export default async function SeasonPage({
  params,
  searchParams,
}: SeasonPageProps) {
  const season = await getSeasonBySlug(params.seasonSlug);
  if (!season) {
    notFound();
  }

  const leaderboard = await getSeasonLeaderboard(season.id);
  const metric = parseMetric(searchParams?.tab);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          Season leaderboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-black">
          {season.name}
        </h1>
        <p className="mt-2 text-sm text-black/60">
          Choose a tab to sort the leaderboard.
        </p>
        <div className="mt-4">
          <LeaderboardTabs
            baseHref={`/season/${season.slug}`}
            active={metric}
          />
        </div>
      </section>

      <LeaderboardTable rows={leaderboard} metric={metric} />
    </div>
  );
}
