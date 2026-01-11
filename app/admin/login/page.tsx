import Link from "next/link";

import { loginAction } from "./actions";

type AdminLoginPageProps = {
  searchParams?: { error?: string };
};

const ERROR_COPY: Record<string, string> = {
  invalid: "That password did not match.",
  missing: "Enter the admin password.",
  rate_limited: "Too many attempts. Wait a bit and try again.",
};

export default function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const errorKey = searchParams?.error;
  const error = errorKey ? ERROR_COPY[errorKey] : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
        <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              Admin access
            </p>
            <h1 className="text-3xl font-semibold">Team Tracker control room</h1>
            <p className="text-sm text-white/70">
              Enter the admin password to manage players, matches, and payments.
            </p>
          </div>
          {error ? (
            <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          <form action={loginAction} className="flex flex-col gap-4">
            <label className="text-sm text-white/70" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white shadow-inner focus:border-white/40 focus:outline-none"
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="rounded-2xl bg-lime-300 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 transition hover:bg-lime-200"
            >
              Unlock admin
            </button>
          </form>
          <Link href="/" className="text-sm text-white/60 hover:text-white">
            Back to public site
          </Link>
        </div>
      </div>
    </div>
  );
}
