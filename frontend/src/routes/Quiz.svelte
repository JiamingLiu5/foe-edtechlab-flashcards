<script lang="ts">
  import { onMount } from "svelte";
  import type { SelfCheckGradeDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;
  export let mode: "mcq" | "fill" | "mix" | undefined = undefined;

  type Question = { cardId: string; front: string; options: string[]; answer: string };
  type FillQuestion = { cardId: string; front: string; back: string };
  type MixedQuestion = { kind: "mcq" | "fill"; cardId: string; front: string; back: string; options: string[]; answer: string };

  let questions: Question[] = [];
  let fillQuestions: FillQuestion[] = [];
  let mixedQuestions: MixedQuestion[] = [];
  let index = 0;
  let selected: string | null = null;
  let typedAnswer = "";
  let fillChecked = false;
  let checking = false;
  let fillResult: SelfCheckGradeDTO | null = null;
  let fillError = "";
  let mcqScore = 0;
  let fillScore = 0;
  let fillAnswered = 0;
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
    mcqScore = 0;
    fillScore = 0;
    fillAnswered = 0;
    if (mode === "mcq") {
      const res = await api.getQuiz(deckId);
      questions = res.questions;
    } else if (mode === "fill") {
      const res = await api.getFillQuiz(deckId);
      fillQuestions = res.questions;
    } else if (mode === "mix") {
      const [mcq, fill] = await Promise.all([api.getQuiz(deckId), api.getFillQuiz(deckId)]);
      const mcqByCardId = new Map(mcq.questions.map((question) => [question.cardId, question]));
      mixedQuestions = fill.questions.map((question) => {
        const multipleChoice = mcqByCardId.get(question.cardId);
        return multipleChoice && Math.random() < 0.5
          ? { kind: "mcq", ...multipleChoice, back: multipleChoice.answer }
          : { kind: "fill", ...question, options: [], answer: question.back };
      });
    }
    loading = false;
  }

  function choose(option: string, answer: string) {
    if (selected) return;
    selected = option;
    if (option === answer) mcqScore += 1;
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
    const question = mode === "fill" ? fillQuestions[index] : mixedQuestions[index];
    if (!typedAnswer.trim() || !question || fillChecked || checking) return;

    checking = true;
    fillError = "";
    try {
      fillResult = await api.gradeSelfCheck(question.cardId, typedAnswer.trim());
      fillScore += fillResult.score;
      fillAnswered += 1;
      fillChecked = true;
    } catch (error) {
      fillError = error instanceof ApiError
        ? error.message
        : error instanceof DOMException && error.name === "AbortError"
          ? "AI grading took too long. Your answer was not submitted; please try again."
          : "Your answer couldn't be checked right now.";
    } finally {
      checking = false;
    }
  }

  onMount(load);

  function totalQuestions() {
    return mode === "mcq" ? questions.length : mode === "fill" ? fillQuestions.length : mixedQuestions.length;
  }

  function isFinished() {
    return index >= totalQuestions();
  }

  function currentMixedIsMcq() {
    return mixedQuestions[index]?.kind === "mcq";
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
    <button class="card-surface mode-card" on:click={() => navigate(`/decks/${deckId}/quiz/mix`)}>
      <strong>Mix</strong>
      <span class="muted">Get a random mix of multiple-choice and AI-marked fill-in questions.</span>
    </button>
  </div>
{:else}
  <div class="quiz-heading">
    <h1>{mode === "mcq" ? "Multiple-choice quiz" : mode === "fill" ? "Fill-in-the-blank quiz" : "Mixed quiz"}</h1>
    <button class="btn" on:click={() => navigate(`/decks/${deckId}/quiz`)}>Change format</button>
  </div>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if mode === "mcq" && questions.length === 0}
    <p class="muted">Need at least 4 cards in this deck to make a multiple-choice quiz.</p>
  {:else if mode === "fill" && fillQuestions.length === 0}
    <p class="muted">Add cards to this deck before starting a quiz.</p>
  {:else if mode === "mix" && mixedQuestions.length === 0}
    <p class="muted">Add cards to this deck before starting a quiz.</p>
  {:else if mode === "mcq" && isFinished()}
    <div class="card-surface done">
      <p>Score: {mcqScore} / {questions.length}</p>
      <button class="btn btn-primary" on:click={load}>Play again</button>
    </div>
  {:else if mode === "fill" && isFinished()}
    <div class="card-surface done">
      <p>Average AI score: {Math.round(fillScore / fillAnswered)}%</p>
      <button class="btn btn-primary" on:click={load}>Play again</button>
    </div>
  {:else if mode === "mix" && isFinished()}
    <div class="card-surface done">
      <p>Multiple choice: {mcqScore} / {mixedQuestions.filter((question) => question.kind === "mcq").length}</p>
      {#if fillAnswered}<p>Average AI score: {Math.round(fillScore / fillAnswered)}%</p>{/if}
      <button class="btn btn-primary" on:click={load}>Play again</button>
    </div>
  {:else if mode === "mcq" || currentMixedIsMcq()}
    {@const q = mode === "mcq" ? questions[index] : mixedQuestions[index]}
    <p class="muted small">Question {index + 1} of {totalQuestions()}</p>
    <div class="card-surface question">
      <div class="front"><Katex text={q.front} /></div>
      <div class="options">
        {#each q.options as option}
          <button
            class="option"
            class:correct={selected && option === q.answer}
            class:wrong={selected === option && option !== q.answer}
            disabled={!!selected}
          on:click={() => choose(option, q.answer)}
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
    {@const q = mode === "fill" ? fillQuestions[index] : mixedQuestions[index]}
    <p class="muted small">Question {index + 1} of {totalQuestions()}</p>
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
  .mode-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin-top: 1.5rem; }
  .mode-card {
    color: var(--text);
    min-height: 170px;
    padding: 2rem;
    text-align: left;
    display: flex;
    justify-content: center;
    flex-direction: column;
    gap: 0.7rem;
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 19%, var(--surface)), var(--surface));
    font-size: 1rem;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }
  .mode-card strong { font-size: 1.15rem; }
  .mode-card:hover, .mode-card:focus-visible { border-color: var(--accent-strong); box-shadow: 0 10px 24px color-mix(in srgb, var(--accent) 23%, transparent); transform: translateY(-3px); outline: none; }
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
