import LeaderboardTable from "@/components/LeaderboardTable";
import LeaderboardTabs from "@/components/LeaderboardTabs";
import { getAllTimeLeaderboard } from "@/lib/stats";

export const dynamic = "force-dynamic";

type AllTimePageProps = {
  searchParams?: { tab?: string };
};

const parseMetric = (value?: string) => {
  if (value === "assists" || value === "games" || value === "owed") {
    return value;
  }
  return "goals";
};

export default async function AllTimePage({ searchParams }: AllTimePageProps) {
  const leaderboard = await getAllTimeLeaderboard();
  const metric = parseMetric(searchParams?.tab);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          All-time
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-black">
          Lifetime leaderboard
        </h1>
        <p className="mt-2 text-sm text-black/60">
          Totals across every season you have logged.
        </p>
        <div className="mt-4">
          <LeaderboardTabs baseHref="/all-time" active={metric} />
        </div>
      </section>

      <LeaderboardTable rows={leaderboard} metric={metric} />
    </div>
  );
}
