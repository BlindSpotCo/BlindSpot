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
