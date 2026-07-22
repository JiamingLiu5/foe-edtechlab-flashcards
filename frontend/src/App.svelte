<script lang="ts">
  import "./app.css";
  import { onMount } from "svelte";
  import { currentPath, matchRoute, navigate } from "./lib/router";
  import { currentUser, refreshSession } from "./lib/auth";
  import { api } from "./lib/api";

  import Login from "./routes/Login.svelte";
  import VerifyMagicLink from "./routes/VerifyMagicLink.svelte";
  import DeckLibrary from "./routes/DeckLibrary.svelte";
  import DeckDetail from "./routes/DeckDetail.svelte";
  import PdfImport from "./routes/PdfImport.svelte";
  import AiReview from "./routes/AiReview.svelte";
  import Study from "./routes/Study.svelte";
  import Quiz from "./routes/Quiz.svelte";
  import SelfCheck from "./routes/SelfCheck.svelte";

  onMount(refreshSession);

  $: path = $currentPath;
  $: authChecked = $currentUser !== undefined;
  $: isLoggedIn = !!$currentUser;

  $: verifyParams = matchRoute("/auth/verify", path);
  $: deckIdParams = matchRoute("/decks/:id", path);
  $: importParams = matchRoute("/decks/:id/import", path);
  $: reviewParams = matchRoute("/decks/:id/jobs/:jobId/review", path);
  $: studyParams = matchRoute("/decks/:id/study", path);
  $: quizParams = matchRoute("/decks/:id/quiz", path);
  $: selfCheckParams = matchRoute("/decks/:id/selfcheck", path);
  $: isLibrary = path === "/decks" || path === "/" || path === "/login" || path === "";

  async function logout() {
    await api.logout();
    currentUser.set(null);
    navigate("/login");
  }
</script>

{#if !authChecked}
  <div class="loading-screen">Loading…</div>
{:else if verifyParams}
  <VerifyMagicLink token={verifyParams.token} />
{:else if !isLoggedIn}
  <Login />
{:else}
  <div class="shell">
    <header class="topbar">
      <button class="brand" on:click={() => navigate("/decks")}>Flashcards</button>
      <div class="spacer"></div>
      <span class="muted">{$currentUser?.email}</span>
      <button class="btn" on:click={logout}>Sign out</button>
    </header>
    <main>
      {#if selfCheckParams}
        <SelfCheck deckId={selfCheckParams.id} />
      {:else if quizParams}
        <Quiz deckId={quizParams.id} />
      {:else if studyParams}
        <Study deckId={studyParams.id} />
      {:else if reviewParams}
        <AiReview deckId={reviewParams.id} jobId={reviewParams.jobId} />
      {:else if importParams}
        <PdfImport deckId={importParams.id} />
      {:else if deckIdParams}
        <DeckDetail deckId={deckIdParams.id} />
      {:else}
        <DeckLibrary />
      {/if}
    </main>
  </div>
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: var(--text-dim);
  }
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  .topbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .brand {
    background: none;
    border: none;
    color: var(--text);
    font-weight: 700;
    font-size: 1.05rem;
    padding: 0;
  }
  .spacer { flex: 1; }
  main {
    flex: 1;
    padding: 1.5rem;
    max-width: 960px;
    width: 100%;
    margin: 0 auto;
  }
</style>
