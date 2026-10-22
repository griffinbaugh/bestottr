# Trustap protected-payment sandbox (2026-10-22)

Trustap Protection is now the selected provider, superseding the earlier Escrow.com sandbox patch. The new code is isolated to fixed test API/OAuth/checkout hosts; public checkout and real money remain disabled. [TRUSTAP_SETUP.md](TRUSTAP_SETUP.md) contains deployment, credentials and the full two-account test.

Implemented full-account OAuth with PKCE, encrypted browser-bound state, signed ID-token validation and unique server-owned identity mappings; real API fee quotes and exact-cent binding; frozen private order deliverables; participant-only access; authenticated webhook hints; durable pending flags and opt-in GitHub scheduled reconciliation; and duplicate/uncertain transaction recovery without repeating creation. File receipt requires buyer confirmation. Roblox delivery requires fresh exact-asset ownership verification for the pinned buyer and a second provider check before confirmation. No extra BestOttr inspection timer is added. Trustap configuration determines its own complaint period/release; only authenticated provider release status marks payment complete.

The migration is already applied to the owner-controlled project at recorded version `20261022132334`; do not reapply it. Transactional SQL tests passed with all QA rows rolled back. Account-mapping and file tables intentionally deny all client access, producing informational no-policy advisor notices; no new advisor WARN was introduced. Legacy Escrow.com tables remain unused and are retained in source solely to match applied migration history.

Sandbox invitation/credentials, provider permissions, hosted checkout and an approved no-delay transfer configuration remain external validation steps. The public API has no per-transaction complaint-duration override; do not claim instantaneous bank payout or bypass disputes/compliance checks. Live approval, public trading, auctions, commissions, scheduled file cleanup/quotas and malware screening remain launch work. Earlier sections below are historical release records; this section describes the current provider choice.

---

# Listing preparation release (2026-10-21)

**Status: code prepared and tested; production migration is not applied.** Automatic approval review rejected the production schema change and requires explicit approval of the exact migration before it may be applied. Do not deploy this patch before the database migration succeeds. No provider has been selected; paid checkout, public publication, auctions accepting bids, purchase entitlements, instant buyer downloads, and experience/community settlement remain closed. This release does not claim those systems are operational.

## Included behavior

- File-product drafts without requiring a Roblox link or claiming Roblox ownership; existing experience/community ownership checks remain required.
- Up to eight PNG/JPEG/WebP listing images (5 MB each), persistent cover selection, atomic gallery reordering, deletion confirmation, and a private listing preview showing current edits.
- Up to three ZIP/Roblox model/place deliverables (50 MB each) attached to private drafts; pending uploads are visible for recovery/removal. Seller download links expire after 60 seconds and force attachment downloads. No file content is extracted or executed. Uploaded deliverables are not malware-scanned or approved for sale.
- Two private Storage buckets, no client Storage policies, service-authorized scoped uploads without overwrite. Finalization compares actual Storage size/content type to the reservation and checks image signatures. Auth and MFA are checked for every operation; table RLS restricts seller reads, and direct client writes/RPC execution are denied.
- Account quota 150 MB across recorded reservations; per-draft counts are enforced inside a serialized server-only SQL function. Signed upload capabilities last two hours per Supabase, and signed image previews last one hour. Removing a draft deletes tracked Storage objects first. Production lifecycle cleanup of expired reservations/unreferenced objects should be added before high-volume launch, since an already issued upload capability can outlive a removed draft.
- Auction closing dates can be selected exactly in the seller's local timezone or as 1/3/7/14/30 days from saving. The canonical database value is an absolute epoch timestamp; server saves reject a past selected time. Drafts do not start auctions. Publication must revalidate the closing time and use fresh authoritative ownership verification.
- Preparation checklist for title/description, images, positive price, closing time, deliverables and pending uploads. Checkout and publication controls remain disabled.

## Deployment sequence

1. Obtain explicit approval and apply `supabase/migrations/20261021222550_listing_preparation_media.sql` to the owner-controlled project. It relaxes Roblox-only fields solely for the new file kind and adds an equivalent stricter identity check for existing kinds, two draft columns, the asset table/RLS/indexes, server-only quota/order RPCs and two private buckets. No existing rows, support data or account settings are deleted.
2. Verify the production schema, private bucket settings, function grants and advisor output. Record the remote migration version and align the source filename if Supabase assigned a different timestamp; never apply the same migration twice.
3. Apply `bestottr-listing-preparation.patch` on a branch from main `dc1c00a`, then push/merge after checks pass. Existing Worker Supabase variables suffice. This release does not require new keys.
4. Live test with the actual account: save a file draft, add an image and ZIP/model, refresh, reorder/select cover, inspect preview, test seller download, remove an upload, and confirm an unrelated account cannot read it. Also retest the existing experience and community drafts. Verify local-time auction end survives reload.

## Verification

208 unit/UI tests, TypeScript, production build and Cloudflare dry run pass. Local PostgreSQL (PGlite 0.5.11) executed the original and new migration and transactional SQL checks for file identity, quotas, ordering, owner reads, cross-account denial and blocked direct client writes/RPC calls. The baseline draft RLS regression also passes. Storage API behavior and deployed browser flow remain unverified until the production migration is approved and applied. No live payment test is possible before provider integration.

## Remaining launch work

Choose an approved marketplace payment/escrow provider for these product types, then implement seller onboarding, authoritative signed webhook processing with idempotency, paid order/auction settlement, immutable purchased file versions, buyer entitlements and signed downloads, refunds/disputes, authoritative Roblox transfer monitoring, moderated publication and scheduled auction closure. A file draft or client success screen must never grant a purchase entitlement. Keep the mock provider and demo transfer engine out of production money movement.

---

## Group lookup update (2026-10-21)

Production logs confirmed GROUP HTTP 429 from the single-group v1 lookup after the countdown update. Private draft verification now requests the documented groups v2 batch endpoint with exactly one group ID, validates exactly one returned group with the requested ID, and matches owner.id only when owner.type is User. Empty, duplicate, malformed, non-user and wrong-owner results fail closed. This replaces the v1 call; it does not retry alternate endpoints after a 429 or bypass cooldowns. No environment or database changes. The real Evergames response returned owner 18091355; deployed Cloudflare behavior still needs verification. If throttling persists, investigate shared request origins and an authenticated Open Cloud integration rather than repeatedly changing endpoints.

Patch: bestottr-group-lookup-fix.patch, based on main 8072454. Validation: ownership tests and Cloudflare workerd request checks; full suite/build results reported with delivery.

# BestOttr account release and launch readiness

## Roblox rate-limit handling

The live error `RBX-GROUP-429` establishes that the current failure is Roblox group API throttling. The existing draft card confirms an earlier save completed. The editor now receives Roblox's Retry-After duration (seconds or HTTP date, default 60 seconds when absent/invalid), disables only the save button with a countdown, preserves edits while waiting, and remembers the retry deadline across reloads in the same browser tab. No automatic repeated save is sent.

Each Worker combines concurrent identical draft verification requests and reuses a successful proof for the same linked user, kind and parsed asset ID for at most 15 seconds. The original ownership_checked_at timestamp is preserved. Both retained-success and pending-request maps are bounded. Failures are never cached as ownership; expired proofs cannot authorize a save when Roblox fails. A 429 pauses additional draft checks in that Worker until the provider deadline. Every request still authenticates, checks the existing draft belongs to the account, and reloads the current linked Roblox identity before verification. This gate applies only to private drafts, never publication, payment or settlement. It reduces rapid repeat lookups; it does not increase Roblox's quota or coordinate all Worker instances globally.

Apply `bestottr-roblox-rate-limit-fix.patch` after the diagnostic release. No database or environment changes are needed. Validation: all 187 tests and TypeScript pass, including retry headers, concurrent checks, identity separation, expired-proof denial, server cooldown enforcement, UI countdown and reload behavior. The workerd regression script, production build and Cloudflare dry run also pass. Wait for an existing Roblox cooldown to expire before retesting on production.

## Roblox request diagnostics

The diagnostic release independently checked the place-to-universe and Evergames group-owner lookups through the live Worker's read-only functions. Ownership request errors include `RBX-PLACE-{status}`, `RBX-UNIVERSE-{status}`, or `RBX-GROUP-{status}`; timeouts/network errors have distinct codes. Worker logs contain only stage/status (or network category), never sessions, provider tokens or upstream response bodies. The subsequently reported GROUP-429 is addressed by the draft-only rate-limit handling above.

## Private listing drafts

Production `/sell` now lets a signed-in, email-confirmed user with a linked Roblox account create, edit and delete private experience/community drafts. The server loads the OAuth-linked identity on every save and obtains an ownership proof through the draft-only gate described above. Direct ownership or ownership of the creator group is required; membership/admin roles, demo fixtures and browser-supplied identity never authorize a draft. A draft records when the ownership check happened; this does not establish perpetual ownership or transfer readiness.

Drafts contain a title, description, proposed fixed price or auction starting bid, and an optional reserve. Prices stay in integer USD cents. Drafts are private to their seller, persist across devices and cannot receive bids/payments or appear in public search. Auction timing, galleries, file uploads, moderation/publication, checkout and settlement remain separate launch work.

The additive `production_listing_drafts` migration was already applied to the owner-controlled project. Do not reapply it manually. Its source version matches remote migration history. Deploy the supplied `bestottr-listing-drafts.patch` on a new branch from current `main`; no additional environment variables are needed beyond the working Roblox link and Supabase server key.

Validation: 164 unit tests, TypeScript, production build and Cloudflare dry run pass. The 21 new checks cover live ownership, unsafe URLs, malformed responses, group roles, session authorization, forged fields, cross-account edit denial and exact cents. Transactional SQL checks in `supabase/tests/listing_drafts_rls.sql` verify owner reads, cross-account/anonymous denial and blocked direct client writes; all temporary QA data is rolled back. Security advisors show no finding for the new table. Existing notices concern the deliberately callable support RPC, the inaccessible private payment table, and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

After deployment, visit `/sell`, save an owned experience, reload to confirm persistence, edit it, and test a different owner's game is rejected. These provider/API tests should be repeated with the actual linked account; automated network mocks cannot prove Roblox availability from Cloudflare.

Private-experience correction: use the documented public `develop.roblox.com/v1/universes/{universeId}` endpoint for creator identity instead of games/v1, which may hide private games behind content-restricted zero-ID placeholders. Public API inspection confirmed Fuse an Egg is a private/inactive universe owned by Evergames, whose actual owner matches the linked account. The verifier still validates the returned universe ID and positive creator/root-place IDs and checks the group owner; no user-provided identity or fixture authorizes a save. Regression tests cover the observed private response, a non-owner and invalid zero/missing creator IDs. All 172 tests, TypeScript and the local workerd check pass. Apply `bestottr-private-experience-fix.patch` after the redirect fix; no database/variable changes or publishing the game are required.

Cloudflare redirect correction: ownership fetches now use `manual` and reject non-2xx responses, including redirects. Workers rejects the standard `error` redirect option before issuing a request. All 170 unit tests and TypeScript pass, including six regression checks for Worker-compatible redirect mode and rejected 301/302/303/307/308 responses. `node scripts/check-listing-ownership-worker.mjs` also executes the helper in the actual local workerd runtime with fixture responses, checking successful group ownership and redirect rejection without live credentials. Production build and Cloudflare dry run pass. Apply `bestottr-ownership-redirect-fix.patch` after the listing-drafts release; no database or variable changes are needed.

This release adds real Supabase accounts. It does **not** open trading or accept money. No escrow or payment provider has been selected. Production ignores local demo settings and starts with no sample listings, balances, deals or reviews.

## Included

- Signup, login, email confirmation/resend, password recovery and callback handling.
- Profile dropdown, account overview, public profile, email/password settings, authenticator enrollment and challenge, session sign-out, notification preferences.
- Private connected-account and verification pages. Roblox OAuth code uses state, PKCE and an encrypted browser-bound callback cookie; verified identity is written only by the server.
- Payment methods and deposits/payouts pages describe unavailable services without creating fake cards, balances or successful payments.
- Database profiles/preferences provision automatically. RLS and column grants restrict account edits. Roblox identity cannot be self-certified. Existing support tickets and admin permissions remain intact; enrolled MFA also protects staff ticket access.

## Publish this code

The additive account migrations were applied to the owner-controlled Supabase project `dkaqxhjoshlynuwxbwbu`. Do not reapply them manually. Their recorded versions match the files in `supabase/migrations`.

The GitHub connection has read access but its write operations return HTTP 403. Apply the supplied patch in the existing Codespace, based on the merged migration code:

```sh
git fetch origin
git switch -c launch/accounts-settings origin/main
git apply --index bestottr-accounts.patch
git commit -m "Add real accounts and prelaunch settings"
git push -u origin launch/accounts-settings
```

Open and merge the branch PR to trigger the existing Cloudflare build. If the apply check fails because main changed, resolve the differences before applying; do not rerun the earlier migration patch or force-push.

## Account email setup before public registration

In Supabase Authentication, configure:

- Site URL: `https://bestottr.com`.
- Allowed redirect URLs: `https://bestottr.com/auth/callback` and `https://bestottr.com/auth/callback?next=/reset-password`.
- Email signup and email confirmation enabled. Keep secure email change enabled (confirm both inboxes).
- Password minimum at least 12 characters; enable current-password requirement for password changes and leaked-password protection where available.
- Authenticator TOTP enrollment and verification enabled.
- Custom SMTP using the verified Resend domain. The existing Worker `RESEND_API_KEY` sends support mail; it does not automatically configure Supabase Auth.

Resend SMTP settings: host `smtp.resend.com`, port `465`, username `resend`, password a Resend API key entered directly into Supabase. Use a verified sender such as `support@bestottr.com` and sender name `bestottr`. Disable email click tracking for authentication links. Review Auth email rate limits and bot protection before public promotion.

Default Supabase mail delivery is restricted to project team addresses and is unsuitable for public registration. Documentation: https://supabase.com/docs/guides/auth/auth-smtp and https://resend.com/docs/send-with-supabase-smtp.

Test signup with a non-team email, confirmation in the originating browser (PKCE), logout/login, recovery, email change, MFA enrollment, logout/login MFA challenge, profile persistence across devices and staff queue access. The automated checks do not replace these provider-delivery tests.

## Enable Roblox identity linking

Register an owner-controlled Roblox OAuth application with `openid profile` scopes and the exact redirect `https://bestottr.com/api/roblox/callback`. Complete Roblox's application requirements before making it publicly available.

Set **Worker runtime variables** `ROBLOX_CLIENT_ID` and `SITE_URL=https://bestottr.com`. Set **Worker secrets** `ROBLOX_CLIENT_SECRET`, `ROBLOX_OAUTH_STATE_SECRET` (a securely generated random secret of at least 32 characters) and `SUPABASE_SERVICE_ROLE_KEY`. Existing runtime `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` must remain configured. Never put privileged values in `VITE_` variables or Git. Use the actual Supabase service-role/secret key, not the public publishable key.

The connection button stays disabled until server configuration is present. Linking starts only on the canonical host. Test consent, cancel, expiration, repeat linking and prevention of linking one Roblox identity to two BestOttr accounts. The server discards provider tokens after obtaining identity. Identity confirmation alone does not prove ownership of a listing.

## Remaining marketplace work

These are launch blockers, not features completed by this account release:

1. Select a payment/escrow provider that explicitly supports the business model, countries, Roblox digital-asset transactions and the required holding/release arrangement. Complete business onboarding and provider approval. Decide supported currencies, funding, refunds, disputes and payout rules before writing the adapter. Do not describe a conventional payment hold as escrow.
2. Extend the private production draft foundation to public listings, upload storage, moderation, bids and deal records with server authorization and ownership verification. The old local marketplace remains available only for deliberate local development/tests.
3. Implement the provider adapter, authenticated checkout, verified and idempotent webhooks, integer-cent ledger, reconciliation and provider-managed payment/payout destinations. Never store raw card numbers or bank credentials. Connect the existing pure transfer engine to durable transactions and a server scheduler; require verified ownership and exactly-once release/refund.
4. Exercise sandbox success/failure, duplicate events, concurrent bids, timeout, cancellation, refund and transfer mismatch. Keep money features closed until live credentials and provider onboarding are confirmed.
5. Complete business terms, privacy notice and transaction/refund policies for the actual operating model. Publish them before inviting users to transact.

No payment account, card token, payout destination or funded balance has been created by this release. Payment, payout and trading availability are hardcoded off server-side as well as gated in the UI.

## Verification

All 143 Vitest tests passed, including 11 email callback regression checks. TypeScript, the production build and the Cloudflare deployment dry run passed. Transactional Supabase checks passed for account bootstrap, owner edits, cross-account denial, preference isolation and blocked client-written Roblox identities; the test users were rolled back. Browser QA confirmed signup rendering and the unsigned-in account gate. Fresh-user confirmation delivery and signed-in settings still need end-to-end verification after the code is deployed and Supabase SMTP is configured.

Listings, uploads, instant file delivery/entitlements, inventory allocation, watchlists and participant messages still need production database/storage implementations. Auction settlement and ownership monitoring must run on a server scheduler. Those are separate from the account pages delivered here.

Email callback processing now has one owner: the callback page exchanges codes while automatic SDK URL detection is disabled. A real SDK regression test covers global session initialization before callback processing. Confirmation links can verify an email before a browser session is established; a confirmed account can sign in with its email/password, and requesting another signup confirmation is unnecessary. Provider delivery and cross-browser behavior still require real email testing after deployment.
