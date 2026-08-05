<script lang="ts">
  import { onMount } from "svelte";
  import type { CardDTO, ReviewOutcome } from "@flashcards/shared";
  import { api } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;

  let card: CardDTO | null | undefined = undefined;
  let flipped = false;
  let done = false;
  let reviewedCount = 0;
  let nextDueAt: string | null = null;
  let intervalPreviews: Record<ReviewOutcome, number> = { again: 0, hard: 360, good: 720, easy: 1440 };
  let retiring = false;
  /** Due count when the session started — a fixed denominator for the progress readout, not a live recount. */
  let totalDue: number | null = null;

  /** Renders a minutes count (a Study interval) as "now" / "Xh" / "Xd". */
  function formatMinutes(minutes: number): string {
    if (minutes <= 0) return "now";
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round((minutes / 60) * 10) / 10}h`;
    return `${Math.round((minutes / 1440) * 10) / 10}d`;
  }

  async function loadNext() {
    flipped = false;
    const res = await api.nextDueCard(deckId);
    card = res.card;
    nextDueAt = res.nextDueAt;
    intervalPreviews = res.intervalPreviews;
    done = !res.card;
  }

  async function review(outcome: ReviewOutcome) {
    if (!card) return;
    await api.submitReview(card.id, outcome);
    reviewedCount += 1;
    await loadNext();
  }

  // Cards reviewed as "again" can come straight back into the queue, so the running
  // count can exceed the session's starting total — widen the denominator rather than
  // show a numerator past its total.
  $: displayTotal = totalDue === null ? null : Math.max(totalDue, reviewedCount + 1);

  async function retire() {
    if (!card || retiring) return;
    retiring = true;
    try {
      await api.updateCard(deckId, card.id, { retired: true });
      await loadNext();
    } finally {
      retiring = false;
    }
  }

  onMount(async () => {
    const { decks } = await api.listDecks();
    totalDue = decks.find((deck) => deck.id === deckId)?.dueCount ?? null;
    await loadNext();
  });
</script>

<div class="topline">
  <button class="back" on:click={() => navigate(`/decks/${deckId}`)}>&larr; Back to deck</button>
  <button class="settings-link" on:click={() => navigate("/settings")}>Study settings</button>
</div>
<h1>Study</h1>

{#if card === undefined}
  <p class="muted">Loading…</p>
{:else if done}
  <div class="card-surface empty" data-tour-target="study-card">
    <p>No cards due today 🎉</p>
    {#if nextDueAt}<p class="muted">Next review: {new Date(nextDueAt).toLocaleString()}</p>{/if}
    <p class="muted">Reviewed {reviewedCount} card{reviewedCount === 1 ? "" : "s"} this session.</p>
  </div>
{:else if card}
  <div class="study-session" data-tour-target="study-session">
    {#if displayTotal}
      <span class="muted small progress">Card {reviewedCount + 1} of {displayTotal}</span>
    {/if}
    <div
      class="card-surface flashcard"
      on:click={() => (flipped = !flipped)}
      on:keydown={(event) => {
        if (event.key === "Enter" || event.key === " ") flipped = !flipped;
      }}
      role="button"
      tabindex="0"
    >
      <div class="face"><Katex text={flipped ? card.back : card.front} /></div>
      <p class="muted small hint">{flipped ? "" : "Click to reveal answer"}</p>
    </div>

    {#if flipped}
      <div class="grade-row">
        <button class="btn btn-danger" on:click={() => review("again")}>Again <small>{formatMinutes(intervalPreviews.again)}</small></button>
        <button class="btn" on:click={() => review("hard")}>Hard <small>{formatMinutes(intervalPreviews.hard)}</small></button>
        <button class="btn btn-primary" on:click={() => review("good")}>Good <small>{formatMinutes(intervalPreviews.good)}</small></button>
        <button class="btn" on:click={() => review("easy")}>Easy <small>{formatMinutes(intervalPreviews.easy)}</small></button>
        <button class="btn all-done" disabled={retiring} on:click={retire}>All done <small>never again</small></button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .topline { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
  .back { background: none; border: none; color: var(--text-dim); padding: 0; }
  .back:hover { color: var(--text); }
  .settings-link { background: none; border: none; color: var(--accent); font-size: 0.85rem; padding: 0; }
  .settings-link:hover { color: var(--accent-strong); }
  .flashcard {
    padding: 3rem 2rem;
    text-align: center;
    cursor: pointer;
    min-height: 180px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-size: 1.15rem;
  }
  .hint { margin-top: 1rem; margin-bottom: 0; }
  .grade-row { display: flex; gap: 0.6rem; justify-content: center; margin-top: 1.25rem; flex-wrap: wrap; }
  .grade-row button { display: flex; flex-direction: column; align-items: center; }
  .grade-row small { opacity: 0.75; }
  .all-done { border-color: var(--text-dim); }
  .empty { padding: 2rem; text-align: center; }
  .small { font-size: 0.8rem; }
  .progress { display: block; text-align: center; margin-bottom: 0.5rem; }
</style>
