<script lang="ts">
  import { onMount } from "svelte";
  import type { DeckSummaryDTO } from "@flashcards/shared";
  import { api } from "../lib/api";
  import { navigate } from "../lib/router";
  import { currentUser } from "../lib/auth";

  let decks: DeckSummaryDTO[] = [];
  let loading = true;
  let newDeckName = "";
  let creating = false;

  $: matchingDecks = newDeckName.trim()
    ? decks.filter((deck) => deck.name.toLocaleLowerCase().includes(newDeckName.trim().toLocaleLowerCase()))
    : [];

  function openDeck(deck: DeckSummaryDTO) {
    newDeckName = "";
    navigate(`/decks/${deck.id}`);
  }

  async function load() {
    loading = true;
    const res = await api.listDecks();
    decks = res.decks;
    loading = false;
  }

  async function createDeck() {
    const name = newDeckName.trim();
    if (!name) return;

    // Pressing Enter on an exact existing name should never accidentally make a duplicate deck.
    const existing = decks.find((deck) => deck.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0);
    if (existing) {
      openDeck(existing);
      return;
    }
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
  <h1>{$currentUser?.role === "teacher" ? "Your quiz decks" : "Your decks"}</h1>
</div>

<form class="new-deck card-surface" data-tour-target="create-deck" on:submit|preventDefault={createDeck}>
  <label class="deck-picker">
    <span class="sr-only">Deck name</span>
    <input
      placeholder="Type a deck name…"
      bind:value={newDeckName}
      aria-describedby="deck-picker-help"
      autocomplete="off"
    />
    {#if matchingDecks.length > 0}
      <div class="matches" aria-label="Existing matching decks">
        <p>Open an existing deck</p>
        {#each matchingDecks as deck (deck.id)}
          <button type="button" on:click={() => openDeck(deck)}>{deck.name}</button>
        {/each}
      </div>
    {/if}
  </label>
  <button class="btn btn-primary" type="submit" disabled={creating || !newDeckName.trim()}>
    {creating ? "Creating…" : "Create deck"}
  </button>
  <p id="deck-picker-help" class="muted small">Choose a matching deck to open it, or create a new one if it is not listed.</p>
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
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.6rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }
  .deck-picker { position: relative; min-width: 0; }
  .deck-picker input { width: 100%; }
  .new-deck .small { grid-column: 1 / -1; margin: 0; }
  .matches {
    position: absolute;
    z-index: 2;
    top: calc(100% + 0.35rem);
    left: 0;
    right: 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
  }
  .matches p { margin: 0; padding: 0.55rem 0.75rem 0.35rem; color: var(--text-dim); font-size: 0.78rem; }
  .matches button { display: block; width: 100%; border: 0; padding: 0.65rem 0.75rem; background: transparent; color: var(--text); text-align: left; }
  .matches button:hover, .matches button:focus-visible { background: var(--surface-2); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
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
