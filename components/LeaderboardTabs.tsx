import Link from "next/link";

type MetricKey = "goals" | "assists" | "games" | "owed";

const TABS: { key: MetricKey; label: string }[] = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "games", label: "Games played" },
  { key: "owed", label: "Money owed" },
];

export default function LeaderboardTabs({
  baseHref,
  active,
}: {
  baseHref: string;
  active: MetricKey;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`${baseHref}?tab=${tab.key}`}
          className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] ${
            active === tab.key
              ? "bg-black text-white"
              : "border border-black/10 text-black/60 hover:border-black/30"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
