# Notification bell setup

BestOttr now has a small bell in the top navigation, a red unread dot, a compact dropdown and a persistent notification inbox. The listing editor and public listing design are unchanged.

## Deploy

Upload `bestottr-notification-bell.patch` into `/workspaces/bestottr` in your GitHub Codespace. Start with unrelated tracked changes committed, then run:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/notification-bell
git apply --index bestottr-notification-bell.patch
git commit -m "Add private notification bell and listing updates"
git push -u origin feature/notification-bell
```

Open the pull request, wait for the build check, merge it and wait for the Cloudflare main deployment to reach Ready. If the branch already exists, choose another name. Stop and resolve any patch conflict before committing; do not force application.

This patch is based on `83a0f6e` (merged account-order pages PR #15).

## Database and configuration

The owner-controlled Supabase project is already updated. Migration `20261022151931_in_app_notifications.sql` is included in the patch to align Git history; **do not paste or rerun it manually**.

No new Cloudflare variables, Wrangler changes, Resend settings or Trustap credentials are required. Existing account/Supabase configuration is used. Publication, checkout and bidding availability are unchanged.

This release sends **in-app notifications only**. Existing email preference checkboxes remain separate and do not mute or enable the notification bell. No email is sent by the new notification trigger.

## Behavior

- Signed-in users with confirmed email addresses see the bell beside the existing header actions. A small red dot means at least one unread notification. The control has an accessible unread count and works on narrow screens.
- The popover shows up to six recent notifications. **View all notifications** opens `/account/notifications`, which now includes an inbox above the existing email preferences. Inbox history paginates 20 items at a time.
- Opening the bell refreshes its contents but does not mark them all read. Opening an item or choosing **Mark as read** updates that item. **Mark all as read** marks notifications up to the newest timestamp loaded on the first page; chronologically newer notifications stay unread.
- Read state persists across refreshes and devices. The header refreshes about once per minute while the tab is active, on returning to a stale tab, and when opening the bell. It is not a WebSocket or operating-system push notification service.
- Each item links to **Selling**, where the seller can see listing status and feedback and open the existing management flow.
- Listing **approval**, **changes requested**, **publication** and **moderator unpublication** notify the seller. Approval explicitly says the listing is not automatically public. Rejection/unpublication includes the moderator feedback. Self-unpublication and withdrawal do not produce redundant alerts.
- Decisions from the previous 30 days are added once during migration. Notifications are historical events; always check the current listing status in Selling.

Notification creation occurs in the same database transaction as the review event. A failed notification insert rolls back that decision rather than silently losing the alert. Source-event uniqueness and the existing version-checked review transition prevent duplicate alerts from a retried decision.

## Check after deployment

1. Sign in to BestOttr. Confirm a bell appears near the account menu on desktop and mobile. Signed-out visitors should not see it.
2. If you already have a recent listing decision, confirm the red dot appears. Otherwise submit a complete draft, then approve or request changes through your admin account. An approved listing may remain private; no payment or publication setup is needed for this test.
3. Open the bell. Confirm the listing title and appropriate feedback appear and that merely opening the popover does not clear its unread state. Escape or tapping outside should close it.
4. Choose **Mark as read**. Confirm the red dot disappears when there are no other unread items. Refresh or sign in on another device and verify the item remains read.
5. Create another review decision and choose **Mark all as read**. Future decisions should still generate a new unread alert.
6. Choose **View all notifications**. Confirm your inbox loads, email preferences still save separately, and the listing link opens Selling.
7. Sign in with a different account, including a different admin account. It must not see the first user's notifications. An account with MFA must complete its challenge before private notification data can be returned.

## Verification and scope

326 automated tests passed across 40 files. These include real popover interaction, red-dot/read behavior, Escape dismissal, account switching, pagination, error handling, account-derived recipient filters and bounded mark-all updates. TypeScript, targeted lint, the production build and Cloudflare dry run passed.

Transactional SQL checks passed for atomic approval alerts, retry protection, feedback content, skipped self-actions, per-account RLS, forbidden forged/edited messages, read-only column grants and preservation of chronologically newer unread notifications. Test users/data were rolled back; security advisors show no new warnings. Signed-in desktop/mobile acceptance checks remain after deployment.

Bid alerts, payment alerts, admin-queue alerts, email delivery and browser push notifications are not part of this release.
