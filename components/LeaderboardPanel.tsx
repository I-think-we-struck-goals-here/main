"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { formatSignedGbp } from "@/lib/money";
import type { PlayerStats } from "@/lib/stats";

type MetricKey = "goals" | "assists" | "games" | "owed";

const METRIC_LABEL: Record<MetricKey, string> = {
  goals: "Goals scored",
  assists: "Assists",
  games: "Games played",
  owed: "Money owed",
};

const METRIC_TABS: Record<MetricKey, string> = {
  goals: "Goals",
  assists: "Assists",
  games: "Games played",
  owed: "Money owed",
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

const normalizeTabs = (tabs: MetricKey[]) => {
  const seen = new Set<MetricKey>();
  return tabs.filter((tab) => {
    if (seen.has(tab)) {
      return false;
    }
    seen.add(tab);
    return true;
  });
};

export default function LeaderboardPanel({
  rows,
  tabs,
  defaultMetric = "goals",
}: {
  rows: PlayerStats[];
  tabs: MetricKey[];
  defaultMetric?: MetricKey;
}) {
  const availableTabs = normalizeTabs(tabs);
  const initialMetric = availableTabs.includes(defaultMetric)
    ? defaultMetric
    : availableTabs[0] ?? "goals";
  const [metric, setMetric] = useState<MetricKey>(initialMetric);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const diff = metricValue(b, metric) - metricValue(a, metric);
      if (diff !== 0) {
        return diff;
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }, [rows, metric]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMetric(tab)}
            className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] ${
              metric === tab
                ? "bg-black text-white"
                : "border border-black/10 text-black/60 hover:border-black/30"
            }`}
          >
            {METRIC_TABS[tab]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/80 shadow-sm">
        <div className="grid grid-cols-[1fr_140px] items-center border-b border-black/10 bg-black/5 px-4 py-3 text-xs uppercase tracking-[0.3em] text-black/60">
          <span>Player</span>
          <span className="text-right">{METRIC_LABEL[metric]}</span>
        </div>
        <div className="max-h-[520px] overflow-auto">
          {sorted.map((row, index) => (
            <Link
              key={row.playerId}
              href={`/player/${row.handle}`}
              className="grid grid-cols-[1fr_140px] items-center gap-3 border-b border-black/5 px-4 py-3 text-sm text-black/80 transition hover:bg-black/[0.03]"
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
    </div>
  );
}
