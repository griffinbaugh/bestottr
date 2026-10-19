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
