import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f1e7] text-slate-900">
      <div className="pointer-events-none absolute -top-40 right-0 -z-10 h-64 w-64 rounded-full bg-lime-200/40 blur-[100px] md:h-96 md:w-96 md:blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 left-10 -z-10 h-56 w-56 rounded-full bg-amber-200/40 blur-[100px] md:h-72 md:w-72 md:blur-[140px]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-[0.4em] text-black/40">
              Team tracker
            </span>
            <span className="text-xl font-semibold">
              I think we struck goals here
            </span>
          </Link>
          <nav className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-black/60">
            <Link className="hover:text-black" href="/">
              Home
            </Link>
            <Link className="hover:text-black" href="/money">
              Money
            </Link>
            <Link className="hover:text-black" href="/all-time">
              All-time
            </Link>
            <Link className="hover:text-black" href="/league">
              League
            </Link>
            <Link className="hover:text-black" href="/stats">
              Stats
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
