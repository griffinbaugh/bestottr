# BestOttr maintenance

- The owner requires independence from Lovable. Use local code changes, GitHub, Cloudflare Workers, the owner-controlled Supabase project, and Resend. Do not use a managed editor agent for implementation or reintroduce editor-specific build/runtime dependencies.
- Preserve published Git history. Never force-push or rewrite it.
- The backend migration is not complete until existing tickets are copied and verified in the owner-controlled Supabase project. Keep exports and credentials out of Git.

- Keep seller listing prices in integer cents through the shared CurrencyInput and convert only when creating a listing; verified financial metrics retain their existing input model.
- Keep auction scheduling in the shared auction-end helpers, validate again at publication, and store absolute millisecond timestamps so countdowns remain independent of display modes.
- Treat bestottr.com (root) as the canonical hostname with www redirecting to it, so generated metadata, canonical/OG URLs and share links point at the canonical host rather than a preview host; while the domain is not yet live, use the Cloudflare workers.dev URL.
- Support tickets are created only through the security-definer `submit_support_ticket` RPC (called from a server function with validation + honeypot); the table has no public insert/select, and admin reads/updates are gated by `has_role(..., 'admin')` RLS. Why: public users must never enumerate tickets.

- Support ticket emails send through Resend (RESEND_API_KEY, direct HTTPS API) via `deliverTicketEmails` in `src/lib/support-email.server.ts`; inbound support@ stays on Cloudflare Email Routing. Why: the owner chose Resend for outbound.

- Experience galleries use ordered source-tagged entries and a shared cover resolver; legacy image-only listings normalize at read time. Why: preserve existing marketplace assets and stable listing IDs.
- Public Roblox metadata is fetched through a server function only after the separate strict demo ownership verifier passes; metadata never authorizes ownership. Why: avoid CORS without weakening verification.
- The demo marketplace keeps uploaded images in IndexedDB behind a replaceable media adapter and stores durable references in its existing local listing state, not object URLs. Why: persist uploads across reloads without implying hosted or cross-device storage.
- Experience edits pass through a field allowlist and the demo current-seller check; IDs, seller, verified identity, bids and status remain immutable. Why: update an existing listing without changing its ownership or public link; production account authorization remains outside this demo marketplace.
- Experience deal money movement goes only through the pure transfer engine (`src/lib/transfer.ts`) and the PaymentProvider interface; UI/store actions never release or refund directly. Why: payout must follow verified Roblox ownership, exactly once. The demo monitor runs client-side from persisted timestamps; production must run the same engine in a server scheduler.
- Community banners come from a best-effort server-side public Community page extractor (`src/lib/community-page-media.ts`), restricted to https Roblox/rbxcdn hosts; the official thumbnails API stays the icon source, and page data never changes identity/owner. Why: Roblox has no documented banner API.
- Community banner/icon geometry (icon bottom-aligned inside the banner) lives only in the shared `CommunityBanner` component. Why: consistent card/detail/preview composition.
- Self-hosting on Cloudflare deploys the standard build output with root `wrangler.jsonc` (adds nodejs_compat); see MIGRATION_CLOUDFLARE.md. Why: generated dist/server/wrangler.json lacks required flags.
