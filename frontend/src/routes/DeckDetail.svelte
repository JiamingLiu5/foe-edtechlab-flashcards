<script lang="ts">
  import { onMount } from "svelte";
  import type { CardDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;

  let cards: CardDTO[] = [];
  let loading = true;
  let front = "";
  let back = "";
  let tags = "";
  let bulkText = "";
  let showBulk = false;
  let saving = false;
  let search = "";
  let tagFilter = "";

  $: allTags = [...new Set(cards.flatMap((card) => card.tags))].sort();
  $: visibleCards = cards.filter((card) => {
    const query = search.trim().toLowerCase();
    return (!query || card.front.toLowerCase().includes(query) || card.back.toLowerCase().includes(query))
      && (!tagFilter || card.tags.includes(tagFilter));
  });

  async function load() {
    loading = true;
    const res = await api.listCards(deckId);
    cards = res.cards;
    loading = false;
  }

  async function addCard() {
    if (!front.trim() || !back.trim()) return;
    saving = true;
    try {
      await api.createCard(deckId, front.trim(), back.trim(), tags.split(",").map((tag) => tag.trim()).filter(Boolean));
      front = "";
      back = "";
      tags = "";
      await load();
    } finally {
      saving = false;
    }
  }

  async function addBulk() {
    // One card per line, front and back separated by a tab or " | ".
    const parsed = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [f, ...rest] = line.split(/\t| \| /);
        return { front: f?.trim() ?? "", back: rest.join(" | ").trim() };
      })
      .filter((c) => c.front && c.back);

    if (!parsed.length) return;
    saving = true;
    try {
      await api.createCardsBulk(deckId, parsed);
      bulkText = "";
      showBulk = false;
      await load();
    } finally {
      saving = false;
    }
  }

  async function removeCard(cardId: string) {
    if (!confirm("Delete this card?")) return;
    await api.deleteCard(deckId, cardId);
    await load();
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
  <button class="btn" on:click={() => navigate(`/decks/${deckId}/import`)}>Import cards</button>
  <button class="btn" on:click={startAiReview} disabled={reviewing || cards.length === 0} title="Have AI check this deck's cards for factual or clarity issues">
    {reviewing ? "Starting review…" : "AI review"}
  </button>
  <button class="btn" on:click={() => navigate(`/decks/${deckId}/study`)}>Study</button>
  <button class="btn" on:click={() => navigate(`/decks/${deckId}/quiz`)}>Quiz</button>
  <button class="btn" on:click={() => navigate(`/decks/${deckId}/selfcheck`)}>Self-check</button>
  <a class="btn" href={api.exportAnkiUrl(deckId)}>Export (Anki)</a>
</div>

{#if reviewError}<p class="error">{reviewError}</p>{/if}

<div class="card-surface add-card">
  <div class="add-card-header">
    <h3>Add a card</h3>
    <button class="btn" on:click={() => (showBulk = !showBulk)}>{showBulk ? "Single card" : "Bulk paste"}</button>
  </div>

  {#if showBulk}
    <p class="muted small">One card per line: <code>front &lt;tab&gt; back</code> or <code>front | back</code></p>
    <textarea rows="6" bind:value={bulkText} placeholder={"What is the capital of France?\tParis"}></textarea>
    <button class="btn btn-primary" on:click={addBulk} disabled={saving}>Add all</button>
  {:else}
    <form on:submit|preventDefault={addCard}>
      <textarea rows="2" placeholder="Front (LaTeX supported)" bind:value={front}></textarea>
      <textarea rows="2" placeholder="Back (LaTeX supported)" bind:value={back}></textarea>
      <input placeholder="Tags, comma separated" bind:value={tags} />
      <button class="btn btn-primary" type="submit" disabled={saving}>Add card</button>
    </form>
    {#if front || back}
      <div class="preview">
        <strong>Preview</strong>
        <Katex text={front || "Front"} /> <span class="muted">→</span> <Katex text={back || "Back"} />
      </div>
    {/if}
  {/if}
</div>

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
  <p class="muted">No cards yet.</p>
{:else}
  <ul class="card-list">
    {#each visibleCards as card}
      <li class="card-surface">
        <div class="front"><Katex text={card.front} /></div>
        <div class="back muted"><Katex text={card.back} /></div>
        {#if card.source && card.source !== "manual"}<div class="source muted small">{card.source}</div>{/if}
        {#if card.tags.length}<div class="tags">{#each card.tags as tag}<span>{tag}</span>{/each}</div>{/if}
        <button class="delete" on:click={() => removeCard(card.id)}>Delete</button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .actions { display: flex; gap: 0.6rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .actions a.btn { text-decoration: none; display: inline-flex; align-items: center; }
  .error { color: var(--bad); margin-bottom: 1rem; }
  .add-card { padding: 1.1rem; margin-bottom: 1.5rem; }
  .add-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
  .add-card h3 { margin: 0; }
  .add-card form { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  .add-card input, .add-card form textarea { flex: 1; min-width: 180px; }
  .add-card textarea { width: 100%; margin-bottom: 0.6rem; font-family: monospace; }
  .small { font-size: 0.8rem; }
  .preview { width: 100%; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .filters { display: flex; gap: 0.6rem; margin-bottom: 1rem; }
  .filters input { flex: 1; }
  .tags { display: flex; gap: 0.35rem; margin-top: 0.5rem; }
  .tags span { font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 999px; background: var(--surface-2); color: var(--text-dim); }
  .card-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .card-list li { padding: 0.9rem 1rem; position: relative; }
  .front { font-weight: 600; margin-bottom: 0.3rem; }
  .source { margin-top: 0.4rem; }
  .delete {
    position: absolute; top: 0.7rem; right: 0.9rem;
    background: none; border: none; color: var(--text-dim); font-size: 0.8rem;
  }
  .delete:hover { color: var(--bad); }
</style>
