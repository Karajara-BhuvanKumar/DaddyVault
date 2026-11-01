> Current UI update: the supplied dark banking references supersede the earlier navy-and-emerald surface treatment below. Active UI colors live in dist/tokens.css: graphite #111111, charcoal #1a1a1a, coral action #f4775e, white #f5f5f5. dist/reference.css applies textured cards, soft lighting, compact charts and translucent bottom navigation. The DaddyVault name, tagline and existing logo assets are retained.

# DaddyVault identity

**Track it. Grow it. Protect it.**

Positioning: Your complete financial vault.

## Logo system

The original D monogram uses a 64-unit grid. A 10-unit geometric D encloses a small four-spoke vault spindle. The silhouette remains recognizable without the internal detail; the favicon simplifies the spindle to a dot.

| File in dist/assets/brand | Purpose |
| --- | --- |
| logo-primary.svg | Primary horizontal lockup for dark surfaces |
| logo-dark.svg | White wordmark and D with emerald spindle |
| logo-light.svg | Navy wordmark and D with darker emerald spindle |
| monogram.svg | Standalone mark for light surfaces |
| monogram-dark.svg | Standalone mark for dark surfaces |
| favicon.svg | Small-size, simplified mark on navy |
| app-icon.svg | 192-unit icon with navy background and generous padding |

Keep at least one spindle diameter of clear space around the monogram. Use the standalone mark below 150 px lockup width; minimum suggested symbol size is 24 px. The simplified favicon is intended for 16 px contexts. Do not stretch, rotate, add shadows, or place the dark mark on dark surfaces. Use the SVG masters for scaling.

Wordmark typography is Manrope, with Daddy in a heavier weight than Vault. The SVG lockups use live text with Manrope, Inter and Arial fallbacks; install Manrope for exact typography in a design editor. The application uses an HTML wordmark with the same font family and weight contrast. Monograms and icons are entirely vector paths without font dependencies.

## Color roles

| Role | Foundation | Dark UI adaptation |
| --- | --- | --- |
| Identity | Navy #0F172A | Sidebar and app icon |
| Canvas | Soft white #F8FAFC | #0B1220 |
| Card surface | White #FFFFFF | #0F1B2D |
| Secondary | Slate #334155 | #17253A |
| Primary action | Emerald #10B981 | Dark #052E25 label |
| Positive value | Emerald | #34D399 |
| Negative value / error | Red | #FDA4AF |
| Premium accent | Gold #F59E0B | Small brand details only |
| Muted text | #64748B | #9CACC1 |
| Border | #E2E8F0 | #253449 |

The reusable source is dist/tokens.css. Use semantic variables rather than copying literal colors into components. Chart colors use restrained emerald, blue, teal and slate, with gold representing gold holdings. Signs and text accompany gain/loss colors; color alone does not carry meaning.

## Typography and components

- Manrope: headings, wordmark and financial figures.
- Inter: navigation, paragraphs, tables, controls and chart labels.
- Tabular numerals: financial figures, percentages and table amounts.
- Headings: 26-34 px; section titles 15 px; primary body and controls 12-14 px; supporting labels 10-12 px.
- Spacing: 4 px base scale; 16-24 px card padding; 18-24 px section gaps.
- Corners: 8 px controls, 16 px cards, 20 px dialogs.
- Primary actions use emerald; destructive actions use a restrained red treatment.
- Explicit focus rings, dialog labels, keyboard skip link, reduced-motion support and scrollable table regions are provided.

## Responsive behavior

Desktop uses a full sidebar. At 1000 px it becomes an icon rail; at 600 px navigation moves to the bottom. Overview columns collapse at 800 px. Mobile statistics use separate rows and long values may wrap instead of escaping a card. Tables retain every field and action inside a keyboard-focusable scroll area. Touch forms use 16 px text and 44 px controls.

## Messaging

Use direct, useful language: Record, Review, Plan, Update. Empty states explain the next action. The tagline is brand positioning, not a claim of financial protection, encryption or guaranteed returns.

The current app supports expenses, income, budgets and manual investments. It does not yet implement separate assets/liabilities, net-worth accounting, authentication, bank integrations or cloud sync. The requested hero heading is used, while the description names only implemented features. No new financial functions were implied by the brand refresh.

The existing dark-only theme is preserved. Light-background logo variants are provided for future light surfaces; no theme switch is advertised.
