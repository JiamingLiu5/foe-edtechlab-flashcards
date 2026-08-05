<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassroomQuizAttemptDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let quizId: string;
  let attempt: ClassroomQuizAttemptDTO | null = null;
  let selections: Record<string, string> = {};
  let index = 0;
  let loading = true;
  let submitting = false;
  let error = "";

  $: question = attempt?.questions[index] ?? null;
  $: total = attempt?.questions.reduce((sum, item) => sum + item.points, 0) ?? 0;

  async function load() {
    loading = true;
    try { attempt = await api.getClassroomQuiz(quizId); }
    catch (e) { error = e instanceof ApiError ? e.message : "Couldn't load this quiz."; }
    finally { loading = false; }
  }
  async function submit() {
    if (!attempt || submitting) return;
    submitting = true; error = "";
    try { const { submission } = await api.submitClassroomQuiz(quizId, attempt.questions.map((item) => ({ questionId: item.id, selected: selections[item.id] ?? null }))); attempt = { ...attempt, submission }; }
    catch (e) { error = e instanceof ApiError ? e.message : "Couldn't submit your quiz."; }
    finally { submitting = false; }
  }
  onMount(load);
</script>

<button class="back" on:click={() => navigate("/classwork")}>← Back to classwork</button>
{#if loading}<p class="muted">Loading…</p>{:else if error && !attempt}<p class="error">{error}</p>{:else if attempt}
  {#if attempt.submission}<div class="card-surface done"><h1>{attempt.quiz.title}</h1><p class="muted">{attempt.quiz.classroomName}</p><p class="score">Your score: {Number(attempt.submission.score.toFixed(2))} / {attempt.submission.totalPoints}</p><p class="muted">Submitted {new Date(attempt.submission.submittedAt).toLocaleString()}</p><button class="btn btn-primary" on:click={() => navigate("/classwork")}>Back to classwork</button></div>
  {:else if question}<p class="muted">Question {index + 1} of {attempt.questions.length} · {question.points} point{question.points === 1 ? "" : "s"}</p><div class="card-surface question"><h1>{attempt.quiz.title}</h1><div class="prompt"><Katex text={question.prompt} /></div><div class="options">{#each question.options as option}<button class="option" class:selected={selections[question.id] === option} on:click={() => selections = { ...selections, [question!.id]: option }}><Katex text={option} /></button>{/each}</div><div class="actions"><button class="btn" disabled={index === 0} on:click={() => index -= 1}>Previous</button>{#if index + 1 < attempt.questions.length}<button class="btn btn-primary" disabled={!selections[question.id]} on:click={() => index += 1}>Next</button>{:else}<button class="btn btn-primary" disabled={submitting} on:click={submit}>{submitting ? "Submitting…" : `Submit quiz (${total} points)`}</button>{/if}</div>{#if error}<p class="error">{error}</p>{/if}</div>
  {/if}
{/if}

<style>.back{background:none;border:none;color:var(--text-dim);padding:0;margin-bottom:1rem}.question{padding:1.5rem;max-width:720px}.question h1{font-size:1.2rem;margin:0 0 1.25rem}.prompt{font-size:1.1rem;font-weight:600;margin-bottom:1rem}.options{display:grid;gap:.6rem}.option{text-align:left;padding:.75rem .9rem;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text)}.option.selected{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--surface-2))}.actions{display:flex;justify-content:space-between;gap:.6rem;margin-top:1.25rem}.done{max-width:560px;text-align:center;padding:2rem}.done h1{margin:0}.score{color:var(--good);font-size:1.35rem;font-weight:700;margin:1.5rem 0}.error{color:var(--bad)}</style>
