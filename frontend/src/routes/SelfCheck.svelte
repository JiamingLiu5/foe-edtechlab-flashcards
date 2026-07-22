<script lang="ts">
  import { onMount } from "svelte";
  import type { CardDTO, SelfCheckGradeDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;

  let cards: CardDTO[] = [];
  let index = 0;
  let answer = "";
  let grading = false;
  let result: SelfCheckGradeDTO | null = null;
  let error = "";
  let loading = true;

  async function load() {
    loading = true;
    const res = await api.listCards(deckId);
    cards = shuffle(res.cards);
    loading = false;
  }

  function shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function submit() {
    if (!answer.trim() || !cards[index]) return;
    grading = true;
    error = "";
    try {
      result = await api.gradeSelfCheck(cards[index].id, answer.trim());
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Grading failed.";
    } finally {
      grading = false;
    }
  }

  function next() {
    result = null;
    answer = "";
    error = "";
    index += 1;
  }

  onMount(load);
</script>

<button class="back" on:click={() => navigate(`/decks/${deckId}`)}>&larr; Back to deck</button>
<h1>Self-check</h1>

{#if loading}
  <p class="muted">Loading…</p>
{:else if cards.length === 0}
  <p class="muted">This deck has no cards yet.</p>
{:else if index >= cards.length}
  <div class="card-surface done">
    <p>You've been through every card in this deck.</p>
    <button class="btn btn-primary" on:click={() => { index = 0; load(); }}>Start again</button>
  </div>
{:else}
  {@const card = cards[index]}
  <p class="muted small">Card {index + 1} of {cards.length}</p>
  <div class="card-surface question">
    <div class="front"><Katex text={card.front} /></div>

    {#if !result}
      <textarea rows="4" placeholder="Type your answer…" bind:value={answer}></textarea>
      <button class="btn btn-primary" on:click={submit} disabled={grading}>{grading ? "Grading…" : "Submit"}</button>
      {#if error}<p class="error">{error}</p>{/if}
    {:else}
      <div class="your-answer muted">Your answer: {answer}</div>
      <div class="score" class:good={result.score >= 70} class:bad={result.score < 40}>{result.score}/100</div>
      <p>{result.feedback}</p>
      {#if result.missing.length}
        <ul class="missing">
          {#each result.missing as m}<li>{m}</li>{/each}
        </ul>
      {/if}
      <div class="reference muted">
        <strong>Reference answer:</strong> <Katex text={card.back} />
      </div>
      <button class="btn btn-primary" on:click={next}>Next card</button>
    {/if}
  </div>
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .small { font-size: 0.8rem; }
  .question { padding: 1.5rem; }
  .front { font-weight: 600; font-size: 1.1rem; margin-bottom: 1.1rem; }
  textarea { width: 100%; margin-bottom: 0.75rem; }
  .score { font-size: 1.5rem; font-weight: 700; margin: 0.75rem 0; }
  .score.good { color: var(--good); }
  .score.bad { color: var(--bad); }
  .your-answer { margin-bottom: 0.5rem; font-style: italic; }
  .missing { margin: 0.5rem 0; }
  .reference { margin: 1rem 0; padding-top: 0.75rem; border-top: 1px solid var(--border); }
  .done { padding: 2rem; text-align: center; }
  .error { color: var(--bad); }
</style>
