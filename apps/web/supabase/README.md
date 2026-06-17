# QuadState — Supabase cloud setup

Real accounts + cloud sync run entirely on Supabase from the static SPA (no
server code). The browser uses the anon/public key; Row-Level Security
(`schema.sql`) is the access boundary. When the env vars are unset, the app
runs in pure guest mode (local-only).

## 1. Create the project
1. Create a Supabase project. Copy **Project URL** and the **anon/public key**
   from *Settings → API*.
2. Put them in `apps/web/.env.local` (see `apps/web/.env.example`):
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-public-key>
   ```
   On Vercel, set the same two vars for **Production** and **Preview**.
   Never expose the `service_role` key.

## 2. Schema
Open *SQL editor* and run `schema.sql` from this folder. It creates the
`projects` and `user_settings` tables and their RLS policies.

## 3. Auth providers (*Authentication → Providers*)
- **Google** — create an OAuth client in Google Cloud Console; paste the
  client id/secret.
- **GitHub** — create an OAuth App in GitHub *Developer settings*; paste the
  client id/secret.
- **Email** — enable it and turn on **magic link** (no password flow).

For Google and GitHub, add the Supabase callback to each provider's authorized
redirect list:
```
https://<ref>.supabase.co/auth/v1/callback
```

## 4. Redirect URLs (*Authentication → URL Configuration*)
- **Site URL**: your Vercel production domain, e.g. `https://quadstate.vercel.app`.
- **Additional Redirect URLs**:
  - `http://localhost:5173` (local dev)
  - the production domain
  - (optional) a Vercel preview wildcard, e.g. `https://*-<your-scope>.vercel.app`

The app sends users back to `origin + pathname` (no hash), so the auth callback
never collides with the `#/p/<slug>` share route.

## What syncs
- **Projects** — saved to `projects`, scoped per-user by RLS; they follow you
  across devices. Guests keep using per-device localStorage.
- **Settings** — editor preferences sync via `user_settings`.
- **Share links** — a signed-in owner can mark a project public (Share sheet),
  producing a `…/#/p/<slug>` link anyone can open read-only.
