# Roundhouse — boxing timer + workout library

This is a static GitHub Pages app. It keeps the custom interval timer and adds a workout builder, personal history, saved workouts, public discovery, searchable athlete profiles, and optional Supabase account sync. There are no advertisements or ad scripts.

## Try it before connecting Supabase

Open `index.html` in a browser served from GitHub Pages or a local static server. In local mode, your history is saved only in that browser's local storage. Supabase is not connected until you configure it below.

## Connect Supabase (one-time setup)

1. Create a project at [supabase.com](https://supabase.com/).
2. In the Supabase dashboard, open **SQL Editor → New query**. Copy all of `supabase/schema.sql` into the editor and run it. This creates the profiles and workout tables and enables row-level security.
3. In **Authentication → URL Configuration**, add your GitHub Pages site as the Site URL and Redirect URL. For this repository, the usual site is `https://erivis5643.github.io` (confirm the exact URL in the repository's **Settings → Pages**).
4. In Supabase **Authentication → Sign In / Providers → Email**, leave Email enabled and switch **Confirm email** off. This lets friends create an account and sign in with a password without sending confirmation emails. Their email addresses will not be verified; password reset still depends on email delivery, so don't rely on it until SMTP is configured. Each person should use a unique password.
5. In **Project Settings → API** (or **Connect**), copy the Project URL and the browser-safe **anon/publishable** key. Do not use or publish the `service_role` / secret key.
6. In the GitHub website, open `supabase-config.js`, click the pencil icon, paste the Project URL into `url` and the anon/publishable key into `anonKey`, then commit the change. These two values are meant for the browser; the SQL row-level security policies protect private data.
7. Open the Pages site, choose **Sign in**, and either create an account or sign in with email and password. If GitHub Pages has a custom domain, use that exact origin in Supabase's URL settings too.

## Workout behavior

- Pressing **Play workout** records that session in your account's History (or browser-only local history if signed out); completion time is recorded when the timer finishes.
- **Save to library** marks it for reuse. **Make public** requires sign-in and publishes the workout to Discover; it is also saved to your library.
- Discover search can find public workout titles and usernames. A profile's public workouts are visible to others. A “Save a copy” action makes a private copy under the current account.
- Workouts use a `steps` JSON array and keep timer block types, seconds, color, repeats, and manual pauses. A folder/collection label helps organize your history and library. Import and export JSON directly in the builder.

## Important security notes

- Do not add the Supabase `service_role` key, email provider secrets, or any private API key to this static site.
- The frontend uses only the browser-safe anon/publishable key. Row-level security is required; always run the checked-in schema before enabling account data.
- Public profiles and workouts are intentionally readable by everyone. Keep sensitive information out of public bios and descriptions.
- This is an MVP. Passwordless email sign-in is handled by Supabase Auth; private user data is protected by Postgres RLS rather than frontend visibility controls.
