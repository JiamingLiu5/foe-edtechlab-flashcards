<script lang="ts">
  import { onMount } from "svelte";
  import type { CardDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let userId: string;
  export let deckId: string;

  let deckName = "";
  let cards: CardDTO[] = [];
  let loading = true;
  let error = "";

  async function load() {
    loading = true;
    error = "";
    try {
      const res = await api.adminListDeckCards(deckId);
      deckName = res.deck.name;
      cards = res.cards;
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Failed to load cards.";
    } finally {
      loading = false;
    }
  }

  onMount(load);
  $: deckId, load();
</script>

<button class="back" on:click={() => navigate(`/admin/users/${userId}/decks`)}>&larr; Back to decks</button>

<div class="header">
  <h1>{deckName || "Deck"}</h1>
</div>

{#if error}<p class="error">{error}</p>{/if}

{#if loading}
  <p class="muted">Loading…</p>
{:else if cards.length === 0}
  <p class="muted">No cards in this deck.</p>
{:else}
  <ul class="card-list">
    {#each cards as card}
      <li class="card-surface">
        <div class="front"><Katex text={card.front} /></div>
        <div class="back muted"><Katex text={card.back} /></div>
        {#if card.source && card.source !== "manual"}<div class="source muted small">{card.source}</div>{/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .header { margin-bottom: 1rem; }
  .error { color: var(--bad); margin-bottom: 1rem; }
  .small { font-size: 0.8rem; }
  .card-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .card-list li { padding: 0.9rem 1rem; position: relative; }
  .front { font-weight: 600; margin-bottom: 0.3rem; }
  .source { margin-top: 0.4rem; }
</style>
