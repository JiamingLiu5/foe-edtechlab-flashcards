# Flashcard Activity — Feature & Design Plan

FoE EdTechLab's flashcard site for student self-study. This document plans where the site goes next, grounded in what's already built and in [`Flashcard_Expectation_From_Students_Summary.md`](./Flashcard_Expectation_From_Students_Summary.md), our survey of 9 Imperial students on how they study and what they'd expect from an AI-assisted version.

> A working prototype implementing the plan below (and the fullstack architecture in [`design.md`](./design.md)) lives in `/frontend`, `/backend`, `/shared`, and `/infra`. To run it locally see the dev commands in `package.json`; to deploy it on a Linux server see [`infra/README.md`](./infra/README.md).

## Current baseline

`index.html` already ships a self-contained, no-login activity:

- Mode picker: **Study mode** (flip cards, mark Got it / Review again) or **Quiz mode** (auto-generated multiple choice).
- Manual card entry (front/back) and **bulk import** via pasted text or `.txt`/`.csv` upload, `Question | Answer` or tab-separated.
- A 12-card sample deck to try the activity with no setup.
- A hard **12-card limit**, and no persistence — the deck resets on reload.

That baseline is the floor, not the target. Everything below is planned on top of it.

## Planned functions & features

Grouped by the gap it closes, each traced back to what students actually asked for.

### 1. Card creation & import
- **Raise or remove the 12-card cap**, with multiple named decks instead of one loose pile — a real revision set is a full module, not 12 cards.
- **PDF slide import**: upload lecture slides, get a draft deck back. Directly requested — *"Maybe scrape for exam papers and just generate flashcards from that?"* (R3).
- Keep manual entry and the existing bulk `Question | Answer` import as the fast path for students who already have their own notes — R2, R5, and R6 all build decks from scratch today and shouldn't lose that.

### 2. AI-assisted generation — with guardrails
This is the feature students want most (67% would rather the AI write cards than just format their own) *and* trust least (average 2.8/5). The guardrails aren't optional polish — they're the difference between the two numbers:

- **Grounded generation only** — no invented facts. *"Make sure the AI does not hallucinate answers"* (R5).
- **Match the course's own wording**, not a paraphrase. *"Make sure AI does not 'rephrase' answers to be in a different style from the course"* (R5).
- **Concise by default** — a card is a prompt, not a paragraph. *"Keep cards relatively concise so that it tests core knowledge"* (R5).
- **Render formulae and symbols properly** (MathJax/KaTeX), not as flattened text. *"Make sure they can cleanly print or display formulae and mathematical symbols"* (R1).
- **Show a diff, not a black box** — every AI-touched card shows what changed, editable before it's accepted. *"The ability to see what the AI has modified so you don't have to go through the whole thing to check what is valid"* (R8).
- **Suggest, don't overwrite** — on an existing deck, the AI proposes cards to fill gaps; the student accepts, edits, or ignores each one individually. *"The AI could suggest cards that may or may not be missing, and the user can choose to add / ignore / edit"* (R6).

### 3. Study & practice modes
- Keep flip-based Study mode and MCQ Quiz mode as-is — both were validated by current users (active recall, quick to use).
- **Typed self-check mode**: type an answer, AI grades it against the card and shows what's missing, instead of only multiple choice or self-reported "got it." *"Using AI to check solutions as well. Would make it more quiz-like and fun"* (R7); *"a way to input answers... and check what percentage of it is accurate"* (R8).
- **Spaced repetition scheduling** in Study mode, replacing (or sitting alongside) the current Got it / Review again buttons with an actual review interval. *"Spaced repetition and the cards letting you drill common patterns"* (R5) — it's the stated reason R2 prefers Anki over Quizlet.

### 4. Progress & data
- **Per-card forget tracking** — surface which cards keep coming back wrong, not just today's got-it/review split. *"Being able to see which flashcards have been forgotten the most frequently"* (R6).
- **Save and sync decks across devices** (account or browser-synced storage) instead of resetting on reload. *"Stat tracking, syncs across devices"* (R3).
- **One-click Anki export** so a generated deck isn't stranded in this tool. *"Make sure that these flashcards can be easily imported into Anki"* (R5) — three of the four current flashcard users are already on Anki.
- Keep the interface **ad-free**; adverts were called out unprompted as a reason existing tools get abandoned (R8).

## Design plan

### Direction
Utilitarian and fast — the existing light, high-contrast card-panel look (blue accent, rounded 18px panels, generous whitespace) is the right register for a study tool used between lectures and works well against the current `index.html` styling. Extend it rather than rebrand it:

- **Color**: keep `--accent: #2563eb` for primary actions; reserve amber (`#f59e0b`, already used for "Review again") for anything spaced-repetition or attention-needed, and green (`#22c55e`, already used for "Got it") for mastered/confirmed states. Add one new role — a quiet violet or teal — *only* for AI-generated content, so a student can tell at a glance which cards a person wrote and which the AI drafted.
- **Type**: system sans throughout (already the case) — a study tool is read in short bursts, not admired; no display face needed.
- **Layout**: keep the two-pane builder (controls left, activity right) on desktop, single column on mobile (already implemented at 900px) — don't add navigation chrome that competes with the deck itself.

### New surfaces this roadmap requires
- **AI review screen**: a diff view (old text struck through or greyed, new text highlighted in the AI accent color) with per-card Accept / Edit / Discard — this is the trust guardrail from R8 made visible, and it's the one new screen every AI feature above depends on.
- **Deck library**: a card grid one level up from today's single deck, each deck showing name, card count, and a small forgotten-cards indicator (ties to the per-card forget tracking above).
- **PDF upload step**: a drag-and-drop zone ahead of the existing bulk-import textarea, with the extracted draft deck landing directly in the AI review screen above — never auto-added silently.

### Interaction principles carried into every new feature
- **Nothing AI-written enters a deck unreviewed.** Every generation path (PDF import, gap-filling suggestions) ends at the diff/review screen, never a direct write.
- **Everything exportable.** Whatever format a deck ends up in, an Anki-compatible export is always one click away — this is a study aid, not a walled garden.
- **Local-first, sync-optional.** Keep the "no login to try it" spirit of the current sample-deck flow; syncing and accounts unlock persistence but are never required to run a study session.

## Source
Feature priorities above come from [`Flashcard_Expectation_From_Students_Summary.md`](./Flashcard_Expectation_From_Students_Summary.md) (9 Imperial students, Microsoft Forms, 13–17 July 2026). Respondent tags (R1–R9) match that document.
