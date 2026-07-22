<script lang="ts">
  import { onMount } from "svelte";
  import { api, ApiError } from "../lib/api";
  import { currentUser } from "../lib/auth";
  import { navigate } from "../lib/router";

  export let token: string;
  let error = "";

  onMount(async () => {
    try {
      const { user } = await api.verifyMagicLink(token);
      currentUser.set(user);
      navigate("/decks");
    } catch (e) {
      error = e instanceof ApiError ? e.message : "This link is invalid or has expired.";
    }
  });
</script>

<div class="wrap">
  {#if error}
    <div class="card-surface panel">
      <p class="error">{error}</p>
      <button class="btn" on:click={() => navigate("/login")}>Back to sign in</button>
    </div>
  {:else}
    <p class="muted">Signing you in…</p>
  {/if}
</div>

<style>
  .wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  .panel { padding: 2rem; text-align: center; }
  .error { color: var(--bad); }
</style>
