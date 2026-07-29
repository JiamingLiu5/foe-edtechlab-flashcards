<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { AiDraftDTO, CardDTO, GenerationJobDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;
  export let jobId: string;

  let job: GenerationJobDTO | null = null;
  let error = "";
  let editingId: string | null = null;
  let editFront = "";
  let editBack = "";
  let timer: ReturnType<typeof setInterval>;
  let quizPromptCard: CardDTO | null = null;
  let quizPromptSaving = false;
  let quizPromptError = "";

  $: isReview = job?.kind === "review";

  $: STATUS_LABEL = {
    queued: "Queued…",
    extracting: job?.sourceType === "url" ? "Reading the page…" : "Reading PDF…",
    generating: isReview ? "Checking your deck for issues…" : "Drafting cards with Claude…",
    ready: "Ready for review",
    failed: "Failed",
  } as Record<string, string>;

  async function poll() {
    try {
      const res = await api.getJob(jobId);
      job = res.job;
      if (job.status === "ready" || job.status === "failed") clearInterval(timer);
    } catch {
      error = "Could not load this job.";
      clearInterval(timer);
    }
  }

  onMount(() => {
    poll();
    timer = setInterval(poll, 2500);
  });
  onDestroy(() => clearInterval(timer));

  function startEdit(draft: AiDraftDTO) {
    editingId = draft.id;
    editFront = draft.editedFront ?? draft.generatedFront;
    editBack = draft.editedBack ?? draft.generatedBack;
  }

  async function accept(draft: AiDraftDTO, edited: boolean) {
    const { card } = await api.acceptDraft(jobId, draft.id, edited ? { front: editFront, back: editBack } : undefined);
    editingId = null;
    if (!isReview) {
      quizPromptCard = card;
      quizPromptError = "";
    }
    await poll();
  }

  async function chooseQuizPreference(includeInQuiz: boolean) {
    if (!quizPromptCard || quizPromptSaving) return;
    if (!includeInQuiz) {
      quizPromptCard = null;
      return;
    }

    quizPromptSaving = true;
    quizPromptError = "";
    try {
      await api.updateCard(deckId, quizPromptCard.id, {
        front: quizPromptCard.front,
        back: quizPromptCard.back,
        tags: quizPromptCard.tags,
        includeInQuiz: true,
      });
      quizPromptCard = null;
    } catch (error) {
      quizPromptError = error instanceof ApiError ? error.message : "Couldn't update the quiz preference.";
    } finally {
      quizPromptSaving = false;
    }
  }

  async function discard(draft: AiDraftDTO) {
    await api.discardDraft(jobId, draft.id);
    await poll();
  }

  $: pending = job?.drafts.filter((d) => d.status === "pending") ?? [];
  $: resolved = job?.drafts.filter((d) => d.status !== "pending") ?? [];
  $: allResolved = job && job.drafts.length > 0 && pending.length === 0;
</script>

<button class="back" on:click={() => navigate(`/decks/${deckId}`)}>&larr; Back to deck</button>
<h1>{isReview ? "AI deck review" : "AI review"}</h1>

{#if error}
  <p class="error">{error}</p>
{:else if !job}
  <p class="muted">Loading…</p>
{:else if job.status !== "ready" && job.status !== "failed"}
  <p class="muted">{STATUS_LABEL[job.status]}</p>
{:else if job.status === "failed"}
  <p class="error">{job.error ?? "Generation failed."}</p>
{:else if job.drafts.length === 0}
  <p class="muted">{isReview ? "No issues found — this deck looks solid." : "No groundable cards could be drawn from this source."}</p>
{:else}
  <p class="muted">
    {isReview
      ? "AI flagged these cards as possibly having a factual or clarity issue. Nothing changes in your deck until you accept a fix."
      : "Each card below cites where in the source it came from. Nothing is added to your deck until you accept it."}
  </p>

  {#if allResolved}
    <p class="done card-surface">All drafts resolved. <button class="btn btn-primary" on:click={() => navigate(`/decks/${deckId}`)}>Back to deck</button></p>
  {/if}

  <ul class="drafts">
    {#each pending as draft}
      <li class="card-surface draft">
        {#if editingId === draft.id}
          <input bind:value={editFront} placeholder="Front" />
          <textarea rows="3" bind:value={editBack} placeholder="Back"></textarea>
          <div class="row">
            <button class="btn btn-primary" on:click={() => accept(draft, true)}>Save & accept</button>
            <button class="btn" on:click={() => (editingId = null)}>Cancel</button>
          </div>
        {:else}
          <div class="diff">
            {#if isReview}
              <div class="issue">⚠️ {draft.issue}</div>
              <div class="original muted small">
                <div><s><Katex text={draft.originalFront ?? ""} /></s></div>
                <div><s><Katex text={draft.originalBack ?? ""} /></s></div>
              </div>
              <div class="arrow muted small">suggested fix ↓</div>
            {/if}
            <div class="front"><span class="qa-label">Q</span><Katex text={draft.generatedFront} /></div>
            <div class="back muted"><span class="qa-label">A</span><Katex text={draft.generatedBack} /></div>
            {#if draft.sourceCitation}<div class="citation">📎 {draft.sourceCitation}</div>{/if}
          </div>
          <div class="row">
            <button class="btn btn-primary" on:click={() => accept(draft, false)}>{isReview ? "Accept fix" : "Accept"}</button>
            <button class="btn" on:click={() => startEdit(draft)}>Edit</button>
            <button class="btn btn-danger" on:click={() => discard(draft)}>{isReview ? "Keep original" : "Discard"}</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  {#if resolved.length > 0}
    <h3 class="muted">Resolved ({resolved.length})</h3>
    <ul class="drafts resolved">
      {#each resolved as draft}
        <li class="card-surface draft resolved-item">
          <div class="front"><span class="qa-label">Q</span><Katex text={draft.editedFront ?? draft.generatedFront} /></div>
          <span class="tag" class:accepted={draft.status === "accepted"}>{draft.status === "accepted" ? (isReview ? "fixed" : "accepted") : (isReview ? "kept original" : "discarded")}</span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if quizPromptCard}
    <div class="prompt-backdrop">
      <dialog open class="card-surface quiz-prompt" aria-labelledby="quiz-prompt-title">
        <h2 id="quiz-prompt-title">Use this card in quizzes?</h2>
        <p class="muted">You accepted:</p>
        <div class="accepted-question"><Katex text={quizPromptCard.front} /></div>
        <p class="muted">Would you like to include it in multiple-choice and fill-in-the-blank quizzes?</p>
        {#if quizPromptError}<p class="error">{quizPromptError}</p>{/if}
        <div class="row">
          <button class="btn btn-primary" on:click={() => chooseQuizPreference(true)} disabled={quizPromptSaving}>
            {quizPromptSaving ? "Saving…" : "Yes, use in quizzes"}
          </button>
          <button class="btn" on:click={() => chooseQuizPreference(false)} disabled={quizPromptSaving}>No, not now</button>
        </div>
      </dialog>
    </div>
  {/if}
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .done { padding: 1rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
  .drafts { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.8rem; }
  .draft { padding: 1rem; }
  .front { font-weight: 600; margin-bottom: 0.35rem; }
  .qa-label { display: inline-flex; align-items: center; justify-content: center; width: 1.35rem; height: 1.35rem; margin-right: 0.5rem; border-radius: 999px; background: var(--accent-strong); color: white; font-size: 0.72rem; vertical-align: middle; }
  .back .qa-label { background: var(--surface-2); color: var(--text-dim); border: 1px solid var(--border); }
  .citation { margin-top: 0.5rem; font-size: 0.8rem; color: var(--accent); }
  .issue { color: var(--warn); font-size: 0.85rem; margin-bottom: 0.6rem; }
  .original { margin-bottom: 0.4rem; }
  .arrow { margin-bottom: 0.4rem; }
  .row { display: flex; gap: 0.5rem; margin-top: 0.8rem; }
  .draft textarea, .draft input { width: 100%; margin-bottom: 0.5rem; }
  .resolved-item { display: flex; justify-content: space-between; align-items: center; opacity: 0.7; }
  .tag { font-size: 0.75rem; text-transform: uppercase; color: var(--bad); }
  .tag.accepted { color: var(--good); }
  .error { color: var(--bad); }
  .prompt-backdrop { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 1.5rem; background: rgba(11, 14, 20, 0.58); }
  .quiz-prompt { position: fixed; inset: 0; width: min(calc(100% - 3rem), 460px); height: fit-content; max-height: calc(100vh - 3rem); margin: auto; padding: 1.5rem; overflow: auto; box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32); }
  .quiz-prompt h2 { margin: 0 0 0.65rem; }
  .quiz-prompt p { line-height: 1.5; }
  .accepted-question { margin: 0.5rem 0 1rem; padding: 0.8rem; border-left: 3px solid var(--accent); border-radius: 0 8px 8px 0; background: var(--surface-2); font-weight: 600; }
</style>
