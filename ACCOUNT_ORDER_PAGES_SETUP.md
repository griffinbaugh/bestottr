# Buying, Selling and private orders

This update replaces the production demo dashboards with account-backed pages. It does not redesign the listing editor or enable public purchases.

## Deploy

Upload `bestottr-account-orders.patch` into `/workspaces/bestottr` in your GitHub Codespace. Commit any unrelated tracked work first, then run:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/account-order-pages
git apply --index bestottr-account-orders.patch
git commit -m "Connect Buying Selling and private order pages"
git push -u origin feature/account-order-pages
```

Open the pull request, wait for its build check, merge it, then wait for the Cloudflare `main` deployment to reach Ready. Use a new branch name if one already exists. If the patch reports a conflict, resolve it before committing; do not force application.

The patch is based on `3f140a8` (merged listing-review PR #14). There is **no new Supabase migration, Cloudflare variable, Wrangler setting or Trustap credential required to deploy these pages**. Keep existing publication/payment switches as configured; this patch does not turn them on.

## What changes

- **Buying** (`/dashboard`) shows the signed-in buyer's Trustap sandbox orders, their provider-derived status, test buyer total including fees, and links to private orders. Results paginate 25 at a time.
- **Selling** (`/seller`) shows the signed-in seller's saved drafts, review status and feedback, plus their sandbox sales and test proceeds after seller fees. Manage listing details through the existing Sell page. A private approval is labeled **Approved — not public**.
- **Private order** (`/deal/<order-id>`) loads one order only after verifying that the signed-in account is its buyer or seller. Admin status alone does not grant access to another account's order. The page reuses the existing Trustap test payment, delivery, download and reconciliation controls.
- Experience/community orders explain **Roblox ownership transfer**. No game file upload or download is required. A downloadable project instead uses private files and explicit buyer receipt confirmation.
- The Payments page links to each private order. Private order pages keep payment-account setup and admin test-order creation on the separate Payments page.
- These private pages are marked `noindex`. Production routes do not show the old sample bids, acquisitions, revenue or file receipts.

All displayed transactions remain explicitly labeled sandbox tests. They are not real payments, protected balances or revenue. A displayed status is the last verified provider state; refresh/check status to reconcile it. Actions still require the existing server authorization, provider checks and order lease. Downloading a file does not confirm receipt or release payment.

## Acceptance checks after deployment

1. Sign in and choose **Selling**. Confirm your saved listing and review status appear. **Manage in Sell** opens the existing editor; it does not choose or alter a draft automatically.
2. Choose **Buying**. With no sandbox orders yet, an empty test-order message is expected. No sample purchases or fake balances should appear.
3. Open Payments. Existing Trustap connection and admin test-order preparation still work as before once sandbox credentials are configured. See TRUSTAP_SETUP.md for those separate requirements.
4. Once you have a sandbox order, open it from Buying, Selling or Payments. Confirm the title, amount, fees, status and history match. Ownership transfers must show the pinned buyer Roblox ID and ownership verification controls; file-project orders must show file delivery instead.
5. Before confirmed test funding, downloads must remain disabled. File receipt requires its own confirmation. For a Roblox transfer, use only disposable test assets and transfer only after the provider confirms accepted payment; a fresh exact-asset match to the pinned buyer is required to confirm delivery.
6. Sign in with an unrelated account and visit the same `/deal/<order-id>` URL. It must not show the order, history or files. A signed-out visit should ask for sign-in. An unrelated admin account must also be denied participant details.
7. Refresh activity/status after actions. Orders appear only on the relevant buyer or seller side. If a request fails, the dashboard shows an error instead of claiming there are no purchases.

You can complete checks 1–2 while waiting for Trustap. Two-account payment/delivery checks require Trustap sandbox access. Live checkout, auctions/bidding, live-provider onboarding and automated production settlement remain separate work.

## Validation

310 automated tests passed across 38 files, including account-derived filters, private order authorization ordering, pagination lookahead, buyer fee totals, seller review labels, ownership-versus-file messaging and existing Trustap payment/delivery regressions. TypeScript, targeted lint, the production build and Cloudflare deployment dry run passed. A read-only database query verified the dashboard projection against the existing order schema. No schema, account, order or payment data was changed by this release.
