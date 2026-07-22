<script lang="ts">
  import { api, ApiError } from "../lib/api";

  let email = "";
  let sent = false;
  let error = "";
  let loading = false;

  async function submit() {
    error = "";
    loading = true;
    try {
      await api.requestMagicLink(email.trim());
      sent = true;
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Something went wrong.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="wrap">
  <div class="card-surface panel">
    <h1>Flashcards</h1>
    <p class="muted">Sign in with your Imperial email — we'll send you a one-time link.</p>

    {#if sent}
      <p class="sent">Check your inbox for a sign-in link (and check the server console if SMTP isn't configured yet).</p>
      <button class="btn" on:click={() => (sent = false)}>Use a different email</button>
    {:else}
      <form on:submit|preventDefault={submit}>
        <input
          type="email"
          placeholder="you@ic.ac.uk"
          bind:value={email}
          required
          autocomplete="email"
        />
        <button class="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send sign-in link"}
        </button>
      </form>
      {#if error}<p class="error">{error}</p>{/if}
    {/if}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1rem;
  }
  .panel {
    width: 100%;
    max-width: 380px;
    padding: 2rem;
  }
  h1 { margin: 0 0 0.25rem; }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }
  .error { color: var(--bad); margin-top: 0.75rem; }
  .sent { margin-top: 1rem; }
</style>
