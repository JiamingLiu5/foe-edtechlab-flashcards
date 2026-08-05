<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassroomSummaryDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";

  let classrooms: ClassroomSummaryDTO[] = [];
  let name = "";
  let loading = true;
  let creating = false;
  let error = "";

  async function load() {
    loading = true;
    try {
      classrooms = (await api.listTeacherClassrooms()).classrooms;
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't load your classrooms.";
    } finally {
      loading = false;
    }
  }

  async function createClassroom() {
    const cleaned = name.trim();
    if (!cleaned || creating) return;
    creating = true;
    error = "";
    try {
      const { classroom } = await api.createClassroom(cleaned);
      name = "";
      navigate(`/classrooms/${classroom.id}`);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't create the classroom.";
    } finally {
      creating = false;
    }
  }

  onMount(load);
</script>

<div class="header">
  <div>
    <h1>Your classrooms</h1>
    <p class="muted">Create a classroom, share its join code with students, then send quizzes from your quiz decks.</p>
  </div>
  <button class="btn" on:click={() => navigate("/decks")}>Manage quiz decks</button>
</div>

<form class="card-surface create" on:submit|preventDefault={createClassroom}>
  <input bind:value={name} placeholder="e.g. Year 10 Biology" aria-label="Classroom name" />
  <button class="btn btn-primary" type="submit" disabled={creating}>{creating ? "Creating…" : "Create classroom"}</button>
</form>
{#if error}<p class="error">{error}</p>{/if}

{#if loading}
  <p class="muted">Loading…</p>
{:else if classrooms.length === 0}
  <p class="muted">No classrooms yet. Create one above to invite students.</p>
{:else}
  <div class="grid">
    {#each classrooms as classroom}
      <button class="card-surface classroom" on:click={() => navigate(`/classrooms/${classroom.id}`)}>
        <strong>{classroom.name}</strong>
        <span class="muted">{classroom.studentCount} student{classroom.studentCount === 1 ? "" : "s"} · {classroom.quizCount} quiz{classroom.quizCount === 1 ? "" : "zes"}</span>
        <span class="code">Join code: {classroom.joinCode}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; }
  h1 { margin: 0; }
  .header p { margin: 0.4rem 0 0; max-width: 42rem; }
  .create { display: flex; gap: 0.6rem; padding: 1rem; margin-bottom: 1rem; }
  .create input { flex: 1; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
  .classroom { color: var(--text); text-align: left; padding: 1.1rem; display: grid; gap: 0.55rem; }
  .classroom:hover { border-color: var(--accent); }
  .code { color: var(--accent); font-size: 0.85rem; font-weight: 600; }
  .error { color: var(--bad); }
  @media (max-width: 600px) { .header { flex-direction: column; } .create { flex-direction: column; } }
</style>
