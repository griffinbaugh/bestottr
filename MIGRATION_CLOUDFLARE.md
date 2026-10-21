# BestOttr independent hosting and backend migration

Target stack: GitHub source, Cloudflare Workers hosting, owner-controlled Supabase database and authentication, Resend outbound email, and existing Cloudflare DNS/Email Routing. Preserve the current interface and demo behavior.

## Build and hosting

The standard Vite/TanStack Start build uses Nitro's `cloudflare-module` preset without editor plugins. It emits `.output/server/index.mjs` and `.output/public`. Deploy with the root `wrangler.jsonc`, which enables `nodejs_compat`, static assets and `keep_vars`.

Cloudflare Git settings:

- Repository: `griffinbaugh/bestottr`, branch `main`, repository root.
- Install: `npm ci`.
- Build: `npm run build`.
- Deploy: `npx wrangler deploy -c wrangler.jsonc`.
- Verify first at `https://bestottr.griffinmbaugh.workers.dev`.

## Environment

| Name | Where | Type |
|---|---|---|
| `VITE_SUPABASE_URL` | Cloudflare build environment | Public URL for the new project |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Cloudflare build environment | Public publishable key for the new project |
| `SUPABASE_URL` | Worker runtime | Same project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Worker runtime | Same publishable key |
| `RESEND_API_KEY` | Worker runtime | Secret; retain the configured key |
| `SUPPORT_EMAIL_FROM` | Worker runtime, optional | Defaults to `bestottr Support <support@bestottr.com>` |

Changing browser settings requires a rebuild. Runtime settings alone do not change the browser's backend. No service-role key is required by the active application flow. Never put private migration credentials in build variables or Git.

## Backend migration — required before leaving the old backend

1. Choose an owner-controlled Supabase project. Check its contents before applying any schema; do not reuse an unrelated project's tables.
2. Export the existing support tickets, roles and account inventory from the managed backend using authorized admin access. Keep exports in ignored `private-migration/`. Do not attempt export with a public key: ticket RLS intentionally blocks it.
3. Review and apply the support schema in `supabase/migrations/`. Review grants, RLS and callable functions, then run Supabase security advisors.
4. Copy every existing ticket with its ID, ticket number, original timestamps, contact details, status, priority and notes intact. Advance `support_ticket_seq` past the largest imported numeric ticket suffix. Verify row counts and field values before switching endpoints.
5. Migrate existing accounts where applicable. A source UUID/password-hash export requires authorized backend access. Recreate staff roles only against verified destination account IDs. Never grant admin based on user-editable metadata.
6. Configure authentication with the preview site's URL and `/admin/support` redirect; add canonical-domain URLs when cutover is ready. Verify staff sign-in and admin-only ticket access. Configure auth email separately if account confirmation/reset emails are needed; the Worker's Resend key only sends support emails.
7. Update both build and runtime variables to the new project and rebuild. Verify ticket creation, ticket number continuity, emails, admin reads/updates, and denied public ticket reads. Check accounts without admin cannot read tickets or grant themselves roles.
8. Complete `MIGRATION_PARITY_CHECKLIST.md` against the preview deployment. Retain the source export and old backend until copy verification and cutover pass.

## Domain cutover and rollback

After verification, add `bestottr.com` to the Worker and redirect `www` to the canonical root. Preserve MX, SPF/DKIM and Cloudflare Email Routing records. Record the old web DNS configuration before changing it. Roll back using the prior deployment and matching backend variables if needed; preserve any new tickets created after cutover before reverting backend writes.

The migration is unfinished until existing tickets are copied and verified. Removing editor code alone does not complete backend migration.

## Migration checkpoint

The owner-controlled BestOttr project is provisioned in GriffinApps, US East:

- Project reference: `dkaqxhjoshlynuwxbwbu`.
- API URL: `https://dkaqxhjoshlynuwxbwbu.supabase.co`.
- Creation quote: $0/month.
- Support schema applied; public table access and role writes revoked, RLS enabled, role lookup uses invoker permissions.
- Transactional database verification passed: public RPC submission, denied anonymous ticket read, admin read/update, denied nonadmin read, denied self-assigned admin role. Test accounts and ticket were rolled back; persisted test ticket count is zero.
- Security advisors flag the intentionally public submission RPC as executable SECURITY DEFINER for anon/authenticated. This is the existing submission architecture; it returns only a ticket number and validates fields and per-email limits. Other table access remains restricted.
- Source backup `bestottr_261021.backup` was imported selectively: all 6 support tickets copied with full-field JSON comparison passing; source auth.users, auth.identities and user_roles are empty. There are no storage objects; the sole bucket is a database-export bucket, which was not copied. Ticket sequence is 106 (next 107). Anonymous REST ticket read returns 401. Initial staff account creation and endpoint cutover remain pending. Lovable provides a full database export including account password hashes from More → Cloud → Overview → Advanced settings → Export project data → Export data → Database → Export → Start export. Source: https://docs.lovable.dev/features/advanced-settings . Storage files, provider settings and secrets are separate.
- GitHub connector writes remain blocked with 403; migration code is committed locally on `migration/remove-lovable-local`.

- Public build/runtime settings for the new backend are prepared in ignored local `.env`. Do not commit it. Staff login must be created in the new project; no existing account was available to migrate.
