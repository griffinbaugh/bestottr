# Listing review and publication setup

This patch adds real seller submissions and admin moderation to BestOttr. It runs independently of Trustap, whose sandbox remains off until credentials arrive.

## Deploy the code

Download `bestottr-listing-review.patch` into `/workspaces/bestottr` in your existing GitHub Codespace. Start with your tracked work committed and a clean working tree. The uploaded patch itself may remain untracked.

Run in the Codespace terminal:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/listing-review
git apply --index bestottr-listing-review.patch
git commit -m "Add frozen listing review and publication controls"
git push -u origin feature/listing-review
```

Open the pull request GitHub offers, inspect the changes, wait for its build check, then merge into `main`. If a branch with that name already exists, choose a new branch name. If `git apply` reports a conflict, stop and resolve it before committing; do not force or partially apply it.

The patch is based on `045caaf70677904778c208f025ac230e53a524d3` (Trustap PR #13). The original patch file is not part of the commit.

## Cloudflare

1. Open Workers & Pages → bestottr → Settings → Runtime variables and secrets → Production.
2. Add the **Variable** `LISTING_PUBLICATION_ENABLED` with value `false`. It is server runtime configuration, not a `VITE_` variable and not a build variable. Missing also defaults to false.
3. Keep `TRUSTAP_SANDBOX_ENABLED=false` and preserve existing Supabase, Roblox and Resend configuration. No Trustap credentials are needed for listing reviews.
4. After merging the code, open Deployments and confirm the latest `main` build reaches Ready. If the variable change creates an earlier deployment, the code merge must still deploy afterward.
5. Refresh `https://bestottr.com/sell` and `https://bestottr.com/admin`.

`wrangler.jsonc` already has `keep_vars: true`. No further Wrangler change is required for this runtime variable. No credentials belong in the patch or in browser-visible variables.

## Supabase is already prepared

Migration `20261022142214_listing_review_publication.sql` has already been applied to the owner-controlled project `dkaqxhjoshlynuwxbwbu`. Its matching file is included to keep Git and migration history aligned. Do **not** paste or rerun this migration in the SQL editor.

The new bucket `bestottr-review-assets` is private. It has no public download or client upload policies. The new review RPCs are service-only, and review reads require the seller or an actual database admin role plus the account MFA policy. Ordinary accounts cannot approve their own submissions by changing browser fields.

## Seller acceptance check

1. Sign in, open **Sell**, and select **Edit** on an existing saved draft. For a Roblox listing, use the linked account that currently owns the game or community. File projects do not claim Roblox ownership.
2. Save a title, description and positive price. Upload at least one completed PNG/JPEG/WebP listing image. A file listing also needs a completed deliverable file. Finish uploads before submitting.
3. Check the rights confirmation and choose **Submit saved listing for review**, then **Confirm submission**. Only the saved version is submitted; save editor changes first.
4. Verify the status becomes **Awaiting review**. Details, media and deletion should be locked. **View submitted version** should show the frozen text, images and private review files.
5. To change anything, choose **Withdraw to edit**, confirm, make and save edits, then submit again. The old approval never authorizes the changed version.
6. Use **Refresh review status** after moderation. **Approved — not public** is expected with publication disabled.

Roblox checks at submission are fresh and may return a real provider cooldown. An error does not approve a listing. If preparation is interrupted, refresh status; a seller can withdraw a stuck **Preparing review** version and resubmit. Do not repeatedly submit during a provider cooldown.

## Admin acceptance check

1. Sign in with your existing BestOttr admin account and open `https://bestottr.com/admin`.
2. In **Awaiting review**, select a submission. Inspect its exact text, price, Roblox asset, images and private attachments. File downloads are explicit, short-lived attachments; files have not been malware-scanned.
3. Choose **Request changes**, enter at least 10 characters of useful feedback, and confirm. The seller can edit and resubmit; feedback/history remain recorded.
4. For another complete submission, choose **Approve version**, then **Confirm approve**. Verify it becomes **Approved — not public**. Approval does not publish, accept money or transfer ownership.
5. Filter to **Approved — not public**. **Publish listing** must remain disabled while the runtime switch is false. Confirm anonymous `/browse` shows the opening-soon message and direct private review URLs show unavailable.
6. Test a non-admin account: admin queue/actions must be denied. Test another seller: they must not see the first seller's private review or deliverable downloads.

Decisions include the expected review version. If another moderator or seller changes it first, refresh rather than repeating a stale decision.

## Publication is a separate future step

Keep the switch false while payment setup is pending. When you deliberately open a read-only public catalog, set `LISTING_PUBLICATION_ENABLED=true` in Production and deploy the runtime change. This does not automatically publish approved listings. An admin must separately open an approved fixed-price version, choose **Publish listing**, and confirm. A fresh exact-asset Roblox ownership check must pass again.

Only published snapshot text and images appear at `/browse` and `/listing/<review-id>`. Purchase buttons remain disabled. Deliverables, storage paths, seller account IDs and review feedback are not returned to anonymous visitors. Images are proxied with a current publication check and `no-store`; downloadable projects stay private.

Published listings cannot be edited. The seller or admin can **Unpublish listing** with a reason. Editing after withdrawal/unpublication requires a new submission and approval. Turning the global switch false hides the entire catalog and its image endpoints without deleting review history. Content someone has already viewed/downloaded cannot be recalled.

Auctions may be reviewed but cannot be published, even with the switch on. Their closing times must still be in the future when submitted. Real bidding, checkout, buyer entitlements, inventory, live payments, disputes and settlement are outside this patch.

## Capacity and verification

Review snapshots are independent private copies so later draft edits cannot replace reviewed files. There is a 300 MiB per-seller cap across retained review snapshot manifests, including failed or archived versions. Review history is retained; automated retention/cleanup and malware scanning are not implemented. If the cap is reached, stop resubmitting and arrange retention maintenance before raising it.

The patch passed 296 automated tests across 36 files, TypeScript, targeted lint (allowing `any` only for test doubles), a production build and the Cloudflare deployment dry run. Database QA also passed against the applied schema and rolled all test users/data back. The checks cover identity/role gates, frozen source content, private media, rights confirmation, fresh ownership proof, retries/version conflicts and lifecycle transitions. Signed-in seller/admin acceptance checks above still need to be run after this code is deployed.
