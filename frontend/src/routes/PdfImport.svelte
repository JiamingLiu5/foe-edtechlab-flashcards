<script lang="ts">
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";

  export let deckId: string;

  let mode: "manual" | "bulk" | "pdf" | "url" = "manual";
  let dragOver = false;
  let uploading = false;
  let saving = false;
  let error = "";
  let fileInput: HTMLInputElement;
  let url = "";
  let front = "";
  let back = "";
  let tags = "";
  let bulkText = "";

  function selectMode(nextMode: typeof mode) {
    mode = nextMode;
    error = "";
  }

  async function addCard() {
    if (!front.trim() || !back.trim()) return;
    saving = true;
    error = "";
    try {
      await api.createCard(deckId, front.trim(), back.trim(), tags.split(",").map((tag) => tag.trim()).filter(Boolean));
      front = "";
      back = "";
      tags = "";
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't add this card.";
    } finally {
      saving = false;
    }
  }

  async function addBulk() {
    const cards = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [front, ...backParts] = line.split(/\t| \| /);
        return { front: front?.trim() ?? "", back: backParts.join(" | ").trim() };
      })
      .filter((card) => card.front && card.back);

    if (!cards.length) {
      error = "Add at least one line with a front and back separated by a tab or |.";
      return;
    }

    saving = true;
    error = "";
    try {
      await api.createCardsBulk(deckId, cards);
      bulkText = "";
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't add these cards.";
    } finally {
      saving = false;
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

<h1>Add cards</h1>
<p class="muted">Create cards yourself, paste several at once, or ask AI to draft cards from a PDF or public webpage.</p>

<div class="tabs">
  <button class="tab" class:active={mode === "manual"} on:click={() => selectMode("manual")}>Create a card</button>
  <button class="tab" class:active={mode === "bulk"} on:click={() => selectMode("bulk")}>Paste cards</button>
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
{:else if mode === "bulk"}
  <form class="manual-form card-surface" on:submit|preventDefault={addBulk}>
    <p class="muted small">One card per line: <code>front &lt;tab&gt; back</code> or <code>front | back</code></p>
    <textarea rows="9" placeholder={"What is the capital of France?\tParis"} bind:value={bulkText} disabled={saving}></textarea>
    <button class="btn btn-primary" type="submit" disabled={saving || !bulkText.trim()}>
      {saving ? "Adding…" : "Add all cards"}
    </button>
  </form>
{:else if mode === "pdf"}
  <p class="muted">Upload lecture slides — we transcribe them and draft cards grounded in the source text, each citing the slide it came from. You'll review every card before it's added.</p>

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
    <button class="btn btn-primary" type="submit" disabled={uploading || !url.trim()}>
      {uploading ? "Importing…" : "Draft cards"}
    </button>
  </form>
{/if}

{#if error}<p class="error">{error}</p>{/if}

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
  .manual-form { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
  .manual-form textarea { width: 100%; }
  .manual-form .btn { align-self: flex-start; }
  .small { font-size: 0.8rem; }
  .error { color: var(--bad); margin-top: 1rem; }
</style>
