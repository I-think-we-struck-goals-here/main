import Link from "next/link";

import { formatSignedGbp } from "@/lib/money";
import type { PlayerStats } from "@/lib/stats";

type MetricKey = "goals" | "assists" | "games" | "owed";

const METRIC_LABEL: Record<MetricKey, string> = {
  goals: "Goals",
  assists: "Assists",
  games: "Games",
  owed: "Owed",
};

const metricValue = (row: PlayerStats, metric: MetricKey) => {
  switch (metric) {
    case "goals":
      return row.goals;
    case "assists":
      return row.assists;
    case "games":
      return row.gamesPlayed;
    case "owed":
      return row.owedPence;
    default:
      return 0;
  }
};

export default function LeaderboardTable({
  rows,
  metric,
}: {
  rows: PlayerStats[];
  metric: MetricKey;
}) {
  const sorted = [...rows].sort((a, b) => {
    const diff = metricValue(b, metric) - metricValue(a, metric);
    if (diff !== 0) {
      return diff;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return (
    <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/80 shadow-sm">
      <div className="grid grid-cols-[1fr_100px] items-center border-b border-black/10 bg-black/5 px-4 py-3 text-xs uppercase tracking-[0.3em] text-black/60">
        <span>Player</span>
        <span className="text-right">{METRIC_LABEL[metric]}</span>
      </div>
      <div className="max-h-[520px] overflow-auto">
        {sorted.map((row, index) => (
          <Link
            key={row.playerId}
            href={`/player/${row.handle}`}
            className="grid grid-cols-[1fr_100px] items-center gap-3 border-b border-black/5 px-4 py-3 text-sm text-black/80 transition hover:bg-black/[0.03]"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-black/40">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col">
                <span className="font-semibold text-black">
                  {row.displayName}
                </span>
              </div>
            </div>
            <span className="text-right font-semibold text-black">
              {metric === "owed"
                ? formatSignedGbp(row.owedPence)
                : metricValue(row, metric)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
