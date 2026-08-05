# Site review — ldnmeals.com (2026-08-03)

Full click-through of the deployed app (deck browse, Study, Quiz, AI review, Self-check,
Export, Admin, onboarding tour, Study settings) plus a read of the relevant source.

## Fixed this session

- **Export (Anki) returned 503 on every deck, including empty ones.** Caddy's
  `reverse_proxy backend:3000` (`infra/Caddyfile:5`) only returns 503 when it can't reach
  the backend at all, and every other endpoint stayed healthy throughout testing — so the
  route was very likely crashing the whole Node process rather than failing the request.
  `backend/src/modules/export/routes.ts` built the `.anki2` file with `better-sqlite3`
  writing to a temp file (`tmpdir()`), which is the kind of native-layer disk I/O that can
  abort a process instead of throwing a catchable JS error on some container filesystems.
  Rewrote it to build the SQLite collection fully in-memory (`new Database(":memory:")` +
  `.serialize()`) and zip the resulting buffer directly — no disk write at all. Verified the
  full pipeline locally (serialize → buffer → zip) and confirmed no test regressions.
- **Top nav overflowed instead of wrapping on narrow screens.** `App.svelte`'s `.topbar`
  was a plain `display: flex` row with no `flex-wrap` and no `@media` query — the only
  top-level layout piece missing one, when every route component has one. Added
  `flex-wrap: wrap` and a `@media (max-width: 640px)` block that breaks the brand onto its
  own line.
- **Disabled buttons were visually indistinguishable from active ones, app-wide.** `.btn` in
  `app.css` had no `:disabled` rule at all — e.g. "Previous question" on Quiz's first
  question looked fully clickable even though `disabled={index === 0}` was already
  correctly wired up. Added opacity + `not-allowed` cursor once, globally, rather than
  patching each screen.
- **Study mode had no progress indicator.** Browse and Self-check both show "Card X of Y";
  Study didn't, because it fetches one due card at a time with no total. Now seeds a
  starting total from the deck's existing `dueCount` (via `listDecks()`) and shows
  "Card X of Y", widening the denominator if "again" reviews requeue extra cards mid-session.

## Not fixed — worth a look

- Mobile responsiveness beyond the topbar fix above is unverified — window resize wasn't
  taking effect in the browser automation tooling used for this review, so only a
  code-level pass was done, not an on-device check.
- Deleting a deck uses a native `window.confirm()` dialog, the only unstyled/blocking UI
  element in an otherwise fully custom app. It also freezes headless browser automation
  entirely (JS dialogs block the page), which is what happened mid-review. Worth swapping
  for the same in-app modal pattern used elsewhere.

## Feature ideas, from a student's-eye view

- **No cross-deck "study everything due" entry point.** With several decks that each have
  due cards, studying before an exam currently means opening each deck separately. A single
  aggregating "Study" view pooling due cards across all decks would match how it'd actually
  get used.
- **Self-check doesn't loop.** Getting AI feedback like "15/100, here's what you missed" and
  then only being able to hit "Next card" wastes the highest-value moment in the app — no
  way to re-answer with that feedback in mind before moving on.
- **No streak or return-visit signal.** Nothing surfaces "you studied N days running" or
  "you're behind on deck X" — no habit hook to come back today instead of next week.
- **"Needs Attention · N" is shown but not actionable.** It appears as a badge on the deck
  card but there's no way to jump straight into just those cards — that's exactly the
  "what am I actually getting wrong" view a student would reach for first, so it's high
  leverage if not already wired up.
- **Study settings (again/hard/good/easy intervals) are global, not per-deck.** Fine for one
  subject, awkward once a student is juggling an easy elective and a brutal core module that
  deserve different repetition schedules.

## Not verified

- Anki `.apkg` import into real Anki Desktop — the export code path is now proven to run
  end-to-end without crashing, but the produced file wasn't test-imported into an actual
  Anki client.
