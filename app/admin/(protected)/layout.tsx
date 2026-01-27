import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await requireAdminSession())) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.3em] text-white/50">
              Admin
            </span>
            <h1 className="text-2xl font-semibold">6-a-side control</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-white/70">
            <Link className="hover:text-white" href="/admin/players">
              Players
            </Link>
            <Link className="hover:text-white" href="/admin/seasons">
              Seasons
            </Link>
            <Link className="hover:text-white" href="/admin/matches">
              Matches
            </Link>
            <Link className="hover:text-white" href="/admin/matches/new">
              Log match
            </Link>
            <Link className="hover:text-white" href="/admin/payments/new">
              Log payment
            </Link>
            <Link className="hover:text-white" href="/admin/insights">
              Insights
            </Link>
            <form action="/admin/logout" method="post">
              <button type="submit" className="hover:text-white">
                Log out
              </button>
            </form>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
