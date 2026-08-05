<script lang="ts">
  import { api, ApiError } from "../lib/api";
  import { currentUser } from "../lib/auth";
  import { navigate } from "../lib/router";

  let mode: "login" | "signup" = "login";
  let email = "";
  let password = "";
  let role: "student" | "teacher" = "student";
  let error = "";
  let info = "";
  let loading = false;

  async function submit() {
    error = "";
    info = "";
    loading = true;
    try {
      if (mode === "login") {
        const { user } = await api.login(email.trim(), password);
        currentUser.set(user);
        navigate(user.role === "teacher" ? "/teacher" : "/decks");
      } else {
        const res = await api.signup(email.trim(), password, role);
        info = res.message;
        mode = "login";
        password = "";
      }
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Something went wrong.";
    } finally {
      loading = false;
    }
  }

  function toggleMode() {
    mode = mode === "login" ? "signup" : "login";
    error = "";
    info = "";
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
      {#if mode === "signup"}
        <label class="role-select">
          <span>I am a</span>
          <select bind:value={role}>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </label>
      {/if}
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
    {#if info}<p class="info">{info}</p>{/if}

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
  .info { color: var(--accent); margin-top: 0.75rem; }
  .link {
    margin-top: 1rem;
    background: none;
    border: none;
    padding: 0;
    text-decoration: underline;
  }
  .role-select { display: grid; gap: 0.35rem; color: var(--text-dim); font-size: 0.9rem; }
</style>
