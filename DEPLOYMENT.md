> Current Supabase migration: see [SUPABASE_SETUP.md](SUPABASE_SETUP.md). The app now uses Supabase Auth/Postgres and Vercel API functions. Earlier SQLite/Render instructions below are retained as historical reference.

# DaddyVault deployment guide

Prepared 1 November 2026. Code preparation is complete; the application has **not** been deployed in this task. Browser/mobile verification and hosted HTTPS/proxy verification remain release checks.

## Detected stack and architecture

| Layer | Actual implementation |
| --- | --- |
| Frontend | Buildless HTML, CSS, vanilla JavaScript in `dist/`; no React, Next.js or Vite |
| Navigation | Hash routes: `/#overview`, `/#transactions`, `/#investments`, `/#budgets`, `/#settings`, `/#accounts`, `/#goals`, `/#reports`, `/#recurring` |
| Backend | Node.js 22.13+ in the 22.x line, built-in `node:http`; no Express |
| Database | Built-in `node:sqlite`, SQLite file, WAL, atomic transactions and optimistic revisions |
| Dependencies | No third-party runtime or development npm dependencies; committed npm lockfile |
| Identity | One owner password, scrypt hash, server-side sessions stored in SQLite |
| Supabase | Not present or required; no Supabase keys, migrations or RLS policies |
| Offline export | `release/DaddyVault.html`; file-mode localStorage only |

Recommended for your Vercel preference: **Vercel static frontend → same-origin `/api/*` rewrite → one Render Node web service with a persistent disk**. All financial data stays on Render. Vercel receives no credentials. The rewrite keeps browser requests and cookies on the frontend's origin, avoiding cross-site cookies and broad CORS rules.

A simpler supported option is **Render alone**, serving both frontend and API. It requires the same database and owner login, but no Vercel configuration. The frontend alone is Vercel-compatible; the local-file SQLite backend is not a Vercel Function. Render's free service filesystem is not durable; a paid web service with an attached disk is required for this architecture. Check current platform pricing before creating it.

One instance only: do not enable horizontal scaling, multiple workers, or independent services writing different copies of this database. Every person given the owner password accesses the same workspace. This is not a multi-user finance SaaS. Separate user accounts would require a further identity and per-user data migration.

## Environment variables

The original project used only `PORT` and `DADDYVAULT_DB`. Production now requires the following:

| Variable | Where | Value / purpose |
| --- | --- | --- |
| `NODE_ENV` | Render | `production`; enables fail-closed production checks and secure cookies |
| `NODE_VERSION` | Render | `22.x`; choose Node 22.x in Vercel settings too |
| `HOST` | Render | `0.0.0.0`; local default is `127.0.0.1` |
| `PORT` | Render | Supplied by Render; do not hardcode; local default `8080` |
| `DADDYVAULT_DB` | Render | `/var/data/daddyvault.sqlite`, on the attached persistent disk |
| `DADDYVAULT_PASSWORD_HASH` | Render secret setting | Exact output of `npm run password:hash`; never the plaintext password |
| `DADDYVAULT_ORIGINS` | Render | Exact comma-separated HTTPS origins, e.g. `https://YOUR-SERVICE.onrender.com,https://YOUR-APP.vercel.app`; no trailing slash, paths or wildcard |
| `RENDER_EXTERNAL_HOSTNAME` | Render automatic | Backend hostname used to accept requests from Render's proxy/health checks |
| `VERCEL` | Vercel automatic | Build detects Vercel and requires a configured API rewrite |
| `RUN_HTTP_TESTS` | Optional local/CI test process | `1` enables the production suite's real HTTP transport; unset uses in-process request handlers |

**Vercel requires no custom environment variables.** Its backend URL is public routing configuration generated into `vercel.json`, not a secret. Never add the owner password hash, SQLite file or other secrets to Vercel/frontend code.

`npm start` loads `.env` if it exists, while existing environment variables take precedence. `.env.example` is safe to commit; `.env`, `.env.*`, keys, database files, logs, dependencies and private backups are ignored. If you use a local `.env`, put the hash in single quotes so its `$` characters remain literal. In Render's UI, paste the raw hash without surrounding quotes.

Generate your own password hash in an interactive terminal:

```powershell
npm run password:hash
```

Use a unique password of at least 16 characters from your password manager. Input is hidden and never placed in command arguments. Store the password yourself. Only copy the hash into Render. No production credential was generated or inserted during this task.

## Build and local commands

Run from the Git repository root: `C:\Users\karaj\Desktop\Presonal Expense\folio`. If importing that repository from GitHub, its root directory is `.`; do not select an extra `folio` directory unless your uploaded repository actually contains it.

```powershell
npm ci
npm run check
npm test
npm run build
npm start
```

The production frontend directory is **`dist`**. It is maintained source, not disposable generated output. Do not delete it. The build checks syntax/assets and also creates a standalone offline export in `release/`; do not upload `release/` as the hosted app.

Optional real HTTP integration checks on a machine where loopback connections work:

```powershell
$env:RUN_HTTP_TESTS = '1'
node --test tests/production.test.cjs
Remove-Item Env:RUN_HTTP_TESTS
```

For disposable browser QA with owner authentication and an empty in-memory database:

```powershell
node tests/preview.cjs
```

Open the printed URL and use the temporary password printed by this test process. This fixture never opens your real `.data` directory. Stop it with Ctrl+C; its test records disappear. Use `npm start` for normal durable local use.

## Render deployment

1. Review and commit the working tree to your GitHub repository, including new/untracked application modules, migrations, lockfile, `render.yaml`, tests and this guide. There were existing uncommitted changes before this task; preserve them. Inspect `git status --short` and verify no secrets or data files are included. This task has not committed or pushed.
2. In Render, choose **New → Blueprint**, select the repository and `render.yaml`. Alternatively create a **Web Service** manually with the settings below.
3. Use Node runtime, the repository root, one instance, and a paid plan supporting persistent disks. The blueprint selects `starter`; confirm current price before accepting billing.
4. Attach a disk mounted at `/var/data`, at least 1 GB. Set `DADDYVAULT_DB=/var/data/daddyvault.sqlite`. A file elsewhere will be lost on replacement/redeploy even when the service has a disk.
5. Set the variables above and the generated password hash. Set `DADDYVAULT_ORIGINS` to the exact Render service origin. Render shows its assigned URL in the dashboard; if you could not set it before first startup, update it and redeploy. Missing required settings intentionally stop startup.
6. Build command: `npm ci && npm run check && npm test && npm run build`.
7. Start command: `npm start`. Health check: `/api/health`. The server binds to `0.0.0.0` and Render's `PORT`.
8. Deploy. Migrations run on application startup, after the disk is mounted. Do not run database migrations during the build or a separate pre-deploy command, where the disk is unavailable.
9. Open `https://YOUR-SERVICE.onrender.com/api/health`: expect `{"ok":true}`. Without signing in, `/api/state` must return **401**. Open the homepage and sign in. Render-only hosting is usable after the verification checklist below.

## Vercel deployment, step by step

1. Complete Render deployment first and retain its HTTPS service origin.
2. Generate the exact routing configuration locally:

   ```powershell
   npm run configure:vercel -- https://YOUR-SERVICE.onrender.com
   ```

   Replace the example with the actual origin, without a trailing slash. This writes `vercel.json`, with static output `dist`, build/install commands, security headers and an external rewrite for `/api/:path*`. No placeholder rewrite has been committed. Review and commit the generated file and push it to GitHub.
3. In Vercel choose **Add New → Project → Import Git Repository**.
4. Framework preset: **Other**. Root: repository root. Node version: **22.x**. Install: `npm ci`. Build: `npm run build`. Output directory: `dist`. These commands are also in the generated configuration.
5. Add **no secret environment variables** on Vercel. Deploy.
6. Copy the stable production URL, e.g. `https://YOUR-APP.vercel.app`. On Render append it to `DADDYVAULT_ORIGINS`, retaining the Render origin; redeploy Render. Do not add wildcard preview domains. For a custom domain, add its exact HTTPS origin as well.
7. Open the Vercel URL and sign in. Verify `/api/health` through Vercel returns JSON, not HTML. Verify a logged-out `/api/state` returns 401. Successful login must set a `Secure`, `HttpOnly`, `SameSite=Strict` cookie on the Vercel host. It must not contain a `Domain` attribute pointing to Render.
8. Follow the release checklist below. A Vercel deployment alone does not prove the backend/proxy/login works.

Optional CLI deployment after configuring the correct Vercel project:

```powershell
npx vercel
npx vercel --prod
```

Authorize the intended Vercel account/project and add its stable origin on Render. Preview deployments are not trusted automatically and should not write production finance data. Use a separate Render service/disk if you need a staging environment.

All actual app routes are hash routes. Refreshing `/#transactions` requests `/` and keeps the screen selection, so no catch-all SPA rewrite is necessary. Asset URLs remain at the root. Unknown assets and API routes correctly return 404, not `index.html`.

## Database setup, migration and backups

The startup migration runner uses `PRAGMA user_version`, executes upgrades transactionally, and refuses a database schema newer than the application:

| Migration | Tables / behavior |
| --- | --- |
| `001_local_workspace.sql` | `workspace` (one validated JSON aggregate) and `revisions` (last 30 committed snapshots) |
| `002_auth.sql` | Hashed session IDs, CSRF tokens, session expiry and credential version in `auth_sessions`; persisted login throttle in `login_attempts` |

Database schema version is 2. Financial record format stays version 2. IDs and account/holding/goal relationships are validated in `dist/ledger.js` on every read/write. The schema uses a JSON aggregate, so there are no per-record SQL foreign keys or RLS policies. Writes commit the entire validated ledger atomically; conflicting saves return 409 instead of overwriting newer data.

To move your existing records safely:

1. Run the current local app and select **Settings → Download JSON backup**. Retain this backup privately outside Git.
2. Deploy the empty hosted vault and sign in. Production never silently imports arbitrary browser-local data into an empty server database.
3. Select **Settings → Restore backup**, choose the exported JSON, review the replace confirmation, and restore. This replaces the hosted workspace; it does not merge it. Never restore over newer hosted records without taking their backup first.
4. Compare transaction counts, account balances, investment units/values, goal allocations and dashboard net worth with the original. Refresh and sign in on your phone; verify the same records.
5. Keep the local database and export until the hosted checks pass. Do not upload the SQLite file to a public repo or static frontend.

For an existing server-side v1 SQLite deployment, take a backup first and retain the same disk/path when deploying this version; startup applies migration 002 without changing financial records. Migration tests verify this. For a rollback, restore both a matching application version and a separately retained database backup; do not edit `user_version` to bypass compatibility checks.

Take regular JSON backups from Settings and keep them in private storage. The last 30 revisions on the same disk are not disaster recovery. Provider disk snapshots are useful but do not replace a tested export/restore process. Never copy only a live SQLite main file while WAL writes may be outstanding; use a SQLite-aware backup or stop the service before copying all required database files.

## Security and supported limits

- Production refuses to start without a valid scrypt password hash, exact HTTPS origins and an absolute database path. You must ensure that path is on the real mounted disk; the app cannot verify your hosting subscription or disk attachment.
- All financial reads and writes require a valid owner session. There is no signup and no anonymous data endpoint.
- Password verification uses scrypt (`N=65536`, `r=8`, `p=1`) and constant-time comparison. Raw passwords are not logged/stored. Session cookies are random; only their SHA-256 hashes are stored in SQLite.
- Sessions expire after 12 hours, survive service restart, are revoked on logout, and are invalidated when the configured password hash changes and the service restarts. To reset a forgotten password or revoke all sessions, generate a new hash and update Render.
- State writes and logout require the session's CSRF token; production mutations also require a trusted exact Origin. Foreign hosts/origins are rejected. Login accepts at most 10 attempts per minute across the entire single-owner service, persisted across restarts. This can temporarily delay your own login during abuse; it is not distributed DDoS protection.
- API and pages use `Cache-Control: no-store`, CSP, frame blocking, MIME protection and referrer restrictions. TLS is terminated by Render/Vercel. Financial data is never embedded in the static bundle.
- Database files are not application-encrypted. Limit access to the Render account, GitHub and backups; enable provider account MFA. This app does not implement MFA itself, bank connections or automated market prices.
- The offline HTML uses localStorage, which does not sync between browsers/devices and may be cleared by the browser. Demo data remains browser-only and separate from real hosted records.
- Hosted devices read the same SQLite vault. New records load on page load, focus, visibility change or explicit reload; there is no push/live collaboration. Concurrent stale saves are rejected with 409; reload and reapply the change.
- No UI redesign: the original layout/styles/components are retained. Only a matching owner login dialog, sign-out button, and accurate storage/error text were added.

## Verification and release gate

Automated tests cover financial workflows, server-side validation, SQLite close/reopen persistence, v1 schema migration, two authenticated clients sharing state, stale revision conflicts, login/logout/expiry/credential rotation, CSRF/origin checks, unauthorized reads/writes, login throttling, request size rejection, static assets and private-file denial. A DOM harness checks login retry and sign-in completion; it is not a real browser.

The current execution environment denied localhost HTTP with `EACCES`; browser preview timed out. Therefore real HTTP transport, mobile/desktop rendering, actual browser refresh, and production Vercel-to-Render cookie/proxy operation are **not verified here**. See `VALIDATION.md` for exact test results.

Before relying on the hosted app, use synthetic records first:

- Sign in with the correct password; check an incorrect password fails. Sign out, refresh and confirm financial records cannot load. Test a second browser or private window without a session.
- Add income and an expense; create two accounts; transfer funds and confirm total cash is unchanged by the transfer.
- Add an investment purchase, update its price and test a partial sale. Confirm cash, units and realized/unrealized values.
- Create savings and investment goals; contribute and withdraw. Goal allocations must not duplicate net worth.
- Refresh each hash route and verify saved state survives. Open laptop and phone, compare data, and test a stale save from two tabs.
- Restart/redeploy Render and verify the records remain. If they disappear, stop using the deployment and correct the disk/path before restoring a backup.
- Test desktop and mobile widths (about 1440 px and 390 px), login, dialogs, forms, navigation and table scrolling. CSS was preserved, but visual QA remains required.
- Export JSON, make a disposable test change and restore the backup; compare totals. Keep a backup before importing real finances.
- Inspect browser console/network for errors and verify all scripts, icons and styles load. Test Vercel and Render endpoints without auth. Verify no private financial response is cached.

## Official hosting references

- https://vercel.com/kb/guide/is-sqlite-supported-in-vercel
- https://vercel.com/docs/routing/rewrites
- https://render.com/docs/web-services
- https://render.com/docs/disks
- https://render.com/docs/blueprint-spec
- https://render.com/docs/node-version
