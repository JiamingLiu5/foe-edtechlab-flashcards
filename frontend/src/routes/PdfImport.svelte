<script lang="ts">
  import type { CardDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;

  let mode: "manual" | "paste" | "pdf" | "url" = "manual";
  let dragOver = false;
  let uploading = false;
  let saving = false;
  let error = "";
  let fileInput: HTMLInputElement;
  let url = "";
  let front = "";
  let back = "";
  let tags = "";
  let pastedText = "";
  let requestedCardCount = 25;
  let quizPromptCard: CardDTO | null = null;
  let quizPromptSaving = false;
  let quizPromptError = "";

  function selectMode(nextMode: typeof mode) {
    mode = nextMode;
    error = "";
  }

  async function addCard() {
    if (!front.trim() || !back.trim()) return;
    saving = true;
    error = "";
    try {
      const { cards } = await api.createCard(deckId, front.trim(), back.trim(), tags.split(",").map((tag) => tag.trim()).filter(Boolean));
      front = "";
      back = "";
      tags = "";
      quizPromptCard = cards[0] ?? null;
      quizPromptError = "";
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't add this card.";
    } finally {
      saving = false;
    }
  }

  async function chooseQuizPreference(includeInQuiz: boolean) {
    if (!quizPromptCard || quizPromptSaving) return;

    quizPromptSaving = true;
    quizPromptError = "";
    try {
      await api.updateCard(deckId, quizPromptCard.id, { includeInQuiz });
      quizPromptCard = null;
    } catch (e) {
      quizPromptError = e instanceof ApiError ? e.message : "Couldn't update the quiz preference.";
    } finally {
      quizPromptSaving = false;
    }
  }

  async function generateFromPastedText() {
    if (!pastedText.trim()) return;
    uploading = true;
    error = "";
    try {
      const { job } = await api.generateFromText(deckId, pastedText.trim(), requestedCardCount);
      navigate(`/decks/${deckId}/jobs/${job.id}/review`);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't draft cards from this text.";
    } finally {
      uploading = false;
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    error = "";
    if (file.type !== "application/pdf") {
      error = "Only PDF files are supported.";
      return;
    }
    uploading = true;
    try {
      const { job } = await api.uploadPdf(deckId, file, requestedCardCount);
      navigate(`/decks/${deckId}/jobs/${job.id}/review`);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Upload failed.";
    } finally {
      uploading = false;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    handleFile(e.dataTransfer?.files?.[0]);
  }

  async function submitUrl() {
    if (!url.trim()) return;
    error = "";
    uploading = true;
    try {
      const { job } = await api.importUrl(deckId, url.trim(), requestedCardCount);
      navigate(`/decks/${deckId}/jobs/${job.id}/review`);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Import failed.";
    } finally {
      uploading = false;
    }
  }
</script>

<button class="back" on:click={() => navigate(`/decks/${deckId}`)}>&larr; Back to deck</button>

<h1>Add cards</h1>
<p class="muted">Create cards yourself, or ask AI to draft reviewable cards from pasted text, a PDF, or a public webpage.</p>

<div class="tabs">
  <button class="tab" class:active={mode === "manual"} on:click={() => selectMode("manual")}>Create a card</button>
  <button class="tab" class:active={mode === "paste"} on:click={() => selectMode("paste")}>Paste cards</button>
  <button class="tab" class:active={mode === "pdf"} on:click={() => selectMode("pdf")}>From PDF</button>
  <button class="tab" class:active={mode === "url"} on:click={() => selectMode("url")}>From link</button>
</div>

{#if mode === "manual"}
  <form class="manual-form card-surface" on:submit|preventDefault={addCard}>
    <textarea rows="3" placeholder="Front (LaTeX supported)" bind:value={front} disabled={saving}></textarea>
    <textarea rows="3" placeholder="Back (LaTeX supported)" bind:value={back} disabled={saving}></textarea>
    <input placeholder="Tags, comma separated (optional)" bind:value={tags} disabled={saving} />
    <button class="btn btn-primary" type="submit" disabled={saving || !front.trim() || !back.trim()}>
      {saving ? "Adding…" : "Add card"}
    </button>
  </form>
{:else if mode === "paste"}
  <form class="manual-form card-surface" on:submit|preventDefault={generateFromPastedText}>
    <p class="muted small">Paste study notes, lecture text, or other source material. AI will draft cards from it for you to review before adding them.</p>
    <textarea rows="9" placeholder="Paste your study text here…" bind:value={pastedText} disabled={uploading}></textarea>
    <label class="card-count">
      <span>Maximum cards to draft</span>
      <input type="number" min="1" step="1" bind:value={requestedCardCount} disabled={uploading} />
      <small>AI will generate no more than this number. Your administrator may set a maximum.</small>
    </label>
    <button class="btn btn-primary" type="submit" disabled={uploading || !pastedText.trim()}>
      {uploading ? "Drafting…" : "Draft cards with AI"}
    </button>
  </form>
{:else if mode === "pdf"}
  <p class="muted">Upload lecture slides — we transcribe them and draft cards grounded in the source text, each citing the slide it came from. You'll review every card before it's added.</p>

  <label class="card-count">
    <span>Cards to draft</span>
    <input type="number" min="1" step="1" bind:value={requestedCardCount} disabled={uploading} />
    <small>Your administrator may set a maximum.</small>
  </label>

  <div
    class="dropzone card-surface"
    class:drag={dragOver}
    on:keydown={(event) => {
      if (event.key === "Enter" || event.key === " ") fileInput?.click();
    }}
    on:dragover|preventDefault={() => (dragOver = true)}
    on:dragleave={() => (dragOver = false)}
    on:drop={onDrop}
    on:click={() => fileInput.click()}
    role="button"
    tabindex="0"
  >
    {#if uploading}
      <p>Uploading…</p>
    {:else}
      <p>Drag a PDF here, or click to choose a file</p>
      <p class="muted small">Max 20MB. Your administrator may also set a page limit.</p>
    {/if}
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept="application/pdf"
    style="display: none"
    on:change={(e) => handleFile((e.target as HTMLInputElement).files?.[0])}
  />
{:else}
  <p class="muted">Paste a link to a public webpage — we read its text and draft cards grounded in it, each citing the section it came from. You'll review every card before it's added.</p>

  <form class="url-form card-surface" on:submit|preventDefault={submitUrl}>
    <input type="url" placeholder="https://example.com/lecture-notes" bind:value={url} disabled={uploading} required />
    <label class="card-count compact">
      <span>Cards to draft</span>
      <input type="number" min="1" step="1" bind:value={requestedCardCount} disabled={uploading} />
    </label>
    <button class="btn btn-primary" type="submit" disabled={uploading || !url.trim()}>
      {uploading ? "Importing…" : "Draft cards"}
    </button>
  </form>
{/if}

{#if error}<p class="error">{error}</p>{/if}

{#if quizPromptCard}
  <div class="prompt-backdrop">
    <dialog open class="card-surface quiz-prompt" aria-labelledby="quiz-prompt-title">
      <h2 id="quiz-prompt-title">Use this card in quizzes?</h2>
      <p class="muted">You created:</p>
      <div class="accepted-question"><Katex text={quizPromptCard.front} /></div>
      <p class="muted">Would you like to include it in multiple-choice and fill-in-the-blank quizzes?</p>
      {#if quizPromptError}<p class="error">{quizPromptError}</p>{/if}
      <div class="prompt-actions">
        <button class="btn btn-primary" on:click={() => chooseQuizPreference(true)} disabled={quizPromptSaving}>
          {quizPromptSaving ? "Saving…" : "Yes, use in quizzes"}
        </button>
        <button class="btn" on:click={() => chooseQuizPreference(false)} disabled={quizPromptSaving}>No, not now</button>
      </div>
    </dialog>
  </div>
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .tabs { display: flex; gap: 0.5rem; margin: 1rem 0 1.25rem; }
  .tab {
    border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
    background: color-mix(in srgb, var(--accent) 8%, var(--surface));
    color: var(--text);
    border-radius: 10px;
    padding: 0.72rem 1.2rem;
    font-size: 0.95rem;
    font-weight: 600;
  }
  .tab.active { color: white; border-color: #2563eb; background: #2563eb; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25); }
  .dropzone {
    border: 2px dashed var(--border);
    padding: 3rem 1.5rem;
    text-align: center;
    cursor: pointer;
    margin-top: 1.5rem;
  }
  .dropzone.drag { border-color: var(--accent); background: var(--surface-2); }
  .url-form { display: flex; gap: 0.6rem; padding: 1rem; margin-top: 1.5rem; }
  .url-form input { flex: 1; }
  .card-count { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 1rem; width: fit-content; font-weight: 600; }
  .card-count input { width: 7rem; }
  .card-count small { color: var(--text-dim); font-size: 0.8rem; font-weight: 400; }
  .card-count.compact { margin: 0; min-width: 7rem; }
  .card-count.compact span { font-size: 0.8rem; }
  .manual-form { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
  .manual-form textarea { width: 100%; }
  .manual-form .btn { align-self: flex-start; }
  .small { font-size: 0.8rem; }
  .error { color: var(--bad); margin-top: 1rem; }
  .prompt-backdrop { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 1.5rem; background: rgba(11, 14, 20, 0.58); }
  .quiz-prompt { position: fixed; inset: 0; width: min(calc(100% - 3rem), 460px); height: fit-content; max-height: calc(100vh - 3rem); margin: auto; padding: 1.5rem; overflow: auto; box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32); }
  .quiz-prompt h2 { margin: 0 0 0.65rem; }
  .quiz-prompt p { line-height: 1.5; }
  .accepted-question { margin: 0.5rem 0 1rem; padding: 0.8rem; border-left: 3px solid var(--accent); border-radius: 0 8px 8px 0; background: var(--surface-2); font-weight: 600; }
  .prompt-actions { display: flex; gap: 0.5rem; margin-top: 0.8rem; }
</style>
