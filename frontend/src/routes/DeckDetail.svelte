<script lang="ts">
  import { onMount } from "svelte";
  import type { CardDTO, CardDifficulty } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;

  let cards: CardDTO[] = [];
  let loading = true;
  let search = "";
  let tagFilter = "";
  let cardIndex = 0;
  let flipped = false;
  let editing = false;
  let editingCardId: string | null = null;
  let editFront = "";
  let editBack = "";
  let editTags = "";
  let editSaving = false;
  let editError = "";
  let quizPromptCard: CardDTO | null = null;
  let quizPromptSaving = false;
  let quizPromptError = "";
  const FINISHED_TAG = "finished";
  const UNFINISHED_TAG = "unfinished";
  let memorizedSavingCardId = "";
  let memorizedError = "";
  let difficultySavingCardId = "";
  let difficultyError = "";

  $: allTags = [...new Set(cards.flatMap((card) => card.tags))].sort();
  $: visibleCards = cards.filter((card) => {
    const query = search.trim().toLowerCase();
    return (!query || card.front.toLowerCase().includes(query) || card.back.toLowerCase().includes(query))
      && (!tagFilter || card.tags.includes(tagFilter));
  });
  $: if (cardIndex >= visibleCards.length) {
    cardIndex = 0;
    flipped = false;
  }
  $: currentCard = visibleCards[cardIndex] ?? null;

  async function load() {
    loading = true;
    const res = await api.listCards(deckId);
    cards = res.cards;
    loading = false;
  }

  async function removeCard(cardId: string) {
    if (!confirm("Delete this card?")) return;
    await api.deleteCard(deckId, cardId);
    await load();
  }

  async function resumeStudying(cardId: string) {
    await api.updateCard(deckId, cardId, { retired: false });
    await load();
  }

  function startEdit(card: CardDTO) {
    editFront = card.front;
    editBack = card.back;
    editTags = card.tags.join(", ");
    editError = "";
    editingCardId = card.id;
    editing = true;
  }

  async function saveEdit(card: CardDTO) {
    if (!editFront.trim() || !editBack.trim()) {
      editError = "Both the question and answer are required.";
      return;
    }

    editSaving = true;
    editError = "";
    try {
      const { card: updatedCard } = await api.updateCard(deckId, card.id, {
        front: editFront.trim(),
        back: editBack.trim(),
        tags: editTags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      editing = false;
      editingCardId = null;
      quizPromptCard = updatedCard;
      quizPromptError = "";
      await load();
    } catch (error) {
      editError = error instanceof ApiError ? error.message : "Couldn't save this card.";
    } finally {
      editSaving = false;
    }
  }

  function withProgressTag(tags: string[], memorized: boolean) {
    return [
      ...tags.filter((tag) => tag !== FINISHED_TAG && tag !== UNFINISHED_TAG),
      memorized ? FINISHED_TAG : UNFINISHED_TAG,
    ];
  }

  async function setMemorized(card: CardDTO, memorized: boolean) {
    if (memorizedSavingCardId) return;

    memorizedSavingCardId = card.id;
    memorizedError = "";
    // The first status change also labels every remaining unclassified card as unfinished.
    const cardsToUpdate = cards.filter((otherCard) =>
      otherCard.id === card.id || (!otherCard.tags.includes(FINISHED_TAG) && !otherCard.tags.includes(UNFINISHED_TAG))
    );
    try {
      await Promise.all(cardsToUpdate.map((otherCard) =>
        api.updateCard(deckId, otherCard.id, {
          tags: withProgressTag(otherCard.tags, otherCard.id === card.id ? memorized : false),
        })
      ));
      const updatedIds = new Set(cardsToUpdate.map((otherCard) => otherCard.id));
      cards = cards.map((otherCard) => updatedIds.has(otherCard.id)
        ? { ...otherCard, tags: withProgressTag(otherCard.tags, otherCard.id === card.id ? memorized : false) }
        : otherCard
      );
    } catch (error) {
      memorizedError = error instanceof ApiError ? error.message : "Couldn't update the memorized status.";
      await load();
    } finally {
      memorizedSavingCardId = "";
    }
  }

  async function setDifficulty(card: CardDTO, difficulty: CardDifficulty) {
    if (difficultySavingCardId || difficulty === card.difficulty) return;

    difficultySavingCardId = card.id;
    difficultyError = "";
    try {
      const { card: updatedCard } = await api.updateCard(deckId, card.id, { difficulty });
      cards = cards.map((otherCard) => otherCard.id === updatedCard.id ? updatedCard : otherCard);
    } catch (error) {
      difficultyError = error instanceof ApiError ? error.message : "Couldn't update the card difficulty.";
    } finally {
      difficultySavingCardId = "";
    }
  }

  async function chooseQuizPreference(includeInQuiz: boolean) {
    if (!quizPromptCard || quizPromptSaving) return;

    quizPromptSaving = true;
    quizPromptError = "";
    try {
      await api.updateCard(deckId, quizPromptCard.id, { includeInQuiz });
      quizPromptCard = null;
      await load();
    } catch (error) {
      quizPromptError = error instanceof ApiError ? error.message : "Couldn't update the quiz preference.";
    } finally {
      quizPromptSaving = false;
    }
  }

  function moveCard(direction: -1 | 1) {
    if (visibleCards.length < 2 || editing) return;
    cardIndex = (cardIndex + direction + visibleCards.length) % visibleCards.length;
    flipped = false;
  }

  function toggleCard() {
    if (currentCard) flipped = !flipped;
  }

  let reviewing = false;
  let reviewError = "";

  async function startAiReview() {
    if (cards.length === 0) return;
    reviewing = true;
    reviewError = "";
    try {
      const { job } = await api.startDeckReview(deckId);
      navigate(`/decks/${deckId}/jobs/${job.id}/review`);
    } catch (e) {
      reviewError = e instanceof ApiError ? e.message : "Couldn't start AI review.";
      reviewing = false;
    }
  }

  onMount(load);
</script>

<button class="back" on:click={() => navigate("/decks")}>&larr; All decks</button>

<div class="actions">
  <button class="btn btn-primary" data-tour-target="add-cards" on:click={() => navigate(`/decks/${deckId}/add-cards`)}>Add cards</button>
  <button class="btn" on:click={startAiReview} disabled={reviewing || cards.length === 0} title="Have AI check this deck's cards for factual or clarity issues">
    {reviewing ? "Starting review…" : "AI review"}
  </button>
  <button class="btn" data-tour-target="study-mode" on:click={() => navigate(`/decks/${deckId}/study`)}>Study</button>
  <button class="btn" data-tour-target="quiz-mode" on:click={() => navigate(`/decks/${deckId}/quiz`)}>Quiz</button>
  <button class="btn" data-tour-target="self-check-mode" on:click={() => navigate(`/decks/${deckId}/selfcheck`)}>Self-check</button>
  <a class="btn" href={api.exportAnkiUrl(deckId)}>Export (Anki)</a>
</div>

{#if reviewError}<p class="error">{reviewError}</p>{/if}
{#if memorizedError}<p class="error">{memorizedError}</p>{/if}
{#if difficultyError}<p class="error">{difficultyError}</p>{/if}

<div class="filters">
  <input type="search" placeholder="Search questions and answers…" bind:value={search} />
  <select bind:value={tagFilter} aria-label="Filter by tag">
    <option value="">All tags</option>
    {#each allTags as tag}<option value={tag}>{tag}</option>{/each}
  </select>
</div>

{#if loading}
  <p class="muted">Loading…</p>
{:else if cards.length === 0}
  <div class="card-surface empty-state">
    <p>No cards yet.</p>
    <button class="btn btn-primary" on:click={() => navigate(`/decks/${deckId}/add-cards`)}>Add cards</button>
  </div>
{:else if visibleCards.length === 0}
  <p class="muted">No cards match this filter.</p>
{:else}
  {@const card = currentCard!}
  <div class="viewer">
    <button class="card-arrow" on:click={() => moveCard(-1)} disabled={visibleCards.length < 2 || editing} aria-label="Previous card">&larr;</button>
    <div class="flashcard-wrap">
      <div
        class="card-surface flashcard"
        class:flipped
        on:click={toggleCard}
        on:keydown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleCard();
          }
        }}
        role="button"
        tabindex="0"
        aria-label={flipped ? "Show the question" : "Show the answer"}
      >
        <p class="face-label muted small">{flipped ? "Answer" : "Question"}</p>
        <div class="face"><Katex text={flipped ? card.back : card.front} /></div>
        <p class="muted small hint">Click the card to {flipped ? "see the question" : "reveal the answer"}</p>
      </div>
      <label class="memorized-control" title="Mark this card as memorized">
        <input
          type="checkbox"
          checked={card.tags.includes(FINISHED_TAG)}
          disabled={!!memorizedSavingCardId}
          on:change={(event) => setMemorized(card, (event.currentTarget as HTMLInputElement).checked)}
        />
        <span>Memorized</span>
      </label>
    </div>
    <button class="card-arrow" on:click={() => moveCard(1)} disabled={visibleCards.length < 2 || editing} aria-label="Next card">&rarr;</button>
  </div>
  <div class="card-meta">
    <span class="muted small">Card {cardIndex + 1} of {visibleCards.length}</span>
    {#if card.source && card.source !== "manual"}<span class="source muted small">{card.source}</span>{/if}
    <select
      class="pill difficulty difficulty-control"
      value={card.difficulty}
      aria-label="Set card difficulty"
      title="Set card difficulty"
      disabled={difficultySavingCardId === card.id}
      on:change={(event) => setDifficulty(card, (event.currentTarget as HTMLSelectElement).value as CardDifficulty)}
    >
      <option value="easy">Easy</option>
      <option value="medium">Medium</option>
      <option value="hard">Hard</option>
    </select>
    {#if card.retired}<span class="pill retired">Retired from Study</span>{/if}
    {#if card.tags.length}<div class="tags">{#each card.tags as tag}<span>{tag}</span>{/each}</div>{/if}
    <button class="edit" on:click={() => startEdit(card)}>Edit card</button>
    {#if card.retired}
      <button class="edit" on:click={() => resumeStudying(card.id)}>Resume studying</button>
    {/if}
    <button class="delete" on:click={() => removeCard(card.id)}>Delete card</button>
  </div>
  {#if editing && editingCardId === card.id}
    <form class="card-surface editor" on:submit|preventDefault={() => saveEdit(card)}>
      <h2>Edit card</h2>
      <textarea rows="3" bind:value={editFront} placeholder="Question / front" disabled={editSaving}></textarea>
      <textarea rows="4" bind:value={editBack} placeholder="Answer / back" disabled={editSaving}></textarea>
      <input bind:value={editTags} placeholder="Tags, comma separated" disabled={editSaving} />
      {#if editError}<p class="error">{editError}</p>{/if}
      <div class="editor-actions">
        <button class="btn" type="button" on:click={() => { editing = false; editingCardId = null; }} disabled={editSaving}>Cancel</button>
        <button class="btn btn-primary" type="submit" disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  {/if}
{/if}

{#if quizPromptCard}
  <div class="prompt-backdrop">
    <dialog open class="card-surface quiz-prompt" aria-labelledby="quiz-prompt-title">
      <h2 id="quiz-prompt-title">Use this card in quizzes?</h2>
      <p class="muted">You updated:</p>
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
  .actions { display: flex; gap: 0.6rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .actions a.btn { text-decoration: none; display: inline-flex; align-items: center; }
  .actions .btn { min-height: 2.75rem; padding: 0.65rem 1.2rem; background: var(--surface); border-color: color-mix(in srgb, var(--accent) 28%, var(--border)); font-weight: 600; }
  .actions .btn-primary { background: #2563eb; border-color: #2563eb; box-shadow: 0 5px 12px rgba(37, 99, 235, 0.28); }
  .actions .btn-primary:hover { background: #1d4ed8; border-color: #1d4ed8; }
  .error { color: var(--bad); margin-bottom: 1rem; }
  .small { font-size: 0.8rem; }
  .filters { display: flex; gap: 0.6rem; margin-bottom: 1rem; }
  .filters input { flex: 1; }
  .tags { display: flex; gap: 0.35rem; margin-top: 0.5rem; }
  .tags span { font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 999px; background: var(--surface-2); color: var(--text-dim); }
  .pill.retired { font-size: 0.72rem; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--surface-2); color: var(--text-dim); font-weight: 600; }
  .pill.difficulty { font-size: 0.72rem; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--surface-2); color: var(--text-dim); font-weight: 600; text-transform: capitalize; }
  select.difficulty-control { border: none; cursor: pointer; font: inherit; }
  select.difficulty-control:disabled { cursor: wait; opacity: 0.65; }
  .viewer { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.75rem; align-items: center; }
  .flashcard-wrap { position: relative; min-width: 0; }
  .flashcard {
    min-height: 280px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease;
  }
  .flashcard:hover, .flashcard:focus-visible { border-color: var(--accent); transform: translateY(-2px); outline: none; }
  .flashcard.flipped { background: var(--surface-2); }
  .memorized-control { position: absolute; top: 0.9rem; right: 0.9rem; display: flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.45rem; border-radius: 6px; background: color-mix(in srgb, var(--surface) 88%, transparent); color: var(--text-dim); font-size: 0.75rem; cursor: pointer; }
  .memorized-control input { margin: 0; accent-color: var(--good); }
  .memorized-control:has(input:checked) { color: var(--good); }
  .face-label { margin: 0 0 1rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .face { font-size: 1.15rem; font-weight: 600; }
  .hint { margin: 1.5rem 0 0; }
  .card-arrow { border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 999px; width: 2.75rem; height: 2.75rem; font-size: 1.25rem; }
  .card-arrow:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .card-arrow:disabled { cursor: default; opacity: 0.35; }
  .card-meta { display: flex; align-items: center; justify-content: center; gap: 0.7rem; flex-wrap: wrap; margin-top: 0.75rem; }
  .source { margin-top: 0.4rem; }
  .delete {
    background: none; border: none; color: var(--text-dim); font-size: 0.8rem;
  }
  .delete:hover { color: var(--bad); }
  .edit { background: none; border: none; color: var(--accent); font-size: 0.8rem; }
  .edit:hover { color: var(--accent-strong); }
  .editor { margin-top: 1.25rem; padding: 1.2rem; display: flex; flex-direction: column; gap: 0.7rem; }
  .editor h2 { font-size: 1rem; margin: 0; }
  .editor textarea, .editor input { width: 100%; }
  .editor-actions { display: flex; gap: 0.6rem; justify-content: flex-end; }
  .empty-state { padding: 2rem; text-align: center; }
  .prompt-backdrop { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 1.5rem; background: rgba(11, 14, 20, 0.58); }
  .quiz-prompt { position: fixed; inset: 0; width: min(calc(100% - 3rem), 460px); height: fit-content; max-height: calc(100vh - 3rem); margin: auto; padding: 1.5rem; overflow: auto; box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32); }
  .quiz-prompt h2 { margin: 0 0 0.65rem; }
  .quiz-prompt p { line-height: 1.5; }
  .accepted-question { margin: 0.5rem 0 1rem; padding: 0.8rem; border-left: 3px solid var(--accent); border-radius: 0 8px 8px 0; background: var(--surface-2); font-weight: 600; }
  .prompt-actions { display: flex; gap: 0.5rem; margin-top: 0.8rem; }
  @media (max-width: 600px) {
    .viewer { grid-template-columns: 1fr 1fr; }
    .flashcard-wrap { grid-column: 1 / -1; grid-row: 1; }
    .flashcard { min-height: 240px; }
    .card-arrow:first-child { grid-column: 1; grid-row: 2; justify-self: end; }
    .card-arrow:last-child { grid-column: 2; grid-row: 2; justify-self: start; }
  }
</style>
