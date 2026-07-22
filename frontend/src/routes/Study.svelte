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

  async function loadNext() {
    flipped = false;
    const res = await api.nextDueCard(deckId);
    card = res.card;
    done = !res.card;
  }

  async function review(outcome: ReviewOutcome) {
    if (!card) return;
    await api.submitReview(card.id, outcome);
    reviewedCount += 1;
    await loadNext();
  }

  onMount(loadNext);
</script>

<button class="back" on:click={() => navigate(`/decks/${deckId}`)}>&larr; Back to deck</button>
<h1>Study</h1>

{#if card === undefined}
  <p class="muted">Loading…</p>
{:else if done}
  <div class="card-surface empty">
    <p>All caught up — nothing due right now.</p>
    <p class="muted">Reviewed {reviewedCount} card{reviewedCount === 1 ? "" : "s"} this session.</p>
  </div>
{:else if card}
  <div class="card-surface flashcard" on:click={() => (flipped = !flipped)} role="button" tabindex="0">
    <div class="face"><Katex text={flipped ? card.back : card.front} /></div>
    <p class="muted small hint">{flipped ? "" : "Click to reveal answer"}</p>
  </div>

  {#if flipped}
    <div class="grade-row">
      <button class="btn btn-danger" on:click={() => review("again")}>Again</button>
      <button class="btn" on:click={() => review("hard")}>Hard</button>
      <button class="btn btn-primary" on:click={() => review("good")}>Good</button>
      <button class="btn" on:click={() => review("easy")}>Easy</button>
    </div>
  {/if}
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
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
  .grade-row { display: flex; gap: 0.6rem; justify-content: center; margin-top: 1.25rem; }
  .empty { padding: 2rem; text-align: center; }
  .small { font-size: 0.8rem; }
</style>
