# BestOttr escrow sandbox setup

This release adds test checkout, provider status reconciliation, private file delivery and Roblox transfer observations. It never sends money to a live endpoint. Public purchases and auctions remain disabled.

## 1. Deploy the patch

Upload `bestottr-escrow-sandbox.patch` to the root of your Codespace repository. In its terminal, run:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/escrow-sandbox
git apply --index bestottr-escrow-sandbox.patch
git commit -m "Add escrow sandbox checkout and delivery"
git push -u origin feature/escrow-sandbox
```

Open a pull request into `main`, check its results, then merge. Wait for the production Cloudflare deployment to finish. The patch was prepared against main `f9e8a56`; if application fails, stop and resolve the changed base before continuing. Do not force the patch or push.

The additive database migration is already applied to your owner-controlled Supabase project. Its recorded version is `20261022004300`. Do not paste or rerun SQL. The source also renames the previously applied listing-preparation migration to match remote history; that is a filename alignment, not a second migration.

## 2. Connect a sandbox account

Use [Escrow sandbox](https://www.escrow-sandbox.com) and its account API settings to create a dedicated broker test account and API key. Use separate sandbox buyer and seller accounts/emails; neither may equal the broker email. Follow the provider's sandbox account and simulated funding instructions. This does not establish approval for real-money transactions.

In Cloudflare, open **Workers & Pages → bestottr → Settings → Variables and secrets**, using the **Production runtime** settings. Add:

| Name | Type | Value |
| --- | --- | --- |
| `ESCROW_SANDBOX_ENABLED` | Variable | `true` |
| `ESCROW_SANDBOX_EMAIL` | Secret | Sandbox broker account email |
| `ESCROW_SANDBOX_API_KEY` | Secret | That account's sandbox API key |

Save and deploy the updated Worker configuration. These are server runtime values. Do not prefix them with `VITE_`, commit them, or paste them in chat. Existing Supabase and Roblox server credentials must remain configured.

Sign into your BestOttr admin account and visit [Escrow sandbox](https://bestottr.com/account/escrow). Select **Connect sandbox updates** once. This registers `https://bestottr.com/api/escrow/sandbox/webhook` with the sandbox broker. Existing matching registrations are reused. If this fails, resolve the displayed account/API error before testing automatic updates; manual status reconciliation is available.

## 3. Test a file purchase first

1. Create a second, verified BestOttr account for the buyer, with its own handle. The seller must be an admin; seller and buyer must differ. Complete MFA when required.
2. As the seller, save a fixed-price file draft with a small harmless test deliverable. Make sure every attached file is ready, rather than still uploading.
3. Open `/account/escrow`. Select the draft, enter the buyer's BestOttr handle, the dedicated Escrow sandbox buyer/seller emails, and the inspection period. Create the test order. The price and current deliverable copies are frozen for that order.
4. In a separate browser session, sign into the buyer's BestOttr account and visit `/account/escrow` directly. The navigation shortcut is staff-only, but the authenticated buyer can access their test order at this address.
5. Open the buyer's hosted sandbox checkout. Complete the sandbox agreement and simulated funding steps on the provider site. Never enter real banking information for this test.
6. Back on BestOttr, select **Check status** and **Refresh orders** as needed. Returning from checkout alone does not prove payment. Before verified funding, downloads must remain unavailable.
7. After the provider confirms secured test funds, download the test file as the buyer. Each download performs a fresh provider check before issuing a 60-second attachment link. An unrelated account and the seller cannot use the buyer-download endpoint.
8. Edit or remove the original draft attachment and confirm the buyer still receives the frozen order copy. Use only disposable test files.
9. Exercise acceptance, cancellation, returns and disputes through the provider's sandbox tools where supported. Reconcile again and confirm risk/refund states block new downloads. Previously downloaded bytes cannot be revoked.

Provider notifications update stored status; **Refresh orders** loads it into the page. The webhook accepts only small event hints, locates a known order and obtains authenticated transaction details before changing state. Temporary reconciliation failures return 503 for provider retry. No unsigned webhook body is treated as proof of funds.

## 4. Test an experience or community transfer

Use a disposable Roblox asset, two linked BestOttr accounts and a fixed-price draft. Creation requires fresh ownership verification for the seller and pins the buyer's linked Roblox identity. After verified sandbox funding and a genuine test transfer, run the ownership check. It must report the pinned buyer as owner before recording a successful observation.

This observation does not accept goods, end an inspection period, release funds or trigger a refund. The sandbox integration has no automatic settlement scheduler. Use the provider's sandbox controls to test the remaining lifecycle.

## Recovery and limits

- If creation times out, keep the existing order and use its reconciliation action. Recovery uses GET with the same reference; it never repeats an uncertain creation POST. Do not create replacement orders until the original outcome is resolved.
- A preparation that failed before provider creation can be discarded. This does not cancel an existing provider transaction. Discarded preparation copies remain private and tracked for future cleanup.
- API errors, mismatched amounts/parties, incomplete provider responses and unavailable ownership APIs fail closed. Preserve the order and investigate rather than bypassing verification.
- This release uses a test-only goods category mapping. Live provider eligibility, correct commercial classification and business approval remain separate work.
- Uploaded files are not malware-scanned. Aggregate order-copy quotas, scheduled storage cleanup, public moderation, live commissions, auction bidding and automated settlement remain launch work.
- To stop new sandbox operations, set `ESCROW_SANDBOX_ENABLED=false` and redeploy. This does not cancel transactions already held by the sandbox provider.

## Validation

236 unit/UI tests, TypeScript, the production build and Cloudflare dry run pass. Transactional database checks cover participant isolation, blocked client writes/sensitive reads, sandbox-only constraints and state lease concurrency. Provider transport tests use fixtures; actual hosted checkout and simulated funding still need the credentials and two-account test above.

API references: [basics](https://www.escrow.com/api/docs/basics), [EscrowPay](https://www.escrow.com/pay/docs), [transaction reference](https://www.escrow.com/api/docs/reference), [webhooks](https://www.escrow.com/api/docs/webhooks).
