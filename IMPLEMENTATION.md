# Implementation report — 1 November 2026

> Historical feature implementation report. The later production-hosting work adds owner authentication, SQLite migration 002, persistent Render hosting configuration and optional Vercel proxy configuration. Its current setup and security boundaries are documented in `DEPLOYMENT.md` and the updated `README.md`; the local-only limitations below describe the earlier baseline.

## Specification and audit

Read all 573 lines (16,947 bytes) of the attached Pasted text.txt. Inspected the existing application, static Node server, build process, styles, forms and tests before implementation.

The initial application already had income/expense CRUD, basic filtering, manual holdings, repeating category budgets, CSV/JSON export and browser persistence. It had no server API, database, authentication, real account model, investment trade ledger, goals, recurrence or reports.

Preserved: existing stack, original styling files/tokens, dark banking visual language, original five navigation items and shared card/dialog/form components. Necessary additions: secondary links for Accounts, Goals, Reports and Recurring; status/error messages; additional financial fields/cards. Existing screens are extended to use the shared ledger.

## Completed checklist

- [x] Audited all existing screens, controls and persistence.
- [x] Shared v2 ledger, integer monetary aggregation, linked accounts/trades/goals and historical validation.
- [x] Migration from v1 records preserving originals and avoiding duplicate investment cash debits.
- [x] Local SQLite database, schema migration, durable transactions and optimistic revision checks.
- [x] GET/PUT state API, errors, request limits and local origin/host/write-token checks.
- [x] Income/expense CRUD, title/source, amount/date/account/method/category/notes, recurring option and details.
- [x] Custom categories, icons, rename propagation and guarded deletion.
- [x] Account creation/edit/opening balances/history/transfer/archive/delete; credit debt and repayments.
- [x] Investment creation/edit/deletion, additional purchases, partial/full sales, valuation, weighted cost, realized/unrealized returns and history.
- [x] Savings/investment goals, deadlines, monthly targets, progress, contributions, withdrawals, history and archive/edit/delete.
- [x] Monthly overall/category budgets, prior months, filters and 75%/90%/overspend warnings.
- [x] Central transaction history for income, expense, transfer, repayment, buy, sell, contribution and withdrawal.
- [x] Search, date/category/account/method/type filters, sorting, 25-row pagination and CSV export.
- [x] Reports, monthly comparisons, source/category breakdowns, savings rate, account balances and current investment performance.
- [x] All requested date-range presets and custom dates.
- [x] Recurring weekly/monthly/yearly schedules, clamped month ends, review-before-post and idempotent catch-up.
- [x] Profile/currency/timezone/date format/default account, JSON backup/restore and separate demo mode.
- [x] Duplicate submit prevention, loading/saving/error states, validation and destructive-action confirmations.
- [x] Automated accounting, form-handler, API, conflict, migration, failure and reopen-persistence tests.
- [ ] Browser/mobile visual QA and live browser-to-server end-to-end checks: environment blocked.

## Database and services

`migrations/001_local_workspace.sql` creates workspace and revisions tables. Each saved aggregate commits atomically; latest 30 revisions retained. SQLite journal mode WAL, synchronous FULL. Actual local database schema was created and inspected. New APIs: GET and PUT /api/state. New modules: dist/ledger.js, dist/storage.js, dist/features.js and database.cjs. New CSS only supports functional additions; existing styles, colors and typography remain.

No Supabase project, cloud database, secret credentials or existing authentication were present. No external account or environment variable is required. This follows the specification's local-first fallback and additionally provides a real local database.

## Supported boundaries

- The app is local, single-user and unencrypted; cloud sync, login, row-level multi-user access and live price feeds are not implemented or claimed.
- Recurrence runs only when due entries are reviewed and posted in the open app. There is no background scheduler while closed.
- Account/holding/goal deletion is guarded when linked history exists. Close/sell/withdraw and archive where offered, or explicitly remove linked entries before deletion. This preserves audit history by default.
- Investment goals earmark cash for a future purchase; they are not linked to market-valued holdings.
- Currency changes relabel amounts without FX conversion. There is no multi-currency accounting.
- Investment/account performance cards explicitly show current values. Historical transaction charts use the selected range. No historical live market values are invented.
- Standalone HTML uses separate browser persistence. SQLite requires the included Node server.
- Persistence is tested by reopening real SQLite files and new storage clients. Actual browser refresh/reopen and mobile interaction verification remain blocked.

## Setup

Use Node 22.13 or newer. From this folder run npm start, then open http://localhost:8080 using the same browser/hostname as prior data. No npm dependencies or required environment variables. Optional PORT and DADDYVAULT_DB. Keep backups; do not publicly expose the local server.
