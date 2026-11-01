# DaddyVault - Supabase setup

The app uses https://sybovylydbvpvolxgryx.supabase.co for authentication and Postgres storage. Vercel serves the existing frontend and api/state.js. Render is not required. The SQLite server is retained only for recovering local records.

## Accounts and database

Both migrations in supabase/migrations are applied to this project. On a new Supabase project, apply them in filename order using the Supabase CLI or SQL Editor. The second migration removes the original single-account limit. Each signed-in email account registers its own vault automatically; there is no manual owner SQL step.

Every table has Row Level Security. Users can only register their own UUID and access their own workspace and revision history. Anonymous Auth accounts are rejected. The API verifies the JWT with Supabase and validates all financial relationships before saving with that user's JWT. No service-role key is used. save_vault locks each user's workspace and checks its revision to reject stale saves; it retains 30 revisions.

## Required Auth dashboard settings

Open https://supabase.com/dashboard/project/sybovylydbvpvolxgryx/auth/url-configuration

- Set Site URL to https://daddy-vault.vercel.app/
- Add these exact allowed Redirect URLs:
  - https://daddy-vault.vercel.app/
  - https://daddy-vault.vercel.app/?auth=recovery
- Enable email/password authentication and allow new users to sign up.
- Keep email confirmation enabled for production.
- Configure a production SMTP provider in Authentication email settings, including its verified sender/domain. Supabase's default mail service restricts recipients and is not a general production email service. Keep SMTP passwords in Supabase settings only.
- Use the standard confirmation and password recovery templates with the Supabase ConfirmationURL link; do not replace the recovery link with the homepage.
- Review password policy and enable leaked-password protection if available for your plan. The security advisor currently reports that protection as disabled.

These dashboard settings and actual email delivery have NOT been verified or changed by this implementation. See https://supabase.com/docs/guides/auth/auth-smtp and https://supabase.com/docs/guides/auth/redirect-urls .

## Sign-up and recovery behavior

Create an account opens email, password and confirmation fields within the existing dialog. New passwords require at least 12 characters. When confirmation is required, the app stays locked and asks the user to check email. Confirmed users sign in and receive a private empty vault.

Forgot password requests a Supabase email with a recovery redirect to the production site. The recovery screen updates the password, signs out sessions globally and asks the user to sign in again. Expired links show a new reset request. Already-issued JWTs may remain valid until their expiry even after session revocation. Errors are displayed without claiming successful email delivery or password changes. Reset acknowledgements do not reveal whether the email is registered.

## Run and deploy

```powershell
npm ci
npm run check
npm test
npm run build
npm start
```

Open http://localhost:8080. The app uses the cloud API and requires internet access. Email links intentionally return to the canonical production site, including when testing the local frontend.

On Vercel import the repository, choose Other, Node 22.x, build npm run build, output dist and install npm ci. The committed vercel.json deploys /api/state as a Node function. Push changes to the linked production branch or redeploy that branch in Vercel.

No custom environment variables are required for this project: supabase-config.cjs contains only the public URL and publishable key. Optional overrides are SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Never substitute a service-role/secret key. Build writes public configuration into dist/cloud-config.js. When changing the project or host, also update the CSP connect-src domain in vercel.json, the canonical redirect in dist/cloud-auth.js and the Supabase URL settings.

Supabase Auth SDK is pinned to 2.76.1 on jsDelivr and manages session persistence and token refresh. CDN access is required.

## Recover existing local records

The existing .data/daddyvault.sqlite is preserved. Run npm run export:legacy to create a private JSON backup under ignored backups/. Start the cloud app, sign in and use Settings > Restore backup. Review the replace confirmation: restore replaces the workspace rather than merging it. Compare balances and refresh on a second device before retiring the local copy. The offline HTML uses browser storage and does not synchronize.

## Verification and manual acceptance

All 73 local tests, JavaScript syntax checks and the production build pass. Tests cover signup validation, email-confirmation handling, immediate sessions, reset requests, provider errors, valid and expired recovery links, recovery events and the existing finance workflows. SDK email flows use mocks; no real password or mailbox was used.

Live Supabase SQL tests with temporary users passed inside a rolled-back transaction: two users independently registered and saved vaults; cross-user reads, updates, registration and anonymous reads were blocked. No test users or records were retained. The security advisor reports leaked-password protection disabled, with no table/RLS findings.

After deployment and configuring email, test with an email address you control: sign up, confirm email, sign in, save a record, refresh, sign out, request a reset and follow its link, set a new password and sign in again. Repeat on mobile and verify another account has an empty private vault. Real mailbox delivery and full authenticated browser testing remain manual acceptance steps.

This guide supersedes the original SQLite/Render deployment instructions in DEPLOYMENT.md.
