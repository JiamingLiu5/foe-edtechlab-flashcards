<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;

  type Question = { cardId: string; front: string; options: string[]; answer: string };

  let questions: Question[] = [];
  let index = 0;
  let selected: string | null = null;
  let score = 0;
  let loading = true;

  async function load() {
    loading = true;
    const res = await api.getQuiz(deckId);
    questions = res.questions;
    loading = false;
  }

  function choose(option: string) {
    if (selected) return;
    selected = option;
    if (option === questions[index].answer) score += 1;
  }

  function next() {
    selected = null;
    index += 1;
  }

  onMount(load);
</script>

<button class="back" on:click={() => navigate(`/decks/${deckId}`)}>&larr; Back to deck</button>
<h1>Quiz</h1>

{#if loading}
  <p class="muted">Loading…</p>
{:else if questions.length === 0}
  <p class="muted">Need at least 4 cards in this deck to generate multiple-choice questions.</p>
{:else if index >= questions.length}
  <div class="card-surface done">
    <p>Score: {score} / {questions.length}</p>
    <button class="btn btn-primary" on:click={() => { index = 0; score = 0; load(); }}>Play again</button>
  </div>
{:else}
  {@const q = questions[index]}
  <p class="muted small">Question {index + 1} of {questions.length}</p>
  <div class="card-surface question">
    <div class="front"><Katex text={q.front} /></div>
    <div class="options">
      {#each q.options as option}
        <button
          class="option"
          class:correct={selected && option === q.answer}
          class:wrong={selected === option && option !== q.answer}
          disabled={!!selected}
          on:click={() => choose(option)}
        >
          <Katex text={option} />
        </button>
      {/each}
    </div>
    {#if selected}
      <button class="btn btn-primary next" on:click={next}>Next</button>
    {/if}
  </div>
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .small { font-size: 0.8rem; }
  .question { padding: 1.5rem; }
  .front { font-weight: 600; font-size: 1.1rem; margin-bottom: 1.1rem; }
  .options { display: flex; flex-direction: column; gap: 0.55rem; }
  .option {
    text-align: left;
    padding: 0.7rem 0.9rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
  }
  .option.correct { border-color: var(--good); background: rgba(74, 222, 128, 0.12); }
  .option.wrong { border-color: var(--bad); background: rgba(248, 113, 113, 0.12); }
  .next { margin-top: 1.25rem; }
  .done { padding: 2rem; text-align: center; }
</style>
