> Current Supabase migration: see [SUPABASE_SETUP.md](SUPABASE_SETUP.md). The app now uses Supabase Auth/Postgres and Vercel API functions. Earlier SQLite/Render instructions below are retained as historical reference.

# DaddyVault

Track it. Grow it. Protect it.

A single-owner personal finance application with local SQLite storage and an authenticated hosting mode. The existing vanilla JavaScript stack, charcoal cards, colors, typography, and five-item bottom navigation are retained. Accounts, Goals, Reports and Recurring are accessible from a small secondary navigation row.

For production, follow [DEPLOYMENT.md](DEPLOYMENT.md): Vercel frontend plus a persistent Render backend, or Render alone. No deployment has been performed as part of this preparation.

## Run

Requires Node.js 22.13+ in the 22.x line. There are no third-party npm dependencies. Local loopback mode needs no credentials; public hosting requires the configuration in `.env.example` and `DEPLOYMENT.md`.

```powershell
npm start
```

Open http://localhost:8080. Use the same browser and hostname you previously used to allow automatic migration of its legacy records. `localhost` and `127.0.0.1` have different browser storage, though both now reach the same SQLite database. If legacy data lives on another origin, export its JSON backup and restore it in Settings.

Local mode binds to 127.0.0.1. On first startup it creates `.data/daddyvault.sqlite`; versioned migrations create/update the schema automatically. `PORT` defaults to 8080, and `DADDYVAULT_DB` sets a custom database path. Production binds to `0.0.0.0`, requires owner authentication, exact HTTPS origins and an explicit persistent database path. Never publicly expose unauthenticated local mode. `npm start` reads an optional ignored `.env` file.

Node 22.13 prints an ExperimentalWarning for its built-in SQLite API. That is a runtime warning, not a failed save.

## Working features

- Income and expense CRUD with category, source/title, account, payment method, date, notes, optional recurrence and transaction details.
- Cash, bank, savings, UPI, credit-card and other accounts; opening balances, history, edit, archive and guarded deletion.
- Internal transfers and card repayments with atomic, linked balance updates; no duplicate income or expense.
- Investments in stocks, mutual funds, ETFs, fixed deposits, gold, cryptocurrency, real estate and other assets. Purchases, additional buys, partial/full sales, weighted-average remaining cost, realized and unrealized gains, manual valuations and history.
- Savings and investment goals with deadlines, monthly targets, allocation histories, contributions, withdrawals and archive/edit/delete actions.
- Overall and category-specific monthly budgets, prior months, 75% / 90% / exceeded warnings and legacy recurring limits.
- Central ledger with all eight transaction types, search, date/account/category/method/type filters, amount/date sorting and 25-row pagination.
- Reports for this week/month, last month, last three/six months, this year and custom dates; income/expense comparisons, category/source breakdowns, savings rate, current accounts and investment performance.
- Weekly, monthly and yearly recurring schedules; pause/edit/delete and review-before-post catch-up. Batches contain at most 1,000 due entries and cannot duplicate an occurrence.
- Profile, currency display, timezone, date format, default account, category management and icons.
- JSON backup/validated restore, CSV export, separate demo workspace, loading/save/error states and duplicate-submit prevention.

## Accounting

All domain calculations and record validation live in `dist/ledger.js`. Amounts use integer paise internally for ledger addition/subtraction. Currency labels do not convert values; this is a single-currency ledger.

- Income credits an account; expenses debit it.
- Transfers debit a source and credit a destination without changing income/expenses.
- Credit-card balances are signed: negative means debt. Purchases increase debt; repayments reduce cash and debt without creating expenses again. Card credit balances count in net worth but not available cash. Cash advances are unsupported.
- Purchases debit cash and add investment units/cost. Sales credit proceeds and remove weighted-average cost. Opening holdings represent already-owned investments and do not deduct cash again.
- Goals earmark cash by account. They never add cash or net worth. Withdraw an allocation before spending it or using it to purchase an investment. To reallocate, withdraw from one goal and contribute to another.
- Available balance = active non-credit cash minus all goal allocations. Savings total includes savings-goal allocations; all-goal total also includes investment goals.
- Net worth = all signed account balances + current holding values. Goal allocations are included only once, within cash.
- Historical changes replay the ledger and are rejected if they invalidate later sales or goal allocations.
- Records are date-only ledger dates. The selected timezone determines today's date and date filters; changing timezone does not shift previously recorded dates.

## Persistence and migrations

`database.cjs` stores one validated workspace aggregate atomically in SQLite. The database also keeps the latest 30 saved revisions. Linked record integrity is enforced by the shared validator on every read/write; it is not a normalized relational schema with per-record SQL foreign keys. Schema version: 2; application record version: 2. Migration 002 adds owner sessions and login throttling without modifying financial records.

- `GET /api/state` loads current state, revision and a write token. Hosted mode requires an authenticated owner session for all reads and writes.
- `PUT /api/state` validates the full next state and expected revision before a SQLite transaction commits it. Stale tabs receive 409; invalid records receive 422. The UI retains forms on a failed save.
- Hosted authentication uses a scrypt password hash and random, expiring HttpOnly cookies with server-side session records. Production uses Secure cookies, trusted-origin checks, session CSRF tokens, login throttling and response security headers. Local unauthenticated mode stays loopback-only.
- Original `folio-data-v1` browser data remains untouched. In unauthenticated local mode, real legacy records migrate to v2 only when the database is empty. Hosted data import requires an explicit JSON restore after sign-in. Legacy holdings become opening positions; legacy Card entries remain Other accounts for review instead of being guessed as credit debt.
- Existing database data takes precedence over browser data. Use explicit JSON restore to replace it.
- Demo records use a separate browser key and cannot overwrite the real database.
- The generated standalone `release/DaddyVault.html` uses browser-only storage when opened as a file. It is not connected to SQLite. It is intended as an offline companion, not a cloud deployment. A static host without the Node API intentionally shows a connection error.

Keep JSON backups privately outside Git. Deleting `.data` removes the local database. SQLite data is not application-encrypted. A hosted instance on a persistent disk shares the same records across the owner's signed-in devices; the offline HTML does not sync. There is no multi-user tenancy or signup.

## Checks

```powershell
npm run check
npm test
npm run build
```

The tests use real SQLite files plus a small DOM/event harness and in-process HTTP handler requests. They include owner login, session expiry/revocation, unauthorized access, migrations and separate authenticated clients. They are not browser automation. Optional real HTTP checks and the remaining browser release gate are documented in `DEPLOYMENT.md`. The build validates local assets and creates the self-contained offline HTML; `dist/` is the hosted frontend.

See `IMPLEMENTATION.md` for the full requirements checklist and `VALIDATION.md` for exact tested outcomes and blocked browser verification.
