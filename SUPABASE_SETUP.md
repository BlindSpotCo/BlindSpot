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

## 3. Create the `reports` table

Go to **SQL Editor** in the Supabase dashboard, paste this in, and run it:

```sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source text not null check (source in ('sunscout', 'aslivastu')),
  title text,
  data jsonb,
  created_at timestamptz default now()
);

alter table reports enable row level security;

-- Each user can only ever see or modify their own reports.
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

That's it — the `reports` table now exists and is locked down so a user can only ever see their own saved reports, never anyone else's, enforced at the database level (Row Level Security), not just in the app code.

## 4. What this table is for

- `source` — `'sunscout'` or `'aslivastu'`, so /my-reports can group them.
- `title` — whatever short label the Save button sends (e.g. an address, a pin code).
- `data` — the actual report content as JSON, however each app wants to structure it.

This table isn't wired up to anything yet — SunScout and AsliVastu don't have "Save to BlindSpot" buttons pointed at it. That's the next phase.
