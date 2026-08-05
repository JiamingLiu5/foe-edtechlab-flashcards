<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassroomMemberDTO, ClassroomQuizDTO, ClassroomSummaryDTO, DeckSummaryDTO, QuizSubmissionDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";

  export let classroomId: string;
  let classroom: ClassroomSummaryDTO | null = null;
  let members: ClassroomMemberDTO[] = [];
  let quizzes: ClassroomQuizDTO[] = [];
  let decks: DeckSummaryDTO[] = [];
  let loading = true;
  let error = "";
  let deckId = "";
  let title = "";
  let questionCount = 5;
  let sending = false;
  let selectedQuiz: ClassroomQuizDTO | null = null;
  let scores: QuizSubmissionDTO[] = [];
  let scoresLoading = false;

  async function load() {
    loading = true;
    error = "";
    try {
      const [classroomResult, deckResult] = await Promise.all([api.getTeacherClassroom(classroomId), api.listDecks()]);
      classroom = classroomResult.classroom;
      members = classroomResult.members;
      quizzes = classroomResult.quizzes;
      decks = deckResult.decks;
      if (!deckId && decks.length) deckId = decks[0].id;
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't load this classroom.";
    } finally {
      loading = false;
    }
  }

  async function sendQuiz() {
    if (!deckId || sending) return;
    sending = true;
    error = "";
    try {
      const { quiz } = await api.createClassroomQuiz(classroomId, deckId, title.trim(), Number(questionCount));
      quizzes = [quiz, ...quizzes];
      title = "";
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't send the quiz.";
    } finally {
      sending = false;
    }
  }

  async function viewScores(quiz: ClassroomQuizDTO) {
    selectedQuiz = quiz;
    scores = [];
    scoresLoading = true;
    try {
      scores = (await api.classroomQuizScores(classroomId, quiz.id)).scores;
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't load scores.";
    } finally {
      scoresLoading = false;
    }
  }

  onMount(load);
</script>

<button class="back" on:click={() => navigate("/teacher")}>← Back to classrooms</button>
{#if loading}
  <p class="muted">Loading…</p>
{:else if classroom}
  <div class="heading">
    <div><h1>{classroom.name}</h1><p class="muted">Students join with this code: <strong class="code">{classroom.joinCode}</strong></p></div>
    <span class="muted">{members.length} student{members.length === 1 ? "" : "s"}</span>
  </div>

  <section class="card-surface assignment">
    <h2>Send a quiz</h2>
    {#if decks.length === 0}
      <p class="muted">Create a quiz deck with at least four cards before sending an assignment.</p>
      <button class="btn btn-primary" on:click={() => navigate("/decks")}>Create a quiz deck</button>
    {:else}
      <form on:submit|preventDefault={sendQuiz}>
        <label>Deck<select bind:value={deckId}>{#each decks as deck}<option value={deck.id}>{deck.name} ({deck.cardCount} cards)</option>{/each}</select></label>
        <label>Quiz title <input bind:value={title} placeholder="Leave blank to use the deck name" /></label>
        <label>Questions <input type="number" min="1" max="100" step="1" bind:value={questionCount} /></label>
        <button class="btn btn-primary" type="submit" disabled={sending}>{sending ? "Sending…" : "Send to classroom"}</button>
      </form>
    {/if}
  </section>

  {#if error}<p class="error">{error}</p>{/if}
  <div class="columns">
    <section><h2>Sent quizzes</h2>
      {#if quizzes.length === 0}<p class="muted">No quizzes sent yet.</p>{:else}<div class="list">{#each quizzes as quiz}<div class="card-surface row"><div><strong>{quiz.title}</strong><span class="muted">{quiz.questionCount} questions · {new Date(quiz.createdAt).toLocaleDateString()}</span></div><button class="btn" on:click={() => viewScores(quiz)}>View scores</button></div>{/each}</div>{/if}
    </section>
    <section><h2>Students</h2>
      {#if members.length === 0}<p class="muted">Share the join code to add students.</p>{:else}<ul class="students">{#each members as student}<li>{student.displayName ?? student.email}<span>{student.displayName ? student.email : ""}</span></li>{/each}</ul>{/if}
    </section>
  </div>

  {#if selectedQuiz}
    <section class="card-surface scores"><div class="score-heading"><h2>{selectedQuiz.title} scores</h2><button class="btn" on:click={() => selectedQuiz = null}>Close</button></div>
      {#if scoresLoading}<p class="muted">Loading scores…</p>{:else if scores.length === 0}<p class="muted">No student has submitted this quiz yet.</p>{:else}<table><thead><tr><th>Student</th><th>Score</th><th>Submitted</th></tr></thead><tbody>{#each scores as score}<tr><td>{score.studentDisplayName ?? score.studentEmail}</td><td>{Number(score.score.toFixed(2))} / {score.totalPoints}</td><td>{new Date(score.submittedAt).toLocaleString()}</td></tr>{/each}</tbody></table>{/if}
    </section>
  {/if}
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); padding: 0; margin-bottom: 1rem; }.heading,.score-heading { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:1rem; }.heading h1,.assignment h2,.columns h2,.scores h2 { margin:0; }.heading p { margin: .4rem 0 0; }.code { color:var(--accent); letter-spacing:.08em; }.assignment { padding:1.25rem; margin-bottom:1.25rem; }.assignment form { display:grid; grid-template-columns: 1fr 1fr 8rem auto; gap:.75rem; align-items:end; margin-top:1rem; }.assignment label { display:grid; gap:.35rem; font-size:.85rem; color:var(--text-dim); }.columns { display:grid; grid-template-columns: 1.4fr 1fr; gap:1.5rem; }.list { display:grid; gap:.7rem; }.row { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.85rem 1rem; }.row span { display:block; font-size:.85rem; margin-top:.2rem; }.students { padding:0; margin:0; list-style:none; }.students li { padding:.65rem 0; border-bottom:1px solid var(--border); }.students span { display:block; color:var(--text-dim); font-size:.8rem; }.scores { padding:1.25rem; margin-top:1.5rem; }.scores table { width:100%; border-collapse:collapse; }.scores th,.scores td { padding:.65rem; text-align:left; border-bottom:1px solid var(--border); }.error { color:var(--bad); } @media(max-width:700px){.assignment form,.columns{grid-template-columns:1fr}.heading{flex-direction:column}.scores{overflow:auto}}
</style>
