<script lang="ts">
  import { onMount } from "svelte";
  import type { AdminUserDTO, DeckSummaryDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";

  export let userId: string;

  let user: AdminUserDTO | null = null;
  let decks: DeckSummaryDTO[] = [];
  let loading = true;
  let error = "";

  async function load() {
    loading = true;
    error = "";
    try {
      const res = await api.adminListUserDecks(userId);
      user = res.user;
      decks = res.decks;
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Failed to load decks.";
    } finally {
      loading = false;
    }
  }

  onMount(load);
  $: userId, load();
</script>

<button class="back" on:click={() => navigate("/admin")}>&larr; All users</button>

<div class="header">
  <h1>{user ? user.displayName ?? user.email : "User"}'s decks</h1>
  {#if user}<p class="muted">{user.email}</p>{/if}
</div>

{#if error}<p class="error">{error}</p>{/if}

{#if loading}
  <p class="muted">Loading…</p>
{:else if decks.length === 0}
  <p class="muted">This user has no decks yet.</p>
{:else}
  <div class="grid">
    {#each decks as deck}
      <button class="deck card-surface" on:click={() => navigate(`/admin/users/${userId}/decks/${deck.id}`)}>
        <div class="deck-name">{deck.name}</div>
        <div class="deck-stats muted">
          {deck.cardCount} card{deck.cardCount === 1 ? "" : "s"}
          {#if deck.dueCount > 0}<span class="pill due">{deck.dueCount} due</span>{/if}
          {#if deck.forgottenCount > 0}<span class="pill forgotten">{deck.forgottenCount} forgotten</span>{/if}
        </div>
      </button>
    {/each}
  </div>
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .header { margin-bottom: 1rem; }
  .error { color: var(--bad); margin-bottom: 1rem; }
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
</style>
