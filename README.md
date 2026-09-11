# Crew & Grounds

Scheduling and job tracking for a cleaning and gardening business. Next.js (App Router, TypeScript) + Tailwind CSS on the frontend, Supabase (Postgres, Auth, RLS) on the backend.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase: Postgres, Auth, Row Level Security
- Two roles: **Owner/Admin** (full access) and **Staff** (their own assigned jobs only)

## First-time setup

1. **Install dependencies** (already done if you're reading this right after scaffolding):
   ```bash
   npm install
   ```

2. **Start Supabase locally** (requires Docker Desktop running):
   ```bash
   npm run supabase:start
   ```
   This applies `supabase/migrations/0001_init.sql`, which creates the schema, RLS policies, and helper triggers.

3. **Env vars** — `.env.local` is already wired up to the local Supabase instance's keys (from `supabase start`'s output). If you ever run `supabase stop && supabase start` and the keys rotate, update `.env.local` to match.

4. **Create your Owner/Admin account:**
   ```bash
   npm run create-admin -- --email you@example.com --password "some-strong-password" --name "Your Name"
   ```

5. **Run the app:**
   ```bash
   npm run dev
   ```
   Sign in at [http://localhost:3000/login](http://localhost:3000/login) with the admin account you just created.

## Inviting staff

From the **Staff** page (admin-only), click **+ Invite Staff** and fill in their name, phone, email, and role. This creates their roster record and sends a Supabase Auth invite email to that address.

Locally, Supabase doesn't send real email — invite links land in **Mailpit** at [http://localhost:54324](http://localhost:54324). Open the invite email there, click the link, and it'll walk the new staff member through setting a password. After that they can log in at `/login` and will only ever see their own assigned jobs.

## Data model

- **staff** — name, phone, email, skill (cleaning/gardening/both), a color hue for the calendar, active flag, and an optional link to a Supabase auth user.
- **jobs** — client, address, job type, date/time/duration, assigned staff (nullable), status (scheduled/in_progress/completed/cancelled), price, notes, and recurrence (weekly/fortnightly/monthly) via a shared `series_id`.
- **profiles** — maps a Supabase auth user to an app role (`admin`/`staff`) and, for staff, their `staff` row.

## Roles & RLS

- Admins have full read/write access to `staff` and `jobs`.
- Staff can only read their own `staff` row and jobs assigned to them, and can only ever change a job's `status` field (enforced by a database trigger, not just app code) — they can't reassign, reprice, or edit other jobs.
- All of this is enforced at the database level via Postgres Row Level Security, not just in the UI.

## Screens

1. **Dashboard** — KPI tiles, a "Needs Attention" panel (unassigned/overdue jobs), and today's schedule. Staff see a version scoped to just their own jobs.
2. **Schedule** — week view, one column per day, jobs color-coded by staff.
3. **Jobs** *(admin-only)* — searchable/filterable list with add/edit/delete.
4. **Staff** *(admin-only)* — roster management: invite, edit, activate/deactivate.

## Useful commands

```bash
npm run dev              # start the Next.js dev server
npm run build             # production build
npm run supabase:start    # start local Supabase (Postgres, Auth, Studio, Mailpit)
npm run supabase:stop     # stop it
npm run create-admin      # bootstrap the Owner/Admin account
```

Supabase Studio (browse tables, run SQL, inspect auth users) is at [http://localhost:54323](http://localhost:54323) while the local stack is running.

## Deploying to a hosted Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. `supabase link --project-ref <your-project-ref>`
3. `supabase db push` to apply the migration.
4. Update `.env.local` (or your host's env vars) with the hosted project's URL, anon key, and service role key from the Supabase dashboard, and set `NEXT_PUBLIC_SITE_URL` to your deployed URL.
5. Run `npm run create-admin` again pointed at the hosted project to bootstrap the admin account there.
