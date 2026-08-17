<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { ClassroomQuizAttemptDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let quizId: string;
  let attempt: ClassroomQuizAttemptDTO | null = null;
  let selections: Record<string, string[]> = {};
  let typedAnswers: Record<string, string> = {};
  let index = 0;
  let started = false;
  let loading = true;
  let submitting = false;
  let error = "";
  let remainingSeconds: number | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  $: question = attempt?.questions[index] ?? null;
  $: total = attempt?.questions.reduce((sum, item) => sum + item.points, 0) ?? 0;
  $: questionAnswered = question?.kind === "fill"
    ? !!typedAnswers[question.id]?.trim()
    : !!(question && selections[question.id]?.length);
  $: minutesLabel = remainingSeconds === null
    ? ""
    : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  function clearTimer() {
    if (timer) clearInterval(timer);
    timer = undefined;
    remainingSeconds = null;
  }

  function startTimer() {
    clearTimer();
    if (!attempt?.quiz.timerMinutes || attempt.quiz.timerMinutes < 1) return;
    const deadline = Date.now() + attempt.quiz.timerMinutes * 60_000;
    const updateRemaining = () => {
      remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remainingSeconds === 0) void submit();
    };
    updateRemaining();
    timer = setInterval(updateRemaining, 250);
  }

  async function load() {
    loading = true;
    error = "";
    try {
      attempt = await api.getClassroomQuiz(quizId);
      started = !attempt.quiz.showPreview;
      if (started) startTimer();
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't load this quiz.";
    } finally {
      loading = false;
    }
  }

  function begin() {
    started = true;
    startTimer();
  }

  async function submit() {
    if (!attempt || submitting || attempt.submission) return;
    submitting = true;
    error = "";
    clearTimer();
    try {
      const answers = attempt.questions.map((item) => ({
        questionId: item.id,
        selected: item.kind === "mcq" ? selections[item.id] ?? null : null,
        typedAnswer: item.kind === "fill" ? typedAnswers[item.id] ?? null : null,
      }));
      const { submission } = await api.submitClassroomQuiz(quizId, answers);
      attempt = { ...attempt, submission };
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't submit your quiz.";
    } finally {
      submitting = false;
    }
  }

  function setTypedAnswer(questionId: string, value: string) {
    typedAnswers = { ...typedAnswers, [questionId]: value };
  }

  function toggleOption(questionId: string, option: string) {
    const current = selections[questionId] ?? [];
    const next = current.includes(option)
      ? current.filter((value) => value !== option)
      : [...current, option];
    selections = { ...selections, [questionId]: next };
  }

  onMount(load);
  onDestroy(clearTimer);
</script>

<button class="back" on:click={() => navigate("/classwork")}>← Back to classwork</button>
{#if loading}
  <p class="muted">Loading…</p>
{:else if error && !attempt}
  <p class="error">{error}</p>
{:else if attempt}
  {#if attempt.submission}
    <div class="card-surface done"><h1>{attempt.quiz.title}</h1><p class="muted">{attempt.quiz.classroomName}</p><p class="score">Your score: {Number(attempt.submission.score.toFixed(2))} / {attempt.submission.totalPoints}</p><p class="muted">Submitted {new Date(attempt.submission.submittedAt).toLocaleString()}</p><button class="btn btn-primary" on:click={() => navigate("/classwork")}>Back to classwork</button></div>
  {:else if !started}
    <div class="card-surface preview"><h1>{attempt.quiz.title}</h1><p class="muted">{attempt.quiz.classroomName} · {attempt.questions.length} questions</p><p>Review the question formats below. Your answers will be marked after you submit the complete quiz.</p><ol>{#each attempt.questions as item}<li><span class="muted small">{item.kind === "mcq" ? "Multiple choice" : "Fill in the blank"} · {item.points} point{item.points === 1 ? "" : "s"}{item.kind === "mcq" && item.multiSelect ? " · Select all that apply" : ""}</span><div><Katex text={item.prompt} /></div>{#if item.kind === "mcq"}<div class="preview-options">{#each item.options as option}<span><Katex text={option} /></span>{/each}</div>{/if}</li>{/each}</ol><button class="btn btn-primary" on:click={begin}>Start quiz</button></div>
  {:else if question}
    <div class="question-status"><p class="muted">Question {index + 1} of {attempt.questions.length} · {question.kind === "mcq" ? "Multiple choice" : "Fill in the blank"} · {question.points} point{question.points === 1 ? "" : "s"}</p>{#if remainingSeconds !== null}<strong class="timer">{minutesLabel}</strong>{/if}</div>
    <div class="card-surface question">
      <h1>{attempt.quiz.title}</h1>
      <div class="prompt"><Katex text={question.prompt} /></div>
      {#if question.kind === "mcq"}
        {#if question.multiSelect}<p class="muted small">Select all that apply.</p>{/if}
        <div class="options">{#each question.options as option}<button class="option" class:selected={selections[question.id]?.includes(option)} aria-pressed={selections[question.id]?.includes(option)} on:click={() => toggleOption(question!.id, option)}><Katex text={option} /></button>{/each}</div>
      {:else}
        <label for="fill-answer" class="muted small">Your answer</label>
        <textarea id="fill-answer" rows="5" value={typedAnswers[question.id] ?? ""} on:input={(event) => setTypedAnswer(question!.id, (event.currentTarget as HTMLTextAreaElement).value)} placeholder="Type your answer…"></textarea>
      {/if}
      <div class="actions"><button class="btn" disabled={index === 0} on:click={() => index -= 1}>Previous</button>{#if index + 1 < attempt.questions.length}<button class="btn btn-primary" disabled={!questionAnswered} on:click={() => index += 1}>Next</button>{:else}<button class="btn btn-primary" disabled={submitting || !questionAnswered} on:click={submit}>{submitting ? "Submitting…" : `Submit quiz (${total} points)`}</button>{/if}</div>
      {#if error}<p class="error">{error}</p>{/if}
    </div>
  {/if}
{/if}

<style>
  .back{background:none;border:none;color:var(--text-dim);padding:0;margin-bottom:1rem}.question{padding:1.5rem;max-width:720px}.question h1{font-size:1.2rem;margin:0 0 1.25rem}.prompt{font-size:1.1rem;font-weight:600;margin-bottom:1rem}.options{display:grid;gap:.6rem}.option{text-align:left;padding:.75rem .9rem;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text)}.option.selected{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--surface-2))}.actions{display:flex;justify-content:space-between;gap:.6rem;margin-top:1.25rem}.question-status{display:flex;justify-content:space-between;align-items:center;max-width:720px}.question-status p{margin:.25rem 0 .75rem}.timer{color:var(--accent)}.done,.preview{max-width:720px;padding:2rem}.done{text-align:center}.done h1,.preview h1{margin-top:0}.score{color:var(--good);font-size:1.35rem;font-weight:700;margin:1.5rem 0}.preview ol{display:grid;gap:.8rem;padding-left:1.25rem}.preview li{padding:.7rem;border:1px solid var(--border);border-radius:8px}.preview li>div{margin-top:.35rem}.preview-options{display:flex;flex-wrap:wrap;gap:.35rem}.preview-options span{padding:.25rem .45rem;border-radius:5px;background:var(--surface-2);font-size:.9rem}.error{color:var(--bad)}
</style>
