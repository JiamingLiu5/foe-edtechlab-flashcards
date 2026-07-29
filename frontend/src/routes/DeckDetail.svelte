<script lang="ts">
  import { onMount } from "svelte";
  import type { CardDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;

  let cards: CardDTO[] = [];
  let loading = true;
  let search = "";
  let tagFilter = "";
  let cardIndex = 0;
  let flipped = false;

  $: allTags = [...new Set(cards.flatMap((card) => card.tags))].sort();
  $: visibleCards = cards.filter((card) => {
    const query = search.trim().toLowerCase();
    return (!query || card.front.toLowerCase().includes(query) || card.back.toLowerCase().includes(query))
      && (!tagFilter || card.tags.includes(tagFilter));
  });
  $: if (cardIndex >= visibleCards.length) {
    cardIndex = 0;
    flipped = false;
  }
  $: currentCard = visibleCards[cardIndex] ?? null;

  async function load() {
    loading = true;
    const res = await api.listCards(deckId);
    cards = res.cards;
    loading = false;
  }

  async function removeCard(cardId: string) {
    if (!confirm("Delete this card?")) return;
    await api.deleteCard(deckId, cardId);
    await load();
  }

  function moveCard(direction: -1 | 1) {
    if (visibleCards.length < 2) return;
    cardIndex = (cardIndex + direction + visibleCards.length) % visibleCards.length;
    flipped = false;
  }

  function toggleCard() {
    if (currentCard) flipped = !flipped;
  }

  let reviewing = false;
  let reviewError = "";

  async function startAiReview() {
    if (cards.length === 0) return;
    reviewing = true;
    reviewError = "";
    try {
      const { job } = await api.startDeckReview(deckId);
      navigate(`/decks/${deckId}/jobs/${job.id}/review`);
    } catch (e) {
      reviewError = e instanceof ApiError ? e.message : "Couldn't start AI review.";
      reviewing = false;
    }
  }

  onMount(load);
</script>

<button class="back" on:click={() => navigate("/decks")}>&larr; All decks</button>

<div class="actions">
  <button class="btn btn-primary" on:click={() => navigate(`/decks/${deckId}/add-cards`)}>Add cards</button>
  <button class="btn" on:click={startAiReview} disabled={reviewing || cards.length === 0} title="Have AI check this deck's cards for factual or clarity issues">
    {reviewing ? "Starting review…" : "AI review"}
  </button>
  <button class="btn" on:click={() => navigate(`/decks/${deckId}/study`)}>Study</button>
  <button class="btn" on:click={() => navigate(`/decks/${deckId}/quiz`)}>Quiz</button>
  <button class="btn" on:click={() => navigate(`/decks/${deckId}/selfcheck`)}>Self-check</button>
  <a class="btn" href={api.exportAnkiUrl(deckId)}>Export (Anki)</a>
</div>

{#if reviewError}<p class="error">{reviewError}</p>{/if}

<div class="filters">
  <input type="search" placeholder="Search questions and answers…" bind:value={search} />
  <select bind:value={tagFilter} aria-label="Filter by tag">
    <option value="">All tags</option>
    {#each allTags as tag}<option value={tag}>{tag}</option>{/each}
  </select>
</div>

{#if loading}
  <p class="muted">Loading…</p>
{:else if cards.length === 0}
  <div class="card-surface empty-state">
    <p>No cards yet.</p>
    <button class="btn btn-primary" on:click={() => navigate(`/decks/${deckId}/add-cards`)}>Add cards</button>
  </div>
{:else if visibleCards.length === 0}
  <p class="muted">No cards match this filter.</p>
{:else}
  {@const card = currentCard!}
  <div class="viewer">
    <button class="card-arrow" on:click={() => moveCard(-1)} disabled={visibleCards.length < 2} aria-label="Previous card">&larr;</button>
    <div
      class="card-surface flashcard"
      class:flipped
      on:click={toggleCard}
      on:keydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleCard();
        }
      }}
      role="button"
      tabindex="0"
      aria-label={flipped ? "Show the question" : "Show the answer"}
    >
      <p class="face-label muted small">{flipped ? "Answer" : "Question"}</p>
      <div class="face"><Katex text={flipped ? card.back : card.front} /></div>
      <p class="muted small hint">Click the card to {flipped ? "see the question" : "reveal the answer"}</p>
    </div>
    <button class="card-arrow" on:click={() => moveCard(1)} disabled={visibleCards.length < 2} aria-label="Next card">&rarr;</button>
  </div>
  <div class="card-meta">
    <span class="muted small">Card {cardIndex + 1} of {visibleCards.length}</span>
    {#if card.source && card.source !== "manual"}<span class="source muted small">{card.source}</span>{/if}
    {#if card.tags.length}<div class="tags">{#each card.tags as tag}<span>{tag}</span>{/each}</div>{/if}
    <button class="delete" on:click={() => removeCard(card.id)}>Delete card</button>
  </div>
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .actions { display: flex; gap: 0.6rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .actions a.btn { text-decoration: none; display: inline-flex; align-items: center; }
  .error { color: var(--bad); margin-bottom: 1rem; }
  .small { font-size: 0.8rem; }
  .filters { display: flex; gap: 0.6rem; margin-bottom: 1rem; }
  .filters input { flex: 1; }
  .tags { display: flex; gap: 0.35rem; margin-top: 0.5rem; }
  .tags span { font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 999px; background: var(--surface-2); color: var(--text-dim); }
  .viewer { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.75rem; align-items: center; }
  .flashcard {
    min-height: 280px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease;
  }
  .flashcard:hover, .flashcard:focus-visible { border-color: var(--accent); transform: translateY(-2px); outline: none; }
  .flashcard.flipped { background: var(--surface-2); }
  .face-label { margin: 0 0 1rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .face { font-size: 1.15rem; font-weight: 600; }
  .hint { margin: 1.5rem 0 0; }
  .card-arrow { border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 999px; width: 2.75rem; height: 2.75rem; font-size: 1.25rem; }
  .card-arrow:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .card-arrow:disabled { cursor: default; opacity: 0.35; }
  .card-meta { display: flex; align-items: center; justify-content: center; gap: 0.7rem; flex-wrap: wrap; margin-top: 0.75rem; }
  .source { margin-top: 0.4rem; }
  .delete {
    background: none; border: none; color: var(--text-dim); font-size: 0.8rem;
  }
  .delete:hover { color: var(--bad); }
  .empty-state { padding: 2rem; text-align: center; }
  @media (max-width: 600px) {
    .viewer { grid-template-columns: 1fr 1fr; }
    .flashcard { grid-column: 1 / -1; grid-row: 1; min-height: 240px; }
    .card-arrow:first-child { grid-column: 1; grid-row: 2; justify-self: end; }
    .card-arrow:last-child { grid-column: 2; grid-row: 2; justify-self: start; }
  }
</style>
