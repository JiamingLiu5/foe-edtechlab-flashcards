<script lang="ts">
  import { onMount } from "svelte";
  import type { AdminUserDTO, DeckSummaryDTO, QuotaBucket, QuotaBucketDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";

  export let userId: string;

  let user: AdminUserDTO | null = null;
  let decks: DeckSummaryDTO[] = [];
  let loading = true;
  let error = "";

  let quotaBuckets: QuotaBucketDTO[] = [];
  let quotaLoading = true;
  let quotaError = "";
  let quotaBusy = "";
  // Svelte binds <input type="number"> values as numbers (or undefined while
  // empty), so keep this state numeric instead of treating it as text.
  let overrideInputs: Record<string, number | undefined> = {};

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

  async function loadQuota() {
    quotaLoading = true;
    quotaError = "";
    try {
      const res = await api.adminGetUserQuota(userId);
      quotaBuckets = res.buckets;
      overrideInputs = Object.fromEntries(res.buckets.map((b) => [b.bucket, b.limit]));
    } catch (e) {
      quotaError = e instanceof ApiError ? e.message : "Failed to load quota.";
    } finally {
      quotaLoading = false;
    }
  }

  async function resetQuota(bucket: QuotaBucket) {
    quotaBusy = bucket;
    quotaError = "";
    try {
      await api.adminResetQuota(userId, bucket);
      await loadQuota();
    } catch (e) {
      quotaError = e instanceof ApiError ? e.message : "Failed to reset quota.";
    } finally {
      quotaBusy = "";
    }
  }

  async function saveOverride(bucket: QuotaBucket) {
    const dailyLimit = overrideInputs[bucket];
    if (!Number.isInteger(dailyLimit) || dailyLimit < 0) {
      quotaError = "Enter a non-negative whole number.";
      return;
    }

    quotaBusy = bucket;
    quotaError = "";
    try {
      await api.adminSetQuotaOverride(userId, bucket, dailyLimit);
      await loadQuota();
    } catch (e) {
      quotaError = e instanceof ApiError ? e.message : "Failed to update quota.";
    } finally {
      quotaBusy = "";
    }
  }

  async function clearOverride(bucket: QuotaBucket) {
    quotaBusy = bucket;
    quotaError = "";
    try {
      await api.adminSetQuotaOverride(userId, bucket, null);
      await loadQuota();
    } catch (e) {
      quotaError = e instanceof ApiError ? e.message : "Failed to update quota.";
    } finally {
      quotaBusy = "";
    }
  }

  onMount(() => {
    load();
    loadQuota();
  });
  $: userId, load(), loadQuota();
</script>

<button class="back" on:click={() => navigate("/admin")}>&larr; All users</button>

<div class="header">
  <h1>{user ? user.displayName ?? user.email : "User"}'s decks</h1>
  {#if user}<p class="muted">{user.email}</p>{/if}
</div>

{#if error}<p class="error">{error}</p>{/if}

<div class="quota card-surface">
  <h2>Usage limits</h2>
  {#if quotaError}<p class="error">{quotaError}</p>{/if}
  {#if quotaLoading}
    <p class="muted">Loading…</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Bucket</th>
            <th>Usage</th>
            <th>Limit</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each quotaBuckets as b (b.bucket)}
            <tr>
              <td>
                {b.label}
                {#if b.overridden}<span class="pill overridden">custom</span>{/if}
              </td>
              <td class="muted">
                {#if b.scope === "daily"}
                  {b.used} / {b.limit} today
                {:else}
                  {b.limit} {b.usageLabel}
                {/if}
                {#if b.overridden} <span class="muted small">(default {b.defaultLimit})</span>{/if}
              </td>
              <td>
                <input
                  class="limit-input"
                  type="number"
                  min="0"
                  step="1"
                  bind:value={overrideInputs[b.bucket]}
                  disabled={quotaBusy === b.bucket}
                />
              </td>
              <td class="actions">
                <button class="btn" disabled={quotaBusy === b.bucket} on:click={() => saveOverride(b.bucket)}>{b.scope === "daily" ? "Save limit" : "Save maximum"}</button>
                {#if b.overridden}
                  <button class="btn" disabled={quotaBusy === b.bucket} on:click={() => clearOverride(b.bucket)}>Use default</button>
                {/if}
                {#if b.scope === "daily"}
                  <button class="btn btn-danger" disabled={quotaBusy === b.bucket} on:click={() => resetQuota(b.bucket)}>Reset usage</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

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
  .quota { padding: 1.1rem; margin-bottom: 1.5rem; }
  .quota h2 { margin: 0 0 0.75rem; font-size: 1.05rem; }
  .table-wrap { overflow-x: auto; }
  .quota table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .quota th, .quota td { text-align: left; padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .quota th { color: var(--text-dim); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
  .quota tr:last-child td { border-bottom: none; }
  .quota .actions { display: flex; gap: 0.4rem; }
  .limit-input { width: 5.5rem; }
  .small { font-size: 0.8rem; }
  .pill.overridden { background: rgba(110, 168, 254, 0.18); color: var(--accent); margin-left: 0.4rem; border-radius: 999px; padding: 0.1rem 0.55rem; font-size: 0.72rem; font-weight: 600; }
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
