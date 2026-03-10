# Six-a-side Tracker

Internal team app for match stats, player balances, and admin operations.

## Codex handoff rule

This README is the project handoff file for Codex sessions.

Every Codex agent working on this codebase should:

1. Read this README before making substantial changes.
2. Update this README after any significant product, route, data-model, or behavior change.
3. Add concise notes that help the next Codex agent understand what changed, why it changed, and where the core logic lives.

This is a Next.js + Drizzle/Postgres app with:

- Public pages for league/stats/money visibility.
- Protected admin pages for seasons, matches, players, and payments.
- All-time payment reconciliation (money no longer tied to a single season view).

## Tech stack

- Next.js `16.1.1` (App Router)
- React `19.2.3`
- Drizzle ORM + Neon HTTP driver
- Postgres (Netlify DB / external Postgres)
- TypeScript

## Core concepts

### 1) Stats are season-aware

Season pages and season leaderboards are computed per selected season.

Player analytics now also support both:

- season-scoped breakdowns
- all-time breakdowns

The public players views use the same stats layer, with a season toggle on `/players`.

### 2) Money is all-time by default

Outstanding balances are computed across all logged matches and all logged payments.

Key behavior in `lib/stats.ts`:

- `buildOwedMap()` with no season ID computes global owed/credit.
- Public `/money` and admin reconciliation use all-time totals.
- Season filters still exist where needed for stats and payment logging metadata.

### 3) Payment records still store season ID

`payments` rows keep `seasonId` for audit context, while totals/reconciliation can span all seasons.

## Route map

### Public

- `/`
- `/stats`
- `/all-time`
- `/players`
- `/league`
- `/money`
- `/opposition`
- `/season/[seasonSlug]`
- `/player/[handle]`

### Admin

- `/admin/login`
- `/admin` (dashboard)
- `/admin/players`
- `/admin/seasons`
- `/admin/matches`
- `/admin/matches/new`
- `/admin/matches/[matchId]`
- `/admin/payments/new` (primary operations screen)
- `/admin/payments` (all-time totals by player)
- `/admin/insights`

### API

- `/api/cron/playfootball`

## Key admin payment screens

### `/admin/payments/new`

Operational workflow page with:

- Quick settle (one-click full payment for players currently owing)
- Manual payment logging form
- Paid vs outstanding reconciliation table
- Recent payment list

The reconciliation section is intended as the source of truth for finance checks.

### `/admin/payments`

Dedicated summary page with all-time total paid amounts per player.

Use this page to cross-check cumulative paid totals against external records.

## Public player analytics screens

### `/players`

Public player directory with:

- season toggle and all-time toggle
- appearances, goals, assists, goal involvements
- per-game output metrics
- team goals for / against while playing
- win / draw / loss record and win rate
- clean sheets, points per game, and contribution rate

This page is intended as the fastest public comparison view across the squad.

### `/player/[handle]`

Expanded individual player profile with:

- season stats for the active season
- all-time stats
- owed balance context
- team record and output metrics while that player was marked as played

### `/opposition`

Public opponent scouting page, usually reached by clicking a fixture card.

Shows for a selected opponent and season:

- full completed result list
- win / draw / loss record
- goals for / against
- points per game
- clean sheets
- recent form

It reuses the cached PlayFootball fixture snapshot already used on the home and league pages.

## Database schema (high level)

Defined in `db/schema.ts`:

- `seasons`
- `players`
- `matches`
- `appearances`
- `payments`
- `playfootball_fixtures_log`
- `external_league_snapshots`
- `admin_login_attempts`

## Environment variables

See `.env.example`.

Required:

- `DATABASE_URL` (or `NETLIFY_DATABASE_URL`)
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `CRON_SECRET`

Notes:

- `db/index.ts` resolves `NETLIFY_DATABASE_URL ?? DATABASE_URL`.
- Admin auth rejects startup if session secret or password hash is missing.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and set values.

3. Generate admin password hash:

```bash
node scripts/hash-password.mjs "your-password"
```

4. Run migrations:

```bash
npm run db:generate
npm run db:migrate
```

5. Start dev server:

```bash
npm run dev
```

## Admin auth + security

Implemented in `lib/admin-auth.ts`:

- Signed session cookie (`admin_session`) with HMAC.
- Cookie max age: 30 days.
- Login rate limiting by IP using `admin_login_attempts`.
- Protected admin layouts/routes redirect to `/admin/login` when not authenticated.

## Deployment notes

This codebase has both `.vercel/` and `.netlify/` artifacts in repo history, but runtime expects standard env vars and server-side DB access.

Before deploy:

1. Ensure env vars are configured in the target platform.
2. Run migrations against production DB.
3. Validate:
   - `/money`
   - `/admin/payments/new`
   - `/admin/payments`

## Known operational gotchas

1. "No balances outstanding" in quick settle can be correct for that quick-settle filter while reconciliation still shows paid/credit data.
2. If money totals look wrong, validate all-time pages first:
   - Public `/money`
   - Admin `/admin/payments`
3. If admin login loops, verify:
   - `ADMIN_SESSION_SECRET`
   - `ADMIN_PASSWORD_HASH`
   - secure cookie behavior in current environment.

## Suggested workflow for balance issues

1. Open `/admin/payments` to verify all-time paid totals by player.
2. Open `/admin/payments/new` and inspect paid vs outstanding rows.
3. Compare with external source of truth.
4. Add corrective payment entries rather than mutating historical match rows.

## File ownership guide

- Money and balance logic: `lib/stats.ts`, `lib/money.ts`
- Player analytics logic: `lib/stats.ts`
- Public players UI: `app/(public)/players/page.tsx`, `app/(public)/player/[handle]/page.tsx`
- Payment admin UI: `app/admin/(protected)/payments/new/page.tsx`
- Payment summary UI: `app/admin/(protected)/payments/page.tsx`
- Payment writes: `app/admin/(protected)/payments/new/submit/route.ts`
- Auth and sessions: `lib/admin-auth.ts`, `app/admin/login/*`

## Update checklist (for future Codex sessions)

When changing payment behavior:

1. Update logic in `lib/stats.ts` first.
2. Update both admin payment pages and public `/money` if relevant.
3. Verify no season-only assumptions remain in all-time flows.
4. Update this README with behavior changes and any new route semantics.

When changing any major feature:

1. Update the relevant route map entries.
2. Document new derived stats, toggles, filters, or scope rules.
3. Note any operational/debugging gotchas another Codex agent would need.
4. Keep the README concise, but current.
