<script lang="ts">
  import { onMount } from "svelte";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";

  let loading = true;
  let saving = false;
  let error = "";
  let saved = false;

  let againHours = 0;
  let hardHours = 6;
  let goodHours = 12;
  let easyHours = 24;

  function toHours(minutes: number): number {
    return Math.round((minutes / 60) * 100) / 100;
  }

  function toMinutes(hours: number): number {
    return Math.max(0, Math.round((Number.isFinite(hours) ? hours : 0) * 60));
  }

  async function load() {
    loading = true;
    error = "";
    try {
      const settings = await api.getStudySettings();
      againHours = toHours(settings.againMinutes);
      hardHours = toHours(settings.hardMinutes);
      goodHours = toHours(settings.goodMinutes);
      easyHours = toHours(settings.easyMinutes);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't load your study settings.";
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    error = "";
    saved = false;
    try {
      await api.updateStudySettings({
        againMinutes: toMinutes(againHours),
        hardMinutes: toMinutes(hardHours),
        goodMinutes: toMinutes(goodHours),
        easyMinutes: toMinutes(easyHours),
      });
      saved = true;
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't save your study settings.";
    } finally {
      saving = false;
    }
  }

  onMount(load);
</script>

<button class="back" on:click={() => navigate("/decks")}>&larr; Back</button>
<h1>Study settings</h1>
<p class="muted">
  Choose how long a card stays away after each answer in Study. These apply across all your decks.
</p>

{#if loading}
  <p class="muted">Loading…</p>
{:else}
  <form class="card-surface form" on:submit|preventDefault={save}>
    <label>
      <span>Again <span class="muted small">(0 = show again immediately)</span></span>
      <div class="field"><input type="number" min="0" step="0.5" bind:value={againHours} disabled={saving} /> <span class="muted">hours</span></div>
    </label>
    <label>
      <span>Hard</span>
      <div class="field"><input type="number" min="0" step="0.5" bind:value={hardHours} disabled={saving} /> <span class="muted">hours</span></div>
    </label>
    <label>
      <span>Good</span>
      <div class="field"><input type="number" min="0" step="0.5" bind:value={goodHours} disabled={saving} /> <span class="muted">hours</span></div>
    </label>
    <label>
      <span>Easy</span>
      <div class="field"><input type="number" min="0" step="0.5" bind:value={easyHours} disabled={saving} /> <span class="muted">hours</span></div>
    </label>

    {#if error}<p class="error">{error}</p>{/if}
    {#if saved}<p class="success">Saved.</p>{/if}

    <button class="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
  </form>
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .small { font-size: 0.8rem; }
  .form { max-width: 420px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; }
  .form label { display: flex; flex-direction: column; gap: 0.35rem; font-weight: 600; font-size: 0.9rem; }
  .field { display: flex; align-items: center; gap: 0.5rem; font-weight: 400; }
  .field input { width: 6rem; }
  .error { color: var(--bad); margin: 0; }
  .success { color: var(--good); margin: 0; }
</style>
