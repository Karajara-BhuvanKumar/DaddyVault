# DaddyVault

**Track it. Grow it. Protect it.**

A personal finance workspace for expenses, income, manual investments, and monthly budgets. The navy-and-emerald identity is applied throughout the existing application.

## Run locally

Node.js 18 or newer is sufficient. No dependency installation is needed.

```powershell
npm start
```

Open http://127.0.0.1:8080. If the server is already running, reload the page to see CSS and application changes.

## Validate and build

```powershell
npm run check
npm test
npm run build
```

The application itself is buildless: the server serves dist directly. The build command verifies JavaScript syntax, asset references and manifest icons, then creates release/DaddyVault.html with its styles, scripts and SVG marks embedded. The standalone file can be opened directly, though localhost provides a more consistent browser-storage origin.

No lint script or linter is configured. The check command validates JavaScript syntax; it is not a substitute for linting. Tests cover calculations, forms, persistence, filtering, legacy data compatibility and key text/action contrast pairs. They use a minimal DOM test harness and do not constitute browser visual QA.

## Features

- Monthly cash-flow overview, spending chart, portfolio allocation, and budget progress.
- Create, edit, delete, search, filter, and export income and expenses.
- Manual investment holdings, cost basis, value and unrealized return.
- Monthly category limits with overspend indicators.
- INR default; optional USD, EUR, GBP display labels.
- JSON backups, validated restore, sample data and reset workflow.
- Desktop sidebar, tablet icon rail, mobile bottom navigation.
- Seven scalable logo variants, semantic design tokens and brand documentation.

## Existing data remains compatible

The internal core namespace and localStorage key `folio-data-v1` are intentionally unchanged. Existing records and JSON backups continue to work; changing the visible brand does not reset user data. New exports use the DaddyVault filename.

Data is stored in this browser on this device. There is no bank connection, authentication, cloud sync, encryption layer, or live market feed. Localhost and file-based previews have separate storage origins. Use backups to move records.

Available cash = opening balance + recorded income - recorded expenses through the device's current date. The selected reporting month scopes income, expenses and budgets. Investments are separate manual records and do not create cash entries. Holdings value = units * current price. Unrealized gain = current value - cost basis. Budget limits recur monthly. Currency changes relabel amounts without conversion.

Separate assets, liabilities and net-worth accounting are not implemented in this version. The brand refresh preserves the working feature set rather than adding new financial models.

## Identity and source files

See BRAND.md for the logo system, colors, typography, accessibility and messaging.

- dist/index.html: DaddyVault identity, metadata, navigation shell and accessible dialog.
- dist/tokens.css: semantic brand, surface, text, status and chart tokens.
- dist/styles.css: unified visual system and responsive rules.
- dist/app.js: branded screens, chart colors, presentation and export filenames.
- dist/core.js: existing financial calculations and data validation, unchanged.
- dist/assets/brand/: primary/light/dark horizontal SVGs, two monograms, app icon and favicon.
- dist/site.webmanifest: application identity and icon.
- server.cjs: local server with manifest content type.
- scripts/build.cjs: validated standalone export.
- tests/: regression and contrast tests.
- VALIDATION.md: actual checks and known verification limits.

Manrope and Inter load from Google Fonts, with system font fallbacks when unavailable. SVG wordmarks retain editable text with font fallbacks; icon assets are entirely paths.
