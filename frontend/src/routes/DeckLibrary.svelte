<script lang="ts">
  import { onMount } from "svelte";
  import type { DeckSummaryDTO } from "@flashcards/shared";
  import { api } from "../lib/api";
  import { navigate } from "../lib/router";

  let decks: DeckSummaryDTO[] = [];
  let loading = true;
  let newDeckName = "";
  let creating = false;

  async function load() {
    loading = true;
    const res = await api.listDecks();
    decks = res.decks;
    loading = false;
  }

  async function createDeck() {
    const name = newDeckName.trim();
    if (!name) return;
    creating = true;
    try {
      const { deck } = await api.createDeck(name);
      newDeckName = "";
      navigate(`/decks/${deck.id}`);
    } finally {
      creating = false;
    }
  }

  async function removeDeck(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this deck and all its cards?")) return;
    await api.deleteDeck(id);
    await load();
  }

  onMount(load);
</script>

<div class="header">
  <h1>Your decks</h1>
</div>

<form class="new-deck card-surface" data-tour-target="create-deck" on:submit|preventDefault={createDeck}>
  <input placeholder="New deck name…" bind:value={newDeckName} />
  <button class="btn btn-primary" type="submit" disabled={creating}>Create deck</button>
</form>

{#if loading}
  <p class="muted">Loading…</p>
{:else if decks.length === 0}
  <p class="muted">No decks yet — create one above, or import a PDF once you have a deck.</p>
{:else}
  <div class="grid">
    {#each decks as deck}
      <button class="deck card-surface" on:click={() => navigate(`/decks/${deck.id}`)}>
        <div class="deck-name">{deck.name}</div>
        <div class="deck-stats muted">
          {deck.cardCount} card{deck.cardCount === 1 ? "" : "s"}
          {#if deck.dueCount > 0}<span class="pill due">{deck.dueCount} due</span>{/if}
          {#if deck.forgottenCount >= 3}<span class="pill forgotten">Needs Attention · {deck.forgottenCount}</span>{/if}
        </div>
        <span
          class="delete"
          role="button"
          tabindex="0"
          on:click={(e) => removeDeck(deck.id, e)}
          on:keydown={(e) => {
            if (e.key === "Enter" || e.key === " ") removeDeck(deck.id, e as unknown as MouseEvent);
          }}
        >Delete</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .header { margin-bottom: 1rem; }
  .new-deck {
    display: flex;
    gap: 0.6rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }
  .new-deck input { flex: 1; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }
  .deck {
    text-align: left;
    padding: 1.1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    position: relative;
  }
  .deck:hover { border-color: var(--accent); }
  .deck-name { font-weight: 600; font-size: 1.05rem; }
  .deck-stats { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; font-size: 0.85rem; }
  .pill {
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .pill.due { background: rgba(110, 168, 254, 0.18); color: var(--accent); }
  .pill.forgotten { background: rgba(248, 113, 113, 0.18); color: var(--bad); }
  .delete {
    position: absolute;
    top: 0.6rem;
    right: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-dim);
  }
  .delete:hover { color: var(--bad); }
</style>
