> Current Supabase migration: see [SUPABASE_SETUP.md](SUPABASE_SETUP.md). The app now uses Supabase Auth/Postgres and Vercel API functions. Earlier SQLite/Render instructions below are retained as historical reference.

# Validation report — production preparation, 1 November 2026

## Final automated results

- `npm ci`: passed; no third-party packages, audit reported zero vulnerabilities.
- `npm run check`: passed for frontend, backend and deployment helper JavaScript.
- `node --test --test-reporter=spec tests/*.test.cjs`: **62 passed, 0 failed, 0 skipped**. This executes the same test files as `npm test`.
- `npm run build`: passed; local assets, scripts and manifest icons validated; offline HTML generated.
- `git diff --check`: passed after removing an extra trailing blank line.
- Secret/data exclusions checked: `.env`, `.env.production`, `.data/daddyvault.sqlite`, and `backups/export.json` are ignored. `.env.example` is not ignored and is awaiting commit along with other new files.
- No production credentials added. No deployment or push performed.

## Coverage

| Area | Verification actually performed |
| --- | --- |
| Income and expenses | Form/event harness CRUD, ledger recalculation, reload through fresh storage harness |
| Account transfers | Both balances update; total cash conserved; invalid links rejected |
| Investments | Purchases, manual valuation updates, partial/full sales, cost basis, realized/unrealized gains, oversale protection |
| Savings/investment goals | Contributions/withdrawals, progress, available cash, no duplicated net worth, historical integrity |
| Dashboard | Income/expense totals, cash, net worth, liabilities, budget utilization and date ranges |
| Existing UI | Nine screen functions rendered in a DOM harness; empty/demo states, escaped content, navigation and form handlers |
| Authentication | Incorrect/correct passwords, session creation, secure cookie attributes, login retry DOM harness, logout, expiry, forged-cookie rejection |
| Session persistence | SQLite close/reopen preserves valid sessions; credential rotation invalidates old sessions |
| Authorization | Unauthenticated state reads and writes rejected; no public database/secret-file route |
| Request protections | Origin/host allowlist, missing origin, CSRF, size/type limits, login throttle, unknown routes |
| Database | Real temporary SQLite files; atomic save validation; close/reopen persistence; v1-to-v2 migration preserves financial records |
| Two devices (simulated) | Two separate authenticated clients read shared records; stale revisions return 409 |
| Client recovery | Expired authentication retries pending save once with new CSRF token and same revision; private server avoids silent browser-data import |
| Deployment config | HTTPS-only Vercel proxy config generation, correct static directory and API-only rewrite; fail-closed production environment checks |

Production request tests run the real server handler and database with in-process request/response streams. The DOM harness is not a browser. SQLite tests do not open or modify the owner's existing `.data` database.

## Errors encountered and resolved

- Existing local server had no authentication and could not be exposed safely. Added single-owner authentication, session storage, CSRF checks and login throttling.
- Host/origin checks and loopback-only binding blocked public hosting. Added validated production configuration, Render host support, HTTPS origin allowlist and public listen binding with authentication.
- Existing local-file SQLite backend is incompatible with Vercel's ephemeral function filesystem. Retained it on a persistent Render disk; added a Vercel configuration generator for a same-origin API rewrite.
- Existing storage/error/settings text described every server as local. Updated it for hosted operation without changing financial UI layout or calculations.
- Existing schema initialization always reapplied version 1. Replaced with transactional, version-aware migrations and migration 002.
- Existing secret ignore rules were incomplete. Added environment/key/backup exclusions and a safe example.
- Existing database errors returned 422. Storage failures now return 503 with a safe error message.
- New real-HTTP tests initially failed with `connect EACCES 127.0.0.1:<port>` due to environment network restrictions. Added in-process transport as the default and retained optional `RUN_HTTP_TESTS=1` for normal environments; all default checks pass. This does not establish real HTTP success.
- Browser preview at `http://127.0.0.1:8091` failed with `net::ERR_CONNECTION_TIMED_OUT`. The disposable server was stopped afterward.
- Node 22.13 emits an ExperimentalWarning for `node:sqlite`; all database checks pass.

## Unverified release requirements

Actual desktop/mobile visual rendering, browser login, browser refresh persistence, real HTTP transport, TLS, Vercel-to-Render rewrites/cookies, provider disk survival after redeploy and access from a physical phone remain unverified.

No redesigned layout was introduced: original styling remains; additions are an owner sign-in dialog, sign-out button, and revised storage/error text. CSS preservation alone is not proof of responsive behavior.

Use the exact commands and hosted release checklist in [DEPLOYMENT.md](DEPLOYMENT.md). Complete it with synthetic data before importing real finances. The source is prepared for configured deployment; it has not been deployed or certified as fully verified in production.
