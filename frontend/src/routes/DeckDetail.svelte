<script lang="ts">
  import { onMount } from "svelte";
  import type { CardDTO, DeckSourceDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;

  let cards: CardDTO[] = [];
  let loading = true;
  let search = "";
  let tagFilter = "";

  let sources: DeckSourceDTO[] = [];
  let sourcesOpen = false;
  let sourcesLoading = true;
  let sourcesError = "";
  let removingSourceId = "";
  let cardIndex = 0;
  let flipped = false;
  let editing = false;
  let editingCardId: string | null = null;
  let editFront = "";
  let editBack = "";
  let editTags = "";
  let editSaving = false;
  let editError = "";

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

  async function loadSources() {
    sourcesLoading = true;
    sourcesError = "";
    try {
      const res = await api.listSources(deckId);
      sources = res.sources;
    } catch (e) {
      sourcesError = e instanceof ApiError ? e.message : "Couldn't load sources.";
    } finally {
      sourcesLoading = false;
    }
  }

  async function removeSource(sourceId: string) {
    if (!confirm("Remove this source? AI review will no longer be able to check cards against it.")) return;
    removingSourceId = sourceId;
    try {
      await api.deleteSource(deckId, sourceId);
      sources = sources.filter((s) => s.id !== sourceId);
    } catch (e) {
      sourcesError = e instanceof ApiError ? e.message : "Couldn't remove this source.";
    } finally {
      removingSourceId = "";
    }
  }

  async function removeCard(cardId: string) {
    if (!confirm("Delete this card?")) return;
    await api.deleteCard(deckId, cardId);
    await load();
  }

  async function resumeStudying(cardId: string) {
    await api.updateCard(deckId, cardId, { retired: false });
    await load();
  }

  function startEdit(card: CardDTO) {
    editFront = card.front;
    editBack = card.back;
    editTags = card.tags.join(", ");
    editError = "";
    editingCardId = card.id;
    editing = true;
  }

  async function saveEdit(card: CardDTO) {
    if (!editFront.trim() || !editBack.trim()) {
      editError = "Both the question and answer are required.";
      return;
    }

    editSaving = true;
    editError = "";
    try {
      await api.updateCard(deckId, card.id, {
        front: editFront.trim(),
        back: editBack.trim(),
        tags: editTags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      editing = false;
      editingCardId = null;
      await load();
    } catch (error) {
      editError = error instanceof ApiError ? error.message : "Couldn't save this card.";
    } finally {
      editSaving = false;
    }
  }

  function moveCard(direction: -1 | 1) {
    if (visibleCards.length < 2 || editing) return;
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

  onMount(() => {
    load();
    loadSources();
  });
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

{#if !sourcesLoading && sources.length > 0}
  <div class="sources card-surface">
    <button class="sources-toggle" on:click={() => (sourcesOpen = !sourcesOpen)}>
      <span>📎 {sources.length} source{sources.length === 1 ? "" : "s"} grounding AI review</span>
      <span class="muted small">{sourcesOpen ? "Hide" : "Show"}</span>
    </button>
    {#if sourcesError}<p class="error">{sourcesError}</p>{/if}
    {#if sourcesOpen}
      <ul class="source-list">
        {#each sources as source (source.id)}
          <li>
            <span class="source-label">{source.sourceType === "url" ? "🔗" : "📄"} {source.label}</span>
            <span class="muted small">{new Date(source.createdAt).toLocaleDateString()}</span>
            <button class="delete" disabled={removingSourceId === source.id} on:click={() => removeSource(source.id)}>Remove</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

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
    <button class="card-arrow" on:click={() => moveCard(-1)} disabled={visibleCards.length < 2 || editing} aria-label="Previous card">&larr;</button>
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
    <button class="card-arrow" on:click={() => moveCard(1)} disabled={visibleCards.length < 2 || editing} aria-label="Next card">&rarr;</button>
  </div>
  <div class="card-meta">
    <span class="muted small">Card {cardIndex + 1} of {visibleCards.length}</span>
    {#if card.source && card.source !== "manual"}<span class="source muted small">{card.source}</span>{/if}
    {#if card.retired}<span class="pill retired">Retired from Study</span>{/if}
    {#if card.tags.length}<div class="tags">{#each card.tags as tag}<span>{tag}</span>{/each}</div>{/if}
    <button class="edit" on:click={() => startEdit(card)}>Edit card</button>
    {#if card.retired}
      <button class="edit" on:click={() => resumeStudying(card.id)}>Resume studying</button>
    {/if}
    <button class="delete" on:click={() => removeCard(card.id)}>Delete card</button>
  </div>
  {#if editing && editingCardId === card.id}
    <form class="card-surface editor" on:submit|preventDefault={() => saveEdit(card)}>
      <h2>Edit card</h2>
      <textarea rows="3" bind:value={editFront} placeholder="Question / front" disabled={editSaving}></textarea>
      <textarea rows="4" bind:value={editBack} placeholder="Answer / back" disabled={editSaving}></textarea>
      <input bind:value={editTags} placeholder="Tags, comma separated" disabled={editSaving} />
      {#if editError}<p class="error">{editError}</p>{/if}
      <div class="editor-actions">
        <button class="btn" type="button" on:click={() => { editing = false; editingCardId = null; }} disabled={editSaving}>Cancel</button>
        <button class="btn btn-primary" type="submit" disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  {/if}
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .actions { display: flex; gap: 0.6rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .actions a.btn { text-decoration: none; display: inline-flex; align-items: center; }
  .actions .btn { min-height: 2.75rem; padding: 0.65rem 1.2rem; background: var(--surface); border-color: color-mix(in srgb, var(--accent) 28%, var(--border)); font-weight: 600; }
  .actions .btn-primary { background: #2563eb; border-color: #2563eb; box-shadow: 0 5px 12px rgba(37, 99, 235, 0.28); }
  .actions .btn-primary:hover { background: #1d4ed8; border-color: #1d4ed8; }
  .error { color: var(--bad); margin-bottom: 1rem; }
  .small { font-size: 0.8rem; }
  .sources { padding: 0.9rem 1.1rem; margin-bottom: 1rem; }
  .sources-toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    color: var(--text);
    padding: 0;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .source-list { list-style: none; margin: 0.8rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .source-list li { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; }
  .source-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .filters { display: flex; gap: 0.6rem; margin-bottom: 1rem; }
  .filters input { flex: 1; }
  .tags { display: flex; gap: 0.35rem; margin-top: 0.5rem; }
  .tags span { font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 999px; background: var(--surface-2); color: var(--text-dim); }
  .pill.retired { font-size: 0.72rem; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--surface-2); color: var(--text-dim); font-weight: 600; }
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
  .edit { background: none; border: none; color: var(--accent); font-size: 0.8rem; }
  .edit:hover { color: var(--accent-strong); }
  .editor { margin-top: 1.25rem; padding: 1.2rem; display: flex; flex-direction: column; gap: 0.7rem; }
  .editor h2 { font-size: 1rem; margin: 0; }
  .editor textarea, .editor input { width: 100%; }
  .editor-actions { display: flex; gap: 0.6rem; justify-content: flex-end; }
  .empty-state { padding: 2rem; text-align: center; }
  @media (max-width: 600px) {
    .viewer { grid-template-columns: 1fr 1fr; }
    .flashcard { grid-column: 1 / -1; grid-row: 1; min-height: 240px; }
    .card-arrow:first-child { grid-column: 1; grid-row: 2; justify-self: end; }
    .card-arrow:last-child { grid-column: 2; grid-row: 2; justify-self: start; }
  }
</style>
