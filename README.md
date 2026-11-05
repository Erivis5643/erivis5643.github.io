# Boxing timer + workout library

This static GitHub Pages app includes your existing browser-safe Supabase Project URL and anon/publishable key in `supabase-config.js`; the update archive preserves that file so you will not need to enter them again. Never place a `service_role` key in the site.

## Run the app

Open `index.html` in a browser served from GitHub Pages or a local static server. This package includes your Supabase browser config; data sync still depends on the database schema having been applied. If Supabase is unavailable, local workouts remain in that browser's local storage.

## Supabase setup (first install or schema update)

1. Create a project at [supabase.com](https://supabase.com/).
2. In the Supabase dashboard, open **SQL Editor → New query**. Copy all of `supabase/schema.sql` into the editor and run it. This creates the profiles and workout tables and enables row-level security.
3. In **Authentication → URL Configuration**, add your GitHub Pages site as the Site URL and Redirect URL. For this repository, the usual site is `https://erivis5643.github.io` (confirm the exact URL in the repository's **Settings → Pages**).
4. In Supabase **Authentication → Sign In / Providers → Email**, leave Email enabled and switch **Confirm email** off. This lets friends create an account and sign in with a password without sending confirmation emails. Their email addresses will not be verified; password reset still depends on email delivery, so don't rely on it until SMTP is configured. Each person should use a unique password.
5. This package already includes the browser-safe Project URL and anon/publishable key from your live site. If you later change Supabase projects, edit `supabase-config.js` with the new Project URL and anon/publishable key only; never use the `service_role` / secret key.
6. Open the Pages site, choose **Sign in**, and either create an account or sign in with email and password. If GitHub Pages has a custom domain, use that exact origin in Supabase's URL settings too.

## Workout behavior

- A workout stays the same plan when started. On full completion, one dated completion event is recorded; a scheduled date is cleared and the event is placed on the local day the timer finished.
- **Save to library** marks it for reuse. **Make public** requires sign-in and publishes the workout to Discover; it is also saved to your library.
- Discover search can find public workout titles and usernames. A profile's public workouts are visible to others. A “Save a copy” action makes a private copy under the current account.
- Workouts use a `steps` JSON array and keep timer block types, seconds, color, repeats, and manual pauses. Categories create library tabs. Import and export JSON directly in the builder.
- The Received tab shows unread badges, sender names, and shared workout snapshots. Use **Import HERMES AI week** to add a weekly JSON plan to your private library and calendar. Its root format is `{ "workouts": [{ "title": "Bag rounds", "description": "...", "category": "Boxing", "scheduled_for": "2026-11-09", "steps": [{ "type": "exercise", "name": "Warm-up", "durationSeconds": 300, "color": "#f04438" }] }] }`. The weekly planning workflow provides this companion file after you answer the check-in; importing it is currently a manual step.

## Important security notes

- Do not add the Supabase `service_role` key, email provider secrets, or any private API key to this static site.
- The frontend uses only the browser-safe anon/publishable key. Row-level security is required; always run the checked-in schema before enabling account data.
- Public profiles and workouts are intentionally readable by everyone. Keep sensitive information out of public bios and descriptions.
- This is an MVP. Passwordless email sign-in is handled by Supabase Auth; private user data is protected by Postgres RLS rather than frontend visibility controls.
