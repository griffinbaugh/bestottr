<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep seller listing prices in integer cents through the shared CurrencyInput and convert only when creating a listing; verified financial metrics retain their existing input model.
- Keep auction scheduling in the shared auction-end helpers, validate again at publication, and store absolute millisecond timestamps so countdowns remain independent of display modes.
- Treat bestottr.com (root) as the canonical hostname with www redirecting to it, so generated metadata, canonical/OG URLs and share links point at the canonical host rather than a preview host; while the domain is not yet live, use the published Lovable URL.
- Support tickets are created only through the security-definer `submit_support_ticket` RPC (called from a server function with validation + honeypot); the table has no public insert/select, and admin reads/updates are gated by `has_role(..., 'admin')` RLS. Why: public users must never enumerate tickets.
- Support emails go through `src/lib/support-email.server.ts`, currently a no-op; connect a provider there. Why: one swap point for ack/notify/status emails.
