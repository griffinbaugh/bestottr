# BestOttr Trustap setup

BestOttr now targets **Trustap Protection** for protected purchases. This release is a complete sandbox integration for two-account testing; it does not open live checkout or send real money. The earlier Escrow.com sandbox patch is superseded; this patch replaces its code and redirects the old account bookmark to Payments. Saved listings and Roblox account links are retained.

## 1. Request Trustap sandbox access

[Request integration access](https://www.trustap.com/contact-us). Trustap's [API-key instructions](https://docs.trustap.com/docs/intro/auth) say an integration specialist invites you to its dashboard and provides sandbox credentials. There is no self-service key-generation step we can complete from BestOttr.

Provide these requirements:

- BestOttr (`https://bestottr.com`) is a marketplace for Roblox experience/community ownership transfers and downloadable development projects, sometimes sold together.
- We need **Trustap Protection**, with buyer funds held before delivery, not the instant-release Trustap Checkout product.
- For ownership transfers, BestOttr independently verifies the exact asset's owner against the buyer's linked Roblox identity, then confirms delivery. Request **no additional post-verification complaint/inspection delay**, subject to their approval. Ask for the exact account configuration and authorization needed for platform-confirmed delivery.
- File buyers download and check the frozen files before explicitly confirming receipt. Downloads alone never confirm delivery. Any provider complaint period must be stated at checkout.
- Confirm supported buyer/seller countries, permitted asset categories, payout onboarding, dispute responsibilities, all transaction/monthly/onboarding/payout fees, and permissions for offline transaction creation, seller payment acceptance and buyer delivery confirmation.
- Ask for the sandbox client ID, API key (`capi_test_...`) and client secret (`cs_test_...`). If transaction `client_id` differs from the OAuth client ID, have them clarify this before testing; this integration validates that identity and fails closed on a mismatch.

The public v2 API has **no per-transaction inspection-period override or direct release endpoint**. The app does not invent either. Trustap must configure any no-delay release policy. BestOttr shows the actual provider deadline and only marks payment complete when Trustap reports funds released. Bank payout/KYC timing is separate from delivery confirmation.

## 2. Deploy the code

Upload `bestottr-trustap-sandbox.patch` to the root of your Codespace repository. From current main, run:

```bash
 git switch main
 git pull --ff-only origin main
 git switch -c feature/trustap-sandbox
 git apply --index bestottr-trustap-sandbox.patch
 git commit -m "Add Trustap protected-payment sandbox"
 git push -u origin feature/trustap-sandbox
```

Open a pull request, check its build results, merge and wait for the Cloudflare production deployment. If patch application reports a conflict, stop and reconcile the changed base; do not force it. This patch is prepared against main `951c848` (PR #12, including the earlier Escrow.com sandbox) and includes the migration history files already recorded in Supabase.

**Database setup is already applied.** The Trustap migration's recorded version is `20261022132334`. Do not paste or reapply SQL. The old Escrow.com tables remain isolated and unused, and the listing-preparation migration filename now matches remote version `20261021231743`. Those history files are included for consistency, not new execution.

## 3. Configure Trustap dashboard and Cloudflare

In the **Trustap sandbox dashboard**, register these exact URLs:

| Setting                       | URL                                                |
| ----------------------------- | -------------------------------------------------- |
| OAuth callback / redirect URI | `https://bestottr.com/api/trustap/callback`        |
| Hosted payment return URI     | `https://bestottr.com/account/payments`            |
| Webhook URL                   | `https://bestottr.com/api/trustap/sandbox/webhook` |

Set webhook HTTP Basic Authentication with a dedicated username and a random password of at least 32 characters. Keep it separate from the API key and OAuth secret.

In **Cloudflare → Workers & Pages → bestottr → Settings → Variables and secrets → Production runtime**, add:

| Name                            | Type     | Value                                                    |
| ------------------------------- | -------- | -------------------------------------------------------- |
| `TRUSTAP_SANDBOX_ENABLED`       | Variable | `true`                                                   |
| `TRUSTAP_CLIENT_ID`             | Variable | Trustap client ID                                        |
| `TRUSTAP_SANDBOX_API_KEY`       | Secret   | Test API key beginning `capi_test_`                      |
| `TRUSTAP_SANDBOX_CLIENT_SECRET` | Secret   | Test client secret beginning `cs_test_`                  |
| `TRUSTAP_OAUTH_STATE_SECRET`    | Secret   | Independent random value, at least 32 characters         |
| `TRUSTAP_WEBHOOK_USER`          | Secret   | Webhook Basic username                                   |
| `TRUSTAP_WEBHOOK_PASSWORD`      | Secret   | Matching webhook Basic password                          |
| `TRUSTAP_SYNC_SECRET`           | Secret   | Another independent random value, at least 32 characters |

Save and deploy. Keep these values out of Git, chat, frontend code and `VITE_` variables. Existing Supabase/Roblox server settings remain required. Escrow.com credentials are unused by this patch.

The app enforces test API/OAuth key prefixes and fixed test origins. It cannot be switched to live processing simply by changing the keys. Production credentials and a verified live policy require a separate reviewed release.

## 4. Enable reconciliation

Trustap's [webhook documentation](https://docs.trustap.com/docs/concepts/webhooks) states failed webhooks are not automatically retried. The app authenticates events, records a pending flag, and obtains the transaction through the API before acting. Event bodies and payment redirects never certify funding.

The supplied GitHub workflow calls the protected reconciliation endpoint every ten minutes when enabled. In your repository, open **Settings → Secrets and variables → Actions**:

1. Add the repository **secret** `TRUSTAP_SYNC_SECRET`, with the same value as the Worker runtime secret.
2. Add the repository **variable** `TRUSTAP_SANDBOX_SYNC_ENABLED` with value `true`.
3. After merge, run **Actions → Trustap sandbox reconciliation → Run workflow** once and check success.

Each run checks up to five active or pending orders, oldest checked first. GitHub schedules can be delayed, so this is a sandbox recovery mechanism, not an instant-settlement guarantee. Failed jobs must be investigated. At higher scale, use a dedicated monitored queue/scheduler before live launch.

Participants can always use **Check status** and **Verify buyer ownership & confirm delivery** immediately. Every buyer download independently checks Trustap again, even if a notification was missed. For Roblox orders whose seller has accepted payment, the webhook/reconciliation path automatically checks fresh buyer ownership and confirms delivery on a match. BestOttr adds no inspection timer after that verification; Trustap still controls actual release.

## 5. Run the two-account test

Use disposable files and Roblox assets. Never use real banking details or valuable assets to validate sandbox behavior.

1. Sign in as the seller's verified BestOttr admin account. Go to [Payments](https://bestottr.com/account/payments) and select **Connect Trustap sandbox**. Complete Trustap's OAuth consent, then its linked sandbox payout setup. Identity claims are signature/issuer/audience/nonce checked; provider tokens are not stored.
2. Sign in as a second verified BestOttr account in a separate browser session. Connect that account's own Trustap sandbox identity. Neither participant ID can be typed into an order form, and one Trustap identity cannot be linked to multiple BestOttr accounts.
3. As seller, save a fixed-price draft with a small ready test deliverable. In Payments, select that draft and the buyer's BestOttr handle, then **Prepare test order**. The app freezes the title, price, participant identities and private file copies before opening checkout. The fees are fetched from Trustap, not assumed to be the advertised headline rate.
4. As buyer, open Payments, review price/fees/total, then open **Trustap test checkout**. Use the provider's test-payment instructions. The return page does not authorize delivery.
5. Select **Check status**. Before verified held payment, downloads must remain disabled. As seller, select **Accept held test payment**. Repeating this first reconciles provider state and does not repeat an already completed acceptance.
6. For a file purchase, download and inspect the deliverable, then select **Confirm files received** and explicitly confirm. Merely generating a signed link never reports successful receipt. The app then shows Trustap's actual release/deadline status.
7. For an experience/community, both BestOttr accounts also need linked Roblox identities. Creation freshly checks the seller owns the exact asset and pins the buyer's Roblox ID. After test funding/payment acceptance, transfer a disposable asset, then select **Verify buyer ownership & confirm delivery**. A lookup failure, different asset, different owner, new dispute or refund must prevent delivery confirmation. Background reconciliation can perform the same check.
8. Use Trustap's sandbox application/dashboard to exercise review, cancellation, refunds and complaints. Reconcile and verify blocked states prevent new downloads and delivery actions. Previously downloaded bytes cannot be revoked. Completion must reflect Trustap's released-funds flag, not a local timer or buyer redirect.
9. Modify/remove an original draft attachment and verify the order still serves its own frozen copy. A seller or unrelated account must not obtain the buyer's download capability.

Hosted checkout, OAuth permissions, zero-delay release configuration, test funding and payout onboarding still require an actual Trustap account test. Automated fixtures do not prove provider approval or that the hosted flow has succeeded.

## Recovery and operating limits

- Creation has a stable request key and one active checkout per seller/buyer/draft. If a creation response is uncertain, **never repeat the creation POST**. Find the existing transaction in the Trustap dashboard using the BestOttr order UUID embedded in its description. The seller/admin can enter that existing `tx_...` ID and reconcile it. The server GET must match pinned participants, description, client, amount and fees before it is attached. An unrelated ID cannot authorize the order.
- A preparation can be discarded only before checkout creation. This does not cancel a provider transaction. Never use deletion as a payment-cancellation mechanism.
- Provider actions are serialized with a database lease. If delivery or acceptance times out, the next attempt reads provider state before sending another command; no release is inferred from an error.
- Uploaded files are private and not malware-scanned. Discarded snapshots remain private and tracked. Aggregate order-storage quotas, lifecycle cleanup and malware screening remain launch work.
- Live trading, public publication, auctions and platform commissions remain disabled/unconfigured. Current test transactions require staff creation; this is not unrestricted public checkout.
- Disable the Worker flag and the GitHub sync variable to stop sandbox operations. This does not cancel provider transactions already created.

## Verification

The unit/UI suite, TypeScript, targeted lint, production build and Cloudflare dry run pass. Database checks ran transactionally in the owner-controlled database and rolled back QA rows. They verify participant-only reads, blocked anonymous access/client writes, hidden account mappings/storage paths, sandbox-only constraints and serialized state commits. All four Trustap tables have RLS enabled; its deliverables bucket is private.

Security advisors add only informational no-policy notices for the deliberately server-only account/files tables, whose client grants are revoked. Existing unrelated support-RPC and leaked-password warnings remain unchanged.

Primary references: [authentication](https://docs.trustap.com/docs/intro/auth), [full-user OAuth](https://docs.trustap.com/docs/guides/transactions/full-users), [card-payment lifecycle](https://docs.trustap.com/docs/guides/transactions/transaction-int-path-cc), [webhooks](https://docs.trustap.com/docs/concepts/webhooks), [v2 API schema](https://docs.trustap.com/apis/trustap-openapi-v2.yaml).
