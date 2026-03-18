"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { PlayerStats } from "@/lib/stats";

type SortKey =
  | "displayName"
  | "gamesPlayed"
  | "goals"
  | "assists"
  | "goalContributions"
  | "goalsPerGame"
  | "assistsPerGame"
  | "goalContributionsPerGame"
  | "contributionRate"
  | "pointsPerGame";

type SortDirection = "asc" | "desc";

type Column = {
  key: SortKey;
  label: string;
  align?: "left" | "right";
};

const COLUMNS: Column[] = [
  { key: "displayName", label: "Player" },
  { key: "gamesPlayed", label: "Apps", align: "right" },
  { key: "goals", label: "Goals", align: "right" },
  { key: "assists", label: "Assists", align: "right" },
  { key: "goalContributions", label: "G+A", align: "right" },
  { key: "goalsPerGame", label: "Goals / game", align: "right" },
  { key: "assistsPerGame", label: "Assists / game", align: "right" },
  { key: "goalContributionsPerGame", label: "G+A / game", align: "right" },
  { key: "contributionRate", label: "Goal involvement", align: "right" },
  { key: "pointsPerGame", label: "Pts / game", align: "right" },
];

const formatRate = (value: number) => value.toFixed(1);
const formatPct = (value: number) => `${Math.round(value * 100)}%`;

const getSortValue = (row: PlayerStats, key: SortKey) => {
  switch (key) {
    case "displayName":
      return row.displayName;
    case "gamesPlayed":
      return row.gamesPlayed;
    case "goals":
      return row.goals;
    case "assists":
      return row.assists;
    case "goalContributions":
      return row.goalContributions;
    case "goalsPerGame":
      return row.goalsPerGame;
    case "assistsPerGame":
      return row.assistsPerGame;
    case "goalContributionsPerGame":
      return row.goalContributionsPerGame;
    case "contributionRate":
      return row.contributionRate;
    case "pointsPerGame":
      return row.pointsPerGame;
    default:
      return row.gamesPlayed;
  }
};

const renderCellValue = (row: PlayerStats, key: SortKey) => {
  switch (key) {
    case "displayName":
      return row.displayName;
    case "gamesPlayed":
      return row.gamesPlayed;
    case "goals":
      return row.goals;
    case "assists":
      return row.assists;
    case "goalContributions":
      return row.goalContributions;
    case "goalsPerGame":
      return formatRate(row.goalsPerGame);
    case "assistsPerGame":
      return formatRate(row.assistsPerGame);
    case "goalContributionsPerGame":
      return formatRate(row.goalContributionsPerGame);
    case "contributionRate":
      return formatPct(row.contributionRate);
    case "pointsPerGame":
      return formatRate(row.pointsPerGame);
    default:
      return "";
  }
};

const getDefaultDirection = (key: SortKey): SortDirection =>
  key === "displayName" ? "asc" : "desc";

const compareRows = (
  a: PlayerStats,
  b: PlayerStats,
  key: SortKey,
  direction: SortDirection
) => {
  const aValue = getSortValue(a, key);
  const bValue = getSortValue(b, key);

  const primaryDiff =
    typeof aValue === "string" && typeof bValue === "string"
      ? aValue.localeCompare(bValue)
      : Number(aValue) - Number(bValue);

  if (primaryDiff !== 0) {
    return direction === "asc" ? primaryDiff : -primaryDiff;
  }

  return (
    b.gamesPlayed - a.gamesPlayed ||
    b.goalContributions - a.goalContributions ||
    b.goals - a.goals ||
    b.assists - a.assists ||
    a.displayName.localeCompare(b.displayName)
  );
};

export default function SortablePlayerTable({ rows }: { rows: PlayerStats[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("gamesPlayed");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDirection)),
    [rows, sortDirection, sortKey]
  );

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortKey(key);
    setSortDirection(getDefaultDirection(key));
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white/85 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] w-full border-collapse text-sm text-black/70">
          <thead className="bg-black/[0.03] text-[10px] uppercase tracking-[0.22em] text-black/45">
            <tr>
              {COLUMNS.map((column) => {
                const isActive = column.key === sortKey;
                const alignRight = column.align === "right";

                return (
                  <th key={column.key} className="border-b border-black/8 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className={`flex w-full items-center gap-2 whitespace-nowrap ${
                        alignRight ? "justify-end text-right" : "justify-start text-left"
                      } ${isActive ? "text-black" : "hover:text-black/70"}`}
                    >
                      <span>{column.label}</span>
                      <span className="text-[9px] text-black/40">
                        {isActive ? (sortDirection === "desc" ? "v" : "^") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.playerId}
                className="border-t border-black/6 align-top transition hover:bg-black/[0.02]"
              >
                <td className="px-4 py-3">
                  <Link href={`/player/${row.handle}`} className="block">
                    <span className="font-semibold text-black">{row.displayName}</span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-black/45">
                      <span>@{row.handle}</span>
                      {!row.isActive ? (
                        <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-black/45">
                          Inactive
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </td>
                {COLUMNS.slice(1).map((column) => (
                  <td
                    key={column.key}
                    className="whitespace-nowrap px-4 py-3 text-right font-medium text-black/75"
                  >
                    {renderCellValue(row, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
