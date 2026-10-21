# BestOttr

Marketplace for Roblox experiences, communities and digital assets. Source is maintained in GitHub and hosted on Cloudflare Workers. Database and staff authentication are being migrated to an owner-controlled Supabase project; outgoing support email uses Resend.

## Development

Use Node.js 22 and npm. Copy `.env.example` to `.env` and supply your own Supabase project's public settings.

```sh
npm ci
npm run dev
```

## Verification and deployment

```sh
npm test
npx tsc --noEmit
npm run cf:check
```

Cloudflare Git builds use `npm ci`, `npm run build`, and `npx wrangler deploy -c wrangler.jsonc`. See [MIGRATION_CLOUDFLARE.md](MIGRATION_CLOUDFLARE.md) for configuration and backend cutover requirements.

Marketplace transactions, payments, ownership monitoring and uploaded media retain their existing demo behavior and local persistence. Support tickets and staff authentication use Supabase.
