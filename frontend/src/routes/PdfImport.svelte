<script lang="ts">
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";

  export let deckId: string;

  let mode: "pdf" | "url" = "pdf";
  let dragOver = false;
  let uploading = false;
  let error = "";
  let fileInput: HTMLInputElement;
  let url = "";

  async function handleFile(file: File | undefined) {
    if (!file) return;
    error = "";
    if (file.type !== "application/pdf") {
      error = "Only PDF files are supported.";
      return;
    }
    uploading = true;
    try {
      const { job } = await api.uploadPdf(deckId, file);
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
      const { job } = await api.importUrl(deckId, url.trim());
      navigate(`/decks/${deckId}/jobs/${job.id}/review`);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Import failed.";
    } finally {
      uploading = false;
    }
  }
</script>

<button class="back" on:click={() => navigate(`/decks/${deckId}`)}>&larr; Back to deck</button>

<h1>Import cards</h1>

<div class="tabs">
  <button class="tab" class:active={mode === "pdf"} on:click={() => { mode = "pdf"; error = ""; }}>From PDF</button>
  <button class="tab" class:active={mode === "url"} on:click={() => { mode = "url"; error = ""; }}>From URL</button>
</div>

{#if mode === "pdf"}
  <p class="muted">Upload lecture slides — we transcribe them and draft cards grounded in the source text, each citing the slide it came from. You'll review every card before it's added.</p>

  <div
    class="dropzone card-surface"
    class:drag={dragOver}
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
      <p class="muted small">Max 20MB</p>
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
    <button class="btn btn-primary" type="submit" disabled={uploading || !url.trim()}>
      {uploading ? "Importing…" : "Import"}
    </button>
  </form>
{/if}

{#if error}<p class="error">{error}</p>{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .tabs { display: flex; gap: 0.5rem; margin: 1rem 0 1.25rem; }
  .tab {
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }
  .tab.active { color: var(--text); border-color: var(--accent); background: var(--surface); font-weight: 600; }
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
  .small { font-size: 0.8rem; }
  .error { color: var(--bad); margin-top: 1rem; }
</style>
