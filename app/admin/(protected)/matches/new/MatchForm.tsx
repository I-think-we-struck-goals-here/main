"use client";

import { useMemo, useState } from "react";

type PlayerRow = {
  id: number;
  displayName: string;
  handle: string;
};

type SeasonOption = {
  id: number;
  name: string;
  isActive: boolean;
};

type AppearanceRow = {
  playerId: number;
  displayName: string;
  handle: string;
  played: boolean;
  goals: number;
  assists: number;
};

type MatchFormProps = {
  players: PlayerRow[];
  seasons: SeasonOption[];
  defaultSeasonId?: number;
  lastMatchPlayerIds: number[];
  action: (formData: FormData) => void | Promise<void>;
};

export default function MatchForm({
  players,
  seasons,
  defaultSeasonId,
  lastMatchPlayerIds,
  action,
}: MatchFormProps) {
  const [rows, setRows] = useState<AppearanceRow[]>(() =>
    players.map((player) => ({
      playerId: player.id,
      displayName: player.displayName,
      handle: player.handle,
      played: lastMatchPlayerIds.includes(player.id),
      goals: 0,
      assists: 0,
    }))
  );
  const [goalsFor, setGoalsFor] = useState(0);

  const totalGoals = useMemo(
    () => rows.reduce((sum, row) => sum + row.goals, 0),
    [rows]
  );

  const goalMismatch =
    totalGoals !== goalsFor && (goalsFor !== 0 || totalGoals !== 0);

  const updateRow = (
    playerId: number,
    updates: Partial<Omit<AppearanceRow, "playerId" | "handle">>
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.playerId === playerId ? { ...row, ...updates } : row
      )
    );
  };

  const setAllPlayed = (value: boolean) => {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        played: value,
        goals: value ? row.goals : 0,
        assists: value ? row.assists : 0,
      }))
    );
  };

  const copyLastMatch = () => {
    setRows((current) =>
      current.map((row) => {
        const played = lastMatchPlayerIds.includes(row.playerId);
        return {
          ...row,
          played,
          goals: played ? row.goals : 0,
          assists: played ? row.assists : 0,
        };
      })
    );
  };

  return (
    <form action={action} className="flex flex-col gap-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Match details</h2>
            <p className="text-sm text-white/60">
              Capture the basics before logging stats.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAllPlayed(true)}
              className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-white/70 hover:border-white/40"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setAllPlayed(false)}
              className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-white/70 hover:border-white/40"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={copyLastMatch}
              className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-white/70 hover:border-white/40"
            >
              Copy last squad
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Season
            <select
              name="seasonId"
              defaultValue={defaultSeasonId}
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Played at
            <input
              name="playedAt"
              type="datetime-local"
              required
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Opponent
            <input
              name="opponent"
              required
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Venue
            <input
              name="venue"
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Goals for
            <input
              name="goalsFor"
              type="number"
              value={goalsFor}
              onChange={(event) =>
                setGoalsFor(Number(event.target.value) || 0)
              }
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Goals against
            <input
              name="goalsAgainst"
              type="number"
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Match cost (GBP)
            <input
              name="matchCostGbp"
              type="number"
              step="0.01"
              defaultValue="70.00"
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
            />
          </label>
        </div>
        {goalMismatch ? (
          <p className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-2 text-xs uppercase tracking-wide text-amber-100">
            Warning: player goals total {totalGoals}, but match GF is {goalsFor}.
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Appearances</h2>
        <div className="mt-4 grid gap-3">
          {rows.map((row) => (
            <div
              key={row.playerId}
              className="grid items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 md:grid-cols-[2fr_repeat(3,1fr)]"
            >
              <input type="hidden" name="playerId" value={row.playerId} />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">
                  {row.displayName}
                </span>
                <span className="text-xs text-white/50">@{row.handle}</span>
              </div>
              <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
                <input
                  type="checkbox"
                  name={`played-${row.playerId}`}
                  checked={row.played}
                  onChange={(event) => {
                    updateRow(row.playerId, {
                      played: event.target.checked,
                      goals: event.target.checked ? row.goals : 0,
                      assists: event.target.checked ? row.assists : 0,
                    });
                  }}
                  className="h-4 w-4 rounded border-white/20 bg-white/10"
                />
                Played
              </label>
              <input
                type="number"
                min={0}
                name={`goals-${row.playerId}`}
                value={row.goals}
                onChange={(event) =>
                  updateRow(row.playerId, {
                    goals: Number(event.target.value) || 0,
                  })
                }
                disabled={!row.played}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm disabled:opacity-40"
                placeholder="Goals"
              />
              <input
                type="number"
                min={0}
                name={`assists-${row.playerId}`}
                value={row.assists}
                onChange={(event) =>
                  updateRow(row.playerId, {
                    assists: Number(event.target.value) || 0,
                  })
                }
                disabled={!row.played}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm disabled:opacity-40"
                placeholder="Assists"
              />
            </div>
          ))}
        </div>
      </section>

      <button className="rounded-2xl bg-lime-300 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900">
        Save match
      </button>
    </form>
  );
}
