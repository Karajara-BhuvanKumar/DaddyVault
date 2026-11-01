# DaddyVault — Supabase setup

The app now targets https://sybovylydbvpvolxgryx.supabase.co (DaddyVault). Supabase handles authentication and persistent Postgres storage; Vercel hosts the existing frontend and `api/state.js`. Render is no longer required. The previous SQLite server is retained for recovering local records only.

## Applied database setup

Migration `20261101182118_daddyvault_private_workspace.sql` is applied to the live project. `vault_owners` allows exactly one owner, tied to an existing Supabase Auth user. `vault_workspaces` holds the complete existing finance format as JSONB. `vault_revisions` retains 30 saved versions. All tables have RLS and explicit privileges. Anonymous requests cannot read records; other authenticated users cannot read or write the owner's records. `save_vault` uses an advisory transaction lock plus expected revision checking to reject simultaneous stale saves.

The Vercel API validates the user's JWT with Supabase and checks owner membership. It validates all financial relationships with the existing `ledger.js` before saving with the user's JWT (no privileged service key). The Supabase security advisor returned no findings. Authenticated database clients can edit their own data subject to RLS; the application API supplies the full financial validation. Nobody can add themselves to the owner table through the public API.

## One remaining account step

This project had no Auth users. Create your own email/password user in Supabase Dashboard → Authentication → Users → Add user. Enter your password there, not in chat. Copy its UUID. Enable it as owner in SQL Editor:

```sql
insert into public.vault_owners(user_id) values ('YOUR_AUTH_USER_UUID');
```

Or send the user UUID to the assistant to enable it. Do not send your password. Until this is done, financial access is intentionally blocked. The app does not offer public signup; public signups, even if enabled in project settings, cannot access this vault. For a private deployment, disable new signups in Auth settings after creating your owner.

## Run and deploy

```powershell
npm ci
npm run check
npm test
npm run build
npm start
```

Open http://localhost:8080. Sign in with the Supabase account above. `npm start` serves the app and cloud API; it no longer opens SQLite. Internet access is required.

On Vercel import this repository, choose Other, Node 22.x, build `npm run build`, output `dist`, install `npm ci`. The committed `vercel.json` deploys `/api/state` as a Node function; there is no external Render rewrite. Do not run the old Render configuration generator. No custom environment variables are required for this specific project because its non-secret URL and publishable key are configured in `supabase-config.cjs`. Optional Vercel overrides: `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Only public keys may go in this configuration. Never use a service-role/secret key. If changing project, also update the CSP connect-src domain in vercel.json.

Build writes those public values into `dist/cloud-config.js`. Supabase Auth SDK is pinned to 2.76.1 and loaded from jsDelivr; it manages session persistence and token refresh. No CDN version range is used. This environment could not reach the npm registry, so no npm SDK dependency was installed. CDN availability and real browser sign-in still require verification on your machine.

Set the production URL in Supabase Auth URL Configuration when deployed. Email confirmation/reset or other redirect-based flows require matching allowed redirects. Current app login uses an already-created email/password account; it does not implement an in-app password-reset flow. Change/reset credentials through Supabase as needed.

## Move existing records

The existing `.data/daddyvault.sqlite` has been preserved. Cloud import is pending the owner's account setup; no financial records have been uploaded yet.

1. Stop the cloud server, then run `npm run start:legacy` to open the original local database.
2. Use the legacy export command below if the cloud frontend prevents legacy UI access. It reads SQLite in read-only mode and writes a private JSON backup under ignored `backups/`:

   ```powershell
   npm run export:legacy
   ```

3. Start the cloud app with `npm start`, sign in, then Settings → Restore backup. Review the replace confirmation. This replaces the cloud workspace; it does not merge it.
4. Compare balances, transactions, investments and goals. Refresh and verify on a second device before retiring your local copy.

The offline HTML still uses browser storage and does not synchronize. No redesign of the finance screens was made; cloud sign-in adds an email input.

## Verification

Real Supabase SQL tests ran inside a rollback transaction using temporary users: owner save/update, stale revision rejection, another user's denied reads/writes, and anonymous denial all passed. Test users and records were rolled back. All 66 local tests passed, as did JavaScript syntax checks and the production build. These include existing financial workflows plus the new API and Supabase sign-in adapter. No actual owner account/password login or browser/mobile end-to-end test has been performed yet. The website has not been published.

This guide supersedes the earlier SQLite/Render deployment instructions in DEPLOYMENT.md.
