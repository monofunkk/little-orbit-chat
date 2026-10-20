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

- UI components come from the Arc registry (uiarc.dev), copied into src/components/arc; prefer them over src/components/ui. Why: user-chosen component library.
- Keep the copied Arc registry files passing the project's strict typecheck by adapting the files themselves (bracket access on CSS-module styles, conditional spreads instead of passing undefined to motion props), never by relaxing tsconfig flags. Why: those flags are the template's and catch real bugs in app code.
- Use Lovable Cloud for durable application data and private document storage; keep compliance rules in a tested browser-safe module. Why: the user replaced the frontend-only stage with a real platform.
- Keep private application routes under the authenticated layout and use a shared authenticated snapshot for page reads. Why: prevents mock data and private content from bypassing the account gate.
- Parse text PDFs in the browser and send extracted text to the authenticated Orbit function; generate report PDFs client-side with signed evidence URLs. Why: document libraries stay out of the server runtime and storage remains private.
- Provision the first administrator only for an explicitly identified real account through trusted administration; new public signups remain supervisors. Why: a public first-signup bootstrap allows account takeover.
