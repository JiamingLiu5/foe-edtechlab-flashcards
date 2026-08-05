<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassroomQuizDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";

  let quizzes: ClassroomQuizDTO[] = [];
  let joinCode = "";
  let loading = true;
  let joining = false;
  let error = "";
  let info = "";

  async function load() {
    loading = true;
    try { quizzes = (await api.listClassroomAssignments()).quizzes; }
    catch (e) { error = e instanceof ApiError ? e.message : "Couldn't load your classwork."; }
    finally { loading = false; }
  }
  async function join() {
    if (!joinCode.trim() || joining) return;
    joining = true; error = ""; info = "";
    try { const { classroom } = await api.joinClassroom(joinCode); info = `Joined ${classroom.name}.`; joinCode = ""; await load(); }
    catch (e) { error = e instanceof ApiError ? e.message : "Couldn't join that classroom."; }
    finally { joining = false; }
  }
  onMount(load);
</script>

<div class="heading"><div><h1>Classwork</h1><p class="muted">Join a classroom with your teacher’s code and complete the quizzes they send.</p></div><button class="btn" on:click={() => navigate("/decks")}>Your decks</button></div>
<form class="card-surface join" on:submit|preventDefault={join}><input bind:value={joinCode} placeholder="Classroom join code" aria-label="Classroom join code" /><button class="btn btn-primary" disabled={joining}>{joining ? "Joining…" : "Join classroom"}</button></form>
{#if error}<p class="error">{error}</p>{/if}{#if info}<p class="info">{info}</p>{/if}
{#if loading}<p class="muted">Loading…</p>{:else if quizzes.length === 0}<p class="muted">No assigned quizzes yet.</p>{:else}<div class="list">{#each quizzes as quiz}<div class="card-surface quiz"><div><strong>{quiz.title}</strong><span class="muted">{quiz.classroomName} · {quiz.questionCount} questions</span>{#if quiz.submission}<span class="score">Score: {Number(quiz.submission.score.toFixed(2))} / {quiz.submission.totalPoints}</span>{/if}</div><button class="btn" class:btn-primary={!quiz.submission} on:click={() => navigate(`/assigned-quizzes/${quiz.id}`)}>{quiz.submission ? "View score" : "Take quiz"}</button></div>{/each}</div>{/if}

<style>.heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}.heading h1{margin:0}.heading p{margin:.4rem 0 0}.join{display:flex;gap:.6rem;padding:1rem;margin-bottom:1rem}.join input{flex:1}.list{display:grid;gap:.75rem}.quiz{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem}.quiz span{display:block;margin-top:.25rem;font-size:.85rem}.score{color:var(--good);font-weight:600}.error{color:var(--bad)}.info{color:var(--good)}@media(max-width:600px){.heading,.quiz,.join{flex-direction:column}}</style>
