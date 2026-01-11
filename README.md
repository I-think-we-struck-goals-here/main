# 6-a-side Team Tracker

Public stats + balances with a private admin control room.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and fill in:
   - `DATABASE_URL` (Netlify Postgres connection string)
   - `ADMIN_SESSION_SECRET` (any long random string)
   - `ADMIN_PASSWORD_HASH` (generated below)

3. Generate the admin password hash:
   ```bash
   node scripts/hash-password.mjs "your-password"
   ```
   Copy the output into `ADMIN_PASSWORD_HASH`.

4. Generate and run migrations:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

## Admin routes

- `/admin/login` — password gate
- `/admin/players` — add/edit/deactivate players
- `/admin/seasons` — create and set active season
- `/admin/matches/new` — log matches with appearance grid
- `/admin/payments/new` — log payments

## Notes

- Owed amounts are calculated from match shares minus payments per season.
- Share rounding is deterministic by player handle.
- Public pages are server-rendered; the database is never exposed to the browser.
