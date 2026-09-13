# Supabase setup

One-time setup. Takes about 10 minutes.

## 1. Create the project

1. Go to https://supabase.com and create a new project (free tier is fine).
2. Once it's ready, go to **Project Settings → API**.
3. Copy the **Project URL** and the **anon public** key.
4. In this repo, copy `.env.local.example` to `.env.local` and paste those two values in.

## 2. Enable email auth

1. In the Supabase dashboard, go to **Authentication → Providers**.
2. Make sure **Email** is enabled.
3. Go to **Authentication → URL Configuration** and add these as allowed redirect URLs (add your real production domain too once you deploy):
   - `http://localhost:3000/auth/callback`
   - `https://blindspotco.net/auth/callback` (swap in your real domain)

This project uses **magic link** sign-in (email a link, no password) plus **Google sign-in** — nothing else to configure for magic link, but Google needs the setup below.

## 2b. Enable Google sign-in

1. Go to https://console.cloud.google.com and create a project (or use an existing one).
2. Go to **APIs & Services → OAuth consent screen** — fill in the basics (app name, your email). "External" user type is fine.
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**. Application type: **Web application**.
4. Under **Authorized redirect URIs**, add:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
   (find `your-project-ref` in your Supabase Project URL — it's the part before `.supabase.co`)
5. Save, then copy the **Client ID** and **Client Secret** it gives you.
6. Back in Supabase, go to **Authentication → Providers → Google**, toggle it on, and paste in that Client ID and Client Secret.

That's it — the "Continue with Google" button in `/login` will work once this is done.

## 3. Create the `folders` and `reports` tables

Go to **SQL Editor** in the Supabase dashboard, paste this in, and run it:

```sql
-- A folder is just a user-chosen label ("Flat 402", "Whitefield House") --
-- somewhere to group every report (neighbourhood, AI, furnishing) that's
-- about the same property.
create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  folder_id uuid references folders(id) on delete set null,
  source text not null check (source in ('sunscout', 'aslivastu', 'neighbourhood', 'ai-report', 'furnishing')),
  title text,
  data jsonb,
  created_at timestamptz default now()
);

alter table folders enable row level security;
alter table reports enable row level security;

-- Each user can only ever see or modify their own folders/reports.
create policy "Users can view their own folders"
  on folders for select
  using (auth.uid() = user_id);
create policy "Users can insert their own folders"
  on folders for insert
  with check (auth.uid() = user_id);
create policy "Users can delete their own folders"
  on folders for delete
  using (auth.uid() = user_id);

create policy "Users can view their own reports"
  on reports for select
  using (auth.uid() = user_id);
create policy "Users can insert their own reports"
  on reports for insert
  with check (auth.uid() = user_id);
create policy "Users can delete their own reports"
  on reports for delete
  using (auth.uid() = user_id);
```

**Already had the old `reports` table (source only allowed `'sunscout'`/`'aslivastu'`) from an earlier setup?** Run this instead of the `create table reports` above:

```sql
alter table reports add column folder_id uuid references folders(id) on delete set null;
alter table reports drop constraint reports_source_check;
alter table reports add constraint reports_source_check
  check (source in ('sunscout', 'aslivastu', 'neighbourhood', 'ai-report', 'furnishing'));
```

That's it — both tables now exist and are locked down so a user can only ever see their own folders/reports, never anyone else's, enforced at the database level (Row Level Security), not just in the app code.

## 4. What these tables are for

- `folders.name` — the label the person types in the Save panel (e.g. a flat number, a house name). `unique (user_id, name)` means saving into a name that already exists reuses that folder instead of creating a duplicate.
- `reports.folder_id` — which folder this report was filed under. Nullable: a report saved without picking/typing a folder just has no folder, and still shows up in /my-reports as unfiled.
- `reports.source` — `'neighbourhood'` (the AsliVastu-style neighbourhood report), `'ai-report'` (the combined/unit AI report generated from Property Score), or `'furnishing'` (the floor-plan furnishing advisor). `'sunscout'`/`'aslivastu'` are kept in the check constraint for backward compatibility but nothing currently saves with those values.
- `reports.title` — whatever short label the Save button sends (e.g. an address, a pin code).
- `reports.data` — the actual report content as JSON, however each source shapes it (see `app/api/reports/route.js` for what each one saves).

Wired up: `components/reports/SaveReportButton.js` is used from the neighbourhood report, the AI report modal, and the furnishing advisor. `/my-reports` groups everything by folder first, then by report type within a folder.


## 5. Create the `field_reports` table (data-quality feedback)

This is the L5 "local-expert feedback" loop from `docs/data-integrity-architecture.md` — the "report this" button next to individual stats in the detailed readout (`components/shared/FieldFeedback.js`, posting to `app/api/field-feedback/route.js`). Not created yet? The API route returns a `save-failed` error until you run this.

Go to **SQL Editor** in the Supabase dashboard, paste this in, and run it:

```sql
create table field_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  pin_code text not null,
  city text,
  field_name text not null,
  field_label text,
  reported_value text,
  claimed_value text,
  note text,
  page_url text,
  status text not null default 'open' check (status in ('open', 'triaged', 'corrected', 'dismissed')),
  created_at timestamptz default now()
);

alter table field_reports enable row level security;

-- Anyone can file a report, signed in or not -- the whole point is to
-- catch the person who spots a wrong number in the moment, without a
-- sign-in wall in the way. See the API route's own comment for why.
create policy "Anyone can submit a field report"
  on field_reports for insert
  with check (true);

-- No public select/update/delete policy is created here on purpose --
-- reports are for internal triage only (read them in the Supabase table
-- editor, or from a service-role script), not surfaced back to users.
-- Add a policy later if you build an admin triage view that should read
-- through the anon/user client instead.
```

### What it's for

- `pin_code` / `city` / `field_name` / `field_label` — which stat, on which pin, someone flagged. `field_name` is the raw data key (e.g. `metro_stations_nearby`); `field_label` is the human label shown on screen (e.g. "Metro nearby") at the time of the report.
- `reported_value` — what BlindSpot was showing when they reported it (a snapshot, so a later data fix doesn't retroactively change what the report was about).
- `claimed_value` / `note` — their correction and any free-text context (source, link, local knowledge).
- `status` — for manual triage: `open` (new) → `triaged` (looked at) → `corrected` (data was fixed because of it) or `dismissed`. Per the architecture doc: "Corrections weighted by corroboration (n independent reports on the same field → auto-flag → L2 gate)" — for now that corroboration check is a manual query (`group by pin_code, field_name having count(*) > 1`), not yet automated.

Nothing here auto-applies a correction to `data/aslivastu/master_by_pin.json` — every report is a claim to review, not a write. That review step is what keeps this loop from becoming a new way to introduce bad data instead of catching it.
