# Migrating bestottr to GitHub + Cloudflare Workers (free tier)

Zero intentional visual or behavior change. The current Lovable deployment is the golden reference.

## Target
The build (`vite build`, TanStack Start + Nitro Cloudflare preset) already emits a Workers bundle:
`dist/server/index.mjs` (Worker, server functions + SSR) and `dist/client` (static assets).
Root `wrangler.jsonc` deploys that output as a **Worker with static assets** and adds the
required `nodejs_compat` flag (the bundle imports `node:async_hooks`, `node:buffer`, `node:stream`, `node:process`).
Always deploy with `-c wrangler.jsonc` — the generated `dist/server/wrangler.json` lacks that flag.

Scripts: `npm run cf:check` (build + dry run), `npm run cf:preview` (local workerd), `npm run cf:deploy`.

## Environment
| Name | Kind | Where |
|---|---|---|
| VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID | public, build-time | Build variables (CI env) |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY | server runtime (non-secret) | Worker variables |
| RESEND_API_KEY | **secret** | `wrangler secret put RESEND_API_KEY` |
| SUPPORT_EMAIL_FROM | optional | leave unset (defaults to `bestottr Support <support@bestottr.com>`) |

The database stays on the existing Lovable Cloud backend; no service-role key is used by app code.

## Steps
a. **GitHub**: connect the project to GitHub from Lovable (Project → GitHub) so the repo stays in sync.
b. **Cloudflare**: Workers & Pages → Create → Import a repository. Build command `npm run build`,
   deploy command `npx wrangler deploy -c wrangler.jsonc`. (Or locally: `npx wrangler login && npm run cf:deploy`.)
c. Add the build variables and Worker variables/secret above (Settings → Variables and Secrets).
d. Deploy; it serves at `bestottr.<account>.workers.dev`.
e. Run `MIGRATION_PARITY_CHECKLIST.md` against both the workers.dev URL and `https://bestottr.com`.
   Add the workers.dev URL to the backend's allowed auth redirect URLs before testing admin sign-in.
f. Only after parity passes: Worker → Settings → Domains & Routes → add `bestottr.com` (and `www`).
g. **Email**: do NOT delete or edit MX, `TXT` SPF/DKIM, or Email Routing records. Only the web
   `A`/`CNAME` records for `@` and `www` change. Resend DNS records stay as they are.
h. **Rollback**: remove the custom domain from the Worker and restore the previous `@`/`www` records
   pointing to Lovable hosting (note them down before step f). Email records are untouched either way.

## Runtime audit
- No `fs`, `Buffer` or `require` in app server code; `crypto.randomUUID` and `AbortSignal.timeout` are Workers-native.
- Roblox APIs, Community page extraction (`fetch` with `redirect: "manual"`, Roblox-only hops) and Resend HTTPS calls are plain `fetch` — Workers-compatible. Removed an unneeded `credentials: "omit"` option (server fetch never sends cookies; Workers may reject the field).
- Support tickets still go through the `submit_support_ticket` RPC inside a server function.
- `process.env` is read only inside handlers (populated by `nodejs_compat`).
- Verified locally in workerd (`wrangler dev`): `/`, `/listing/…`, `/user/…`, `/support`, `/admin/support`, assets → 200.

## Known limitation (unchanged)
The Experience/Community ownership monitor still runs in the buyer's browser (demo). A real server-side
monitor could later run the same `src/lib/transfer.ts` engine from Cloudflare Cron Triggers or Queues;
that is out of scope for this migration.

## Optional CI
Cloudflare's native Git integration (step b) is preferred: no GitHub secrets needed.
