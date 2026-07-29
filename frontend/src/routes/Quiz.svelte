<script lang="ts">
  import { onMount } from "svelte";
  import type { CardDTO, SelfCheckGradeDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;
  export let mode: "mcq" | "fill" | undefined = undefined;

  type Question = { cardId: string; front: string; options: string[]; answer: string };

  let questions: Question[] = [];
  let fillQuestions: CardDTO[] = [];
  let index = 0;
  let selected: string | null = null;
  let typedAnswer = "";
  let fillChecked = false;
  let checking = false;
  let fillResult: SelfCheckGradeDTO | null = null;
  let fillError = "";
  let score = 0;
  let loading = true;

  async function load() {
    loading = true;
    index = 0;
    selected = null;
    typedAnswer = "";
    fillChecked = false;
    checking = false;
    fillResult = null;
    fillError = "";
    score = 0;
    if (mode === "mcq") {
      const res = await api.getQuiz(deckId);
      questions = res.questions;
    } else if (mode === "fill") {
      const res = await api.listCards(deckId);
      fillQuestions = shuffle(res.cards);
    }
    loading = false;
  }

  function choose(option: string) {
    if (selected) return;
    selected = option;
    if (option === questions[index].answer) score += 1;
  }

  function next() {
    selected = null;
    typedAnswer = "";
    fillChecked = false;
    fillResult = null;
    fillError = "";
    index += 1;
  }

  async function checkFillAnswer() {
    const question = fillQuestions[index];
    if (!typedAnswer.trim() || !question || fillChecked || checking) return;

    checking = true;
    fillError = "";
    try {
      fillResult = await api.gradeSelfCheck(question.id, typedAnswer.trim());
      score += fillResult.score;
      fillChecked = true;
    } catch (error) {
      fillError = error instanceof ApiError ? error.message : "Your answer couldn't be checked right now.";
    } finally {
      checking = false;
    }
  }

  onMount(load);

  function shuffle<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
</script>

<button class="back" on:click={() => navigate(`/decks/${deckId}`)}>&larr; Back to deck</button>
{#if !mode}
  <h1>Choose your quiz</h1>
  <p class="muted">Choose a format each time you start a quiz.</p>
  <div class="mode-grid">
    <button class="card-surface mode-card" on:click={() => navigate(`/decks/${deckId}/quiz/mcq`)}>
      <strong>Multiple choice</strong>
      <span class="muted">Choose the correct answer from four options.</span>
    </button>
    <button class="card-surface mode-card" on:click={() => navigate(`/decks/${deckId}/quiz/fill`)}>
      <strong>Fill in the blank</strong>
      <span class="muted">Write your answer and get feedback from your AI teacher.</span>
    </button>
  </div>
{:else}
  <div class="quiz-heading">
    <h1>{mode === "mcq" ? "Multiple-choice quiz" : "Fill-in-the-blank quiz"}</h1>
    <button class="btn" on:click={() => navigate(`/decks/${deckId}/quiz`)}>Change format</button>
  </div>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if mode === "mcq" && questions.length === 0}
    <p class="muted">Need at least 4 cards in this deck to make a multiple-choice quiz.</p>
  {:else if mode === "fill" && fillQuestions.length === 0}
    <p class="muted">Add cards to this deck before starting a quiz.</p>
  {:else if mode === "mcq" && index >= questions.length}
    <div class="card-surface done">
      <p>Score: {score} / {questions.length}</p>
      <button class="btn btn-primary" on:click={load}>Play again</button>
    </div>
  {:else if mode === "fill" && index >= fillQuestions.length}
    <div class="card-surface done">
      <p>Average AI score: {Math.round(score / fillQuestions.length)}%</p>
      <button class="btn btn-primary" on:click={load}>Play again</button>
    </div>
  {:else if mode === "mcq"}
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
  {:else}
    {@const q = fillQuestions[index]}
    <p class="muted small">Question {index + 1} of {fillQuestions.length}</p>
    <form class="card-surface question" on:submit|preventDefault={checkFillAnswer}>
      <div class="front"><Katex text={q.front} /></div>
      <label for="fill-answer" class="muted small">Your answer</label>
      <textarea id="fill-answer" rows="4" bind:value={typedAnswer} disabled={fillChecked || checking} placeholder="Type your answer…"></textarea>
      {#if fillError}<p class="error">{fillError}</p>{/if}
      {#if fillChecked && fillResult}
        <div class:correct-answer={fillResult.score >= 70} class:answer-feedback>
          <strong>{fillResult.score >= 70 ? "Good answer" : "Keep working on it"} · {fillResult.score}%</strong>
          <p>{fillResult.feedback}</p>
          <p>Correct answer: <Katex text={q.back} /></p>
          {#if fillResult.missing.length}
            <p class="missing"><strong>Still to include:</strong> {fillResult.missing.join("; ")}</p>
          {/if}
        </div>
        <button class="btn btn-primary next" type="button" on:click={next}>Next</button>
      {:else}
        <button class="btn btn-primary next" type="submit" disabled={!typedAnswer.trim() || checking}>
          {checking ? "AI is checking…" : "Check with AI"}
        </button>
      {/if}
    </form>
  {/if}
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .mode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 1.5rem; }
  .mode-card { color: var(--text); padding: 1.5rem; text-align: left; display: flex; flex-direction: column; gap: 0.5rem; }
  .mode-card:hover { border-color: var(--accent); transform: translateY(-2px); }
  .quiz-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
  .quiz-heading h1 { margin: 0; }
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
  textarea { width: 100%; margin-top: 0.4rem; }
  .answer-feedback { margin-top: 1rem; padding: 0.75rem; border: 1px solid var(--bad); border-radius: 8px; background: rgba(248, 113, 113, 0.12); }
  .answer-feedback.correct-answer { border-color: var(--good); background: rgba(74, 222, 128, 0.12); }
  .answer-feedback p { margin: 0.35rem 0 0; }
  .missing { color: var(--text-dim); }
  .error { color: var(--bad); margin: 0.75rem 0 0; }
  @media (max-width: 600px) {
    .mode-grid { grid-template-columns: 1fr; }
    .quiz-heading { align-items: flex-start; flex-direction: column; }
  }
</style>
