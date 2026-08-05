<script lang="ts">
  import { navigate } from "../lib/router";

  type Step = 1 | 2 | 3 | 4 | 5 | 6;
  type Source = "manual" | "paste" | "pdf" | "link";
  type PracticeMode = "study" | "quiz" | "self-check";
  type DraftStatus = "pending" | "editing" | "accepted" | "discarded";

  const steps: { id: Step; label: string }[] = [
    { id: 1, label: "Sign in" },
    { id: 2, label: "Create deck" },
    { id: 3, label: "Choose source(s)" },
    { id: 4, label: "Generate" },
    { id: 5, label: "Review" },
    { id: 6, label: "Practise" },
  ];

  const sourceDetails: Record<Source, { label: string; text: string }> = {
    manual: { label: "Create a card", text: "Write a question and answer yourself. You can also add tags to organise the card." },
    paste: { label: "Paste cards", text: "Paste any bulk block of study text. No tabs, pipes, or special formatting are needed." },
    pdf: { label: "From PDF", text: "Upload lecture slides or another PDF, then choose the maximum number of draft cards." },
    link: { label: "From link", text: "Paste a public webpage URL, then choose the maximum number of draft cards." },
  };

  const practiceDetails: Record<PracticeMode, { label: string; text: string }> = {
    study: { label: "Study", text: "Flip each card, reveal the answer, then choose Again, Hard, Good, or Easy to schedule its next review." },
    quiz: { label: "Quiz", text: "Choose multiple choice, fill-in-the-blank, or a mixed quiz. Results appear together at the end." },
    "self-check": { label: "Self-check", text: "Write an answer in your own words and receive AI feedback, missing points, and a reference answer." },
  };

  let step: Step = 1;
  let source: Source = "paste";
  let practiceMode: PracticeMode = "study";
  let draftStatus: DraftStatus = "pending";
  let editedDraft = "What is active recall?";

  function goToStep(nextStep: Step) {
    step = nextStep;
  }

  function nextStep() {
    if (step < 6) step = (step + 1) as Step;
  }

  function previousStep() {
    if (step > 1) step = (step - 1) as Step;
  }

  function restart() {
    step = 1;
    source = "paste";
    practiceMode = "study";
    draftStatus = "pending";
    editedDraft = "What is active recall?";
  }
</script>

<div class="guide-heading">
  <div>
    <h1>Beginner guide</h1>
    <p class="muted">Work through the flow one step at a time.</p>
  </div>
  <span class="progress-label">Step {step} of {steps.length}</span>
</div>

<nav class="progress card-surface" aria-label="Guide progress">
  {#each steps as guideStep, index}
    <button
      class="progress-step"
      class:active={guideStep.id === step}
      class:complete={guideStep.id < step}
      aria-current={guideStep.id === step ? "step" : undefined}
      on:click={() => goToStep(guideStep.id)}
    >
      <span>{guideStep.id}</span>
      {guideStep.label}
    </button>
    {#if index < steps.length - 1}<span class="connector" aria-hidden="true">→</span>{/if}
  {/each}
</nav>

<section class="card-surface lesson" aria-live="polite">
  {#if step === 1}
    <p class="eyebrow">Step 1</p>
    <h2>Sign in</h2>
    <p>You are signed in and ready to begin. Your deck library is where all of your revision topics live.</p>
    <button class="btn" on:click={() => navigate("/decks")}>Open my decks</button>
  {:else if step === 2}
    <p class="eyebrow">Step 2</p>
    <h2>Create a deck</h2>
    <p>Start with one topic. On <strong>Your decks</strong>, enter a clear name such as “Week 3: Cell biology”. If a matching deck appears, select it to open it; otherwise select <strong>Create deck</strong>.</p>
    <button class="btn" on:click={() => navigate("/decks")}>Create a deck</button>
  {:else if step === 3}
    <p class="eyebrow">Step 3</p>
    <h2>Choose source(s)</h2>
    <p>Select <strong>Add cards</strong> inside your deck, then choose the source that suits your material. You can return after reviewing drafts to add more material from the same or related topics.</p>
    <div class="choice-grid" role="group" aria-label="Card source options">
      {#each Object.entries(sourceDetails) as [key, detail]}
        <button class="choice" class:selected={source === key} aria-pressed={source === key} on:click={() => (source = key as Source)}>{detail.label}</button>
      {/each}
    </div>
    <div class="selection"><strong>{sourceDetails[source].label}</strong><p>{sourceDetails[source].text}</p></div>
  {:else if step === 4}
    <p class="eyebrow">Step 4</p>
    <h2>Generate cards</h2>
    {#if source === "manual"}
      <p>Manual cards are created directly. Complete the question and answer, then select <strong>Add card</strong>.</p>
    {:else}
      <p>Set the maximum number of cards to draft, then select <strong>Draft cards with AI</strong>. AI prepares drafts from your {sourceDetails[source].label.toLowerCase()} source.</p>
      <p class="muted">Nothing is added to your deck yet—you review every draft first.</p>
    {/if}
  {:else if step === 5}
    <p class="eyebrow">Step 5</p>
    <h2>Review your cards</h2>
    <p>AI-generated cards arrive as drafts. Try the review controls on this example before continuing.</p>
    <div class="draft-example" class:resolved={draftStatus === "accepted" || draftStatus === "discarded"}>
      {#if draftStatus === "editing"}
        <label>
          <span class="muted small">Question</span>
          <input bind:value={editedDraft} />
        </label>
      {:else}
        <strong>{editedDraft}</strong>
      {/if}
      <p class="muted">Using retrieval to actively recall information strengthens learning.</p>
      {#if draftStatus === "accepted"}<p class="status good">Accepted — you can now choose whether to use this card in quizzes.</p>{/if}
      {#if draftStatus === "discarded"}<p class="status">Discarded — it will not be added to the deck.</p>{/if}
      <div class="draft-actions">
        {#if draftStatus === "editing"}
          <button class="btn btn-primary" on:click={() => (draftStatus = "pending")}>Save edit</button>
        {:else if draftStatus === "pending"}
          <button class="btn btn-primary" on:click={() => (draftStatus = "accepted")}>Accept</button>
          <button class="btn" on:click={() => (draftStatus = "editing")}>Edit</button>
          <button class="btn btn-danger" on:click={() => (draftStatus = "discarded")}>Discard</button>
        {:else}
          <button class="btn" on:click={() => (draftStatus = "pending")}>Try again</button>
        {/if}
      </div>
    </div>
    <p class="muted small">You can also run <strong>AI review</strong> later to check an existing deck for potential factual or clarity issues.</p>
  {:else}
    <p class="eyebrow">Step 6</p>
    <h2>Choose how to practise</h2>
    <p>Pick a mode for the kind of revision you want to do today.</p>
    <div class="choice-grid" role="group" aria-label="Practice modes">
      {#each Object.entries(practiceDetails) as [key, detail]}
        <button class="choice" class:selected={practiceMode === key} aria-pressed={practiceMode === key} on:click={() => (practiceMode = key as PracticeMode)}>{detail.label}</button>
      {/each}
    </div>
    <div class="selection"><strong>{practiceDetails[practiceMode].label}</strong><p>{practiceDetails[practiceMode].text}</p></div>
  {/if}

  <div class="lesson-actions">
    <button class="btn" on:click={previousStep} disabled={step === 1}>Back</button>
    {#if step < 6}
      <button class="btn btn-primary" on:click={nextStep}>Next: {steps[step].label}</button>
    {:else}
      <button class="btn" on:click={restart}>Start guide again</button>
      <button class="btn btn-primary" on:click={() => navigate("/decks")}>Go to my decks</button>
    {/if}
  </div>
</section>

<style>
  .guide-heading { display: flex; justify-content: space-between; align-items: start; gap: 1rem; margin-bottom: 1.25rem; }
  .guide-heading h1 { margin: 0; }
  .guide-heading p { margin: 0.4rem 0 0; }
  .progress-label { color: var(--accent); font-size: 0.85rem; font-weight: 700; white-space: nowrap; }
  .progress { display: flex; align-items: center; justify-content: space-between; gap: 0.45rem; padding: 0.7rem; margin-bottom: 1.25rem; overflow-x: auto; }
  .progress-step { display: grid; justify-items: center; gap: 0.2rem; min-width: 6.6rem; border: 0; border-radius: 8px; padding: 0.45rem; background: transparent; color: var(--text-dim); font-size: 0.76rem; font-weight: 600; }
  .progress-step span { display: grid; place-items: center; width: 1.35rem; height: 1.35rem; border-radius: 999px; background: var(--surface-2); font-size: 0.72rem; }
  .progress-step:hover { color: var(--text); background: var(--surface-2); }
  .progress-step.complete { color: var(--accent); }
  .progress-step.complete span, .progress-step.active span { background: color-mix(in srgb, var(--accent) 20%, var(--surface-2)); color: var(--accent); }
  .progress-step.active { background: color-mix(in srgb, var(--accent) 13%, var(--surface)); color: var(--text); }
  .connector { flex: 0 0 auto; color: var(--accent); }
  .lesson { max-width: 700px; margin: 0 auto; padding: 1.5rem; }
  .lesson h2 { margin: 0; }
  .lesson > p { line-height: 1.55; }
  .eyebrow { margin: 0 0 0.35rem; color: var(--accent); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; margin: 1rem 0; }
  .choice { min-height: 3rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text); font-weight: 600; }
  .choice:hover, .choice.selected { border-color: var(--accent); }
  .choice.selected { background: color-mix(in srgb, var(--accent) 16%, var(--surface-2)); color: var(--accent); }
  .selection { padding: 0.9rem; border-left: 3px solid var(--accent); border-radius: 0 8px 8px 0; background: var(--surface-2); }
  .selection p { margin: 0.35rem 0 0; line-height: 1.45; }
  .draft-example { margin: 1rem 0; padding: 1rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); }
  .draft-example.resolved { opacity: 0.8; }
  .draft-example label { display: grid; gap: 0.35rem; }
  .draft-example input { width: 100%; }
  .draft-example p { margin: 0.45rem 0 0; line-height: 1.45; }
  .status { color: var(--text-dim); font-size: 0.9rem; }
  .status.good { color: var(--good); }
  .draft-actions, .lesson-actions { display: flex; flex-wrap: wrap; gap: 0.55rem; }
  .draft-actions { margin-top: 0.9rem; }
  .lesson-actions { justify-content: space-between; margin-top: 1.75rem; padding-top: 1rem; border-top: 1px solid var(--border); }
  .lesson-actions .btn-primary { margin-left: auto; }
  .small { font-size: 0.85rem; }
  @media (max-width: 650px) {
    .guide-heading { align-items: stretch; flex-direction: column; }
    .progress { justify-content: start; }
    .connector { display: none; }
    .progress-step { min-width: 5.6rem; }
    .choice-grid { grid-template-columns: 1fr; }
  }
</style>
