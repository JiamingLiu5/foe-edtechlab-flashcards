<script lang="ts">
  import { api, ApiError } from "../lib/api";
  import { currentUser } from "../lib/auth";
  import { navigate } from "../lib/router";

  let mode: "login" | "signup" = "login";
  let email = "";
  let password = "";
  let error = "";
  let loading = false;

  async function submit() {
    error = "";
    loading = true;
    try {
      const { user } = mode === "login"
        ? await api.login(email.trim(), password)
        : await api.signup(email.trim(), password);
      currentUser.set(user);
      navigate("/decks");
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Something went wrong.";
    } finally {
      loading = false;
    }
  }

  function toggleMode() {
    mode = mode === "login" ? "signup" : "login";
    error = "";
  }
</script>

<div class="wrap">
  <div class="card-surface panel">
    <h1>Flashcards</h1>
    <p class="muted">
      {mode === "login" ? "Sign in with your Imperial email." : "Create an account with your Imperial email."}
    </p>

    <form on:submit|preventDefault={submit}>
      <input
        type="email"
        placeholder="you@ic.ac.uk"
        bind:value={email}
        required
        autocomplete="email"
      />
      <input
        type="password"
        placeholder="Password"
        bind:value={password}
        required
        minlength="8"
        autocomplete={mode === "login" ? "current-password" : "new-password"}
      />
      <button class="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
    {#if error}<p class="error">{error}</p>{/if}

    <button class="btn link" on:click={toggleMode}>
      {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
    </button>
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
  .link {
    margin-top: 1rem;
    background: none;
    border: none;
    padding: 0;
    text-decoration: underline;
  }
</style>
