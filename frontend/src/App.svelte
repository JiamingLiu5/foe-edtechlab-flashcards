<script lang="ts">
  import "./app.css";
  import { onMount } from "svelte";
  import { currentPath, matchRoute, navigate } from "./lib/router";
  import { currentUser, refreshSession } from "./lib/auth";
  import { api } from "./lib/api";

  import Login from "./routes/Login.svelte";
  import DeckLibrary from "./routes/DeckLibrary.svelte";
  import DeckDetail from "./routes/DeckDetail.svelte";
  import AddCards from "./routes/PdfImport.svelte";
  import AiReview from "./routes/AiReview.svelte";
  import Study from "./routes/Study.svelte";
  import Quiz from "./routes/Quiz.svelte";
  import SelfCheck from "./routes/SelfCheck.svelte";
  import AdminUsers from "./routes/AdminUsers.svelte";
  import AdminUserDecks from "./routes/AdminUserDecks.svelte";
  import AdminDeckDetail from "./routes/AdminDeckDetail.svelte";
  import Settings from "./routes/Settings.svelte";
  import BeginnerGuide from "./routes/BeginnerGuide.svelte";
  import OnboardingTour from "./lib/OnboardingTour.svelte";

  type TourIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

  const TOUR_STORAGE_KEY = "flashcards:onboarding-complete";
  const tourSteps = [
    { target: "create-deck", title: "Create your first deck", description: "Give your topic a clear name, then select Create deck. The guide will continue when your new deck opens.", continueLabel: "" },
    { target: "add-cards", title: "Add material to the deck", description: "Select Add cards to write cards yourself or turn your study material into draft cards.", continueLabel: "" },
    { target: "choose-source", title: "Choose a source", description: "Choose Create a card, Paste cards, From PDF, or From link. Use the real controls, then continue when you are ready.", continueLabel: "I chose a source" },
    { target: "generate-cards", title: "Create or generate cards", description: "Add a manual card, or set a maximum and draft cards with AI. AI drafts are always reviewed before entering your deck.", continueLabel: "I've added or drafted cards" },
    { target: "review-drafts", title: "Review each draft", description: "Check the question and answer against your notes. Use Edit to correct wording, Accept to add it to the deck, or Discard to leave it out.", continueLabel: "I've reviewed my cards" },
    { target: "self-check-mode", title: "Open Self-check", description: "Select Self-check to practise explaining an answer without prompts or answer options. The guide will continue on the Self-check screen.", continueLabel: "" },
    { target: "self-check-answer", title: "Write and check your answer", description: "Read the question, type a complete answer in the box, then select Submit. AI gives a score, feedback, missing points, and the reference answer before you continue.", continueLabel: "Next: Study" },
    { target: "study-mode", title: "Open Study", description: "Select Study to practise with spaced repetition. The guide will show you the card controls on the next screen.", continueLabel: "" },
    { target: "study-card", title: "Flip and schedule the card", description: "Click the card to reveal its answer. Then choose Again if you missed it, or Hard, Good, or Easy to decide how soon it should return.", continueLabel: "Next: Quiz" },
    { target: "quiz-mode", title: "Open Quiz", description: "Select Quiz to test recall in a set of questions. The guide will show the available formats next.", continueLabel: "" },
    { target: "quiz-format", title: "Choose a quiz format", description: "Multiple choice gives four options. Fill-in-the-blank collects written answers and grades each one before the final results. Mix combines both formats. Choose a format, configure the question count, then start.", continueLabel: "Finish guide" },
  ];

  let tourIndex: TourIndex | null = null;
  let tourReady = false;
  let autoTourChecked = false;
  let tourDeckId = "";

  onMount(async () => {
    await refreshSession();
    tourReady = true;
  });

  $: path = $currentPath;
  $: authChecked = $currentUser !== undefined;
  $: isLoggedIn = !!$currentUser;
  $: isAdmin = $currentUser?.role === "admin";

  $: deckIdParams = matchRoute("/decks/:id", path);
  $: addCardsParams = matchRoute("/decks/:id/add-cards", path);
  $: importParams = matchRoute("/decks/:id/import", path);
  $: reviewParams = matchRoute("/decks/:id/jobs/:jobId/review", path);
  $: studyParams = matchRoute("/decks/:id/study", path);
  $: quizParams = matchRoute("/decks/:id/quiz", path);
  $: quizModeParams = matchRoute("/decks/:id/quiz/:mode", path);
  $: selfCheckParams = matchRoute("/decks/:id/selfcheck", path);
  $: adminUserDeckParams = matchRoute("/admin/users/:id/decks/:deckId", path);
  $: adminUserDecksParams = matchRoute("/admin/users/:id/decks", path);
  $: isAdminRoute = path === "/admin";
  $: isSettingsRoute = path === "/settings";
  $: isGuideRoute = path === "/guide";
  $: isLibrary = path === "/decks" || path === "/" || path === "/login" || path === "";
  $: if (tourIndex === 0 && deckIdParams) tourIndex = 1;
  $: if (tourIndex === 1 && addCardsParams) tourIndex = 2;
  $: if (tourIndex === 3 && reviewParams) tourIndex = 4;
  $: if (tourIndex === 5 && selfCheckParams) tourIndex = 6;
  $: if (tourIndex === 7 && studyParams) tourIndex = 8;
  $: if (tourIndex === 9 && (quizParams || quizModeParams)) tourIndex = 10;
  $: if (deckIdParams?.id) tourDeckId = deckIdParams.id;
  $: if (addCardsParams?.id) tourDeckId = addCardsParams.id;
  $: if (reviewParams?.id) tourDeckId = reviewParams.id;
  $: activeTourStep = tourIndex === null ? null : tourSteps[tourIndex];
  $: if (tourReady && isLoggedIn && !autoTourChecked) {
    autoTourChecked = true;
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) startTour();
  }

  async function logout() {
    await api.logout();
    currentUser.set(null);
    navigate("/login");
  }

  function startTour() {
    if (!tourReady || !isLoggedIn) return;
    tourIndex = 0;
    navigate("/decks");
  }

  function finishTour() {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    tourIndex = null;
  }

  function continueTour() {
    if (tourIndex === null) return;
    if (tourIndex === 2) {
      tourIndex = 3;
    } else if (tourIndex === 3) {
      tourIndex = 4;
    } else if (tourIndex === 4) {
      tourIndex = 5;
      if (tourDeckId) navigate(`/decks/${tourDeckId}`);
    } else if (tourIndex === 6) {
      tourIndex = 7;
      if (tourDeckId) navigate(`/decks/${tourDeckId}`);
    } else if (tourIndex === 8) {
      tourIndex = 9;
      if (tourDeckId) navigate(`/decks/${tourDeckId}`);
    } else if (tourIndex === 10) {
      finishTour();
    }
  }
</script>

{#if !authChecked}
  <div class="loading-screen">Loading…</div>
{:else if !isLoggedIn}
  <Login />
{:else}
  <div class="shell">
    <header class="topbar">
      <button class="brand" on:click={() => navigate("/decks")}>Flashcards</button>
      <div class="spacer"></div>
      <button class="btn" on:click={startTour}>Beginner guide</button>
      <button class="btn" on:click={() => navigate("/settings")}>Study settings</button>
      {#if isAdmin}
        <button class="btn" on:click={() => navigate("/admin")}>Admin</button>
      {/if}
      <span class="muted">{$currentUser?.email}</span>
      <button class="btn" on:click={logout}>Sign out</button>
    </header>
    <main>
      {#if isSettingsRoute}
        <Settings />
      {:else if isGuideRoute}
        <BeginnerGuide />
      {:else if isAdminRoute && isAdmin}
        <AdminUsers />
      {:else if adminUserDeckParams && isAdmin}
        <AdminDeckDetail userId={adminUserDeckParams.id} deckId={adminUserDeckParams.deckId} />
      {:else if adminUserDecksParams && isAdmin}
        <AdminUserDecks userId={adminUserDecksParams.id} />
      {:else if selfCheckParams}
        <SelfCheck deckId={selfCheckParams.id} />
      {:else if quizModeParams && (quizModeParams.mode === "mcq" || quizModeParams.mode === "fill" || quizModeParams.mode === "mix")}
        <Quiz deckId={quizModeParams.id} mode={quizModeParams.mode} />
      {:else if quizParams}
        <Quiz deckId={quizParams.id} />
      {:else if studyParams}
        <Study deckId={studyParams.id} />
      {:else if reviewParams}
        <AiReview deckId={reviewParams.id} jobId={reviewParams.jobId} />
      {:else if addCardsParams || importParams}
        <AddCards deckId={(addCardsParams ?? importParams)!.id} />
      {:else if deckIdParams}
        <DeckDetail deckId={deckIdParams.id} />
      {:else}
        <DeckLibrary />
      {/if}
    </main>
    {#if activeTourStep}
      <OnboardingTour
        target={activeTourStep.target}
        title={activeTourStep.title}
        description={activeTourStep.description}
        continueLabel={activeTourStep.continueLabel}
        onContinue={continueTour}
        onSkip={finishTour}
      />
    {/if}
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
