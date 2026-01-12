import Link from "next/link";

import { getActiveSeason } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const activeSeason = await getActiveSeason();
  const seasonHref = activeSeason ? `/season/${activeSeason.slug}` : "/";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f1e7] text-slate-900">
      <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-lime-200/60 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-10 h-72 w-72 rounded-full bg-amber-200/60 blur-[120px]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-[0.4em] text-black/40">
              6-a-side
            </span>
            <span className="text-xl font-semibold">Team Tracker</span>
          </Link>
          <nav className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-black/60">
            <Link className="hover:text-black" href={seasonHref}>
              Season
            </Link>
            <Link className="hover:text-black" href="/all-time">
              All-time
            </Link>
            <Link className="hover:text-black" href="/league">
              League
            </Link>
            <Link className="hover:text-black" href="/admin/login">
              Admin
            </Link>
          </nav>
        </header>
        <main className="flex flex-1 flex-col gap-10">{children}</main>
      </div>
    </div>
  );
}
