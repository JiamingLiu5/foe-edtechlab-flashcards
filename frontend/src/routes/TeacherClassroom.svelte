<script lang="ts">
  import { onMount } from "svelte";
  import type {
    CardDifficulty,
    ClassroomMemberDTO,
    ClassroomQuizDTO,
    ClassroomSummaryDTO,
    DeckSummaryDTO,
    QuizConfiguration,
    QuizQuestionKind,
    QuizSubmissionDTO,
  } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let classroomId: string;

  type TeacherQuestion = {
    kind: QuizQuestionKind;
    cardId?: string;
    front: string;
    back: string;
    options: string[];
    answer: string;
    difficulty: CardDifficulty;
    points: number;
  };
  type QuizStage = "setup" | "preview";
  type QuestionSource = "deck" | "manual";
  type ManualQuestion = { id: string; prompt: string; answer: string };

  let classroom: ClassroomSummaryDTO | null = null;
  let members: ClassroomMemberDTO[] = [];
  let quizzes: ClassroomQuizDTO[] = [];
  let decks: DeckSummaryDTO[] = [];
  let loading = true;
  let error = "";
  let deckId = "";
  let title = "";
  let mode: "mcq" | "fill" | "mix" = "mcq";
  let questionSource: QuestionSource = "deck";
  let manualQuestions: ManualQuestion[] = [{ id: "manual-1", prompt: "", answer: "" }];
  let requestedQuestionCount = 5;
  let difficultyFilter: "all" | CardDifficulty = "all";
  let requestedHardQuestionCount = 0;
  let timerMinutes = 0;
  let showPreview = true;
  let stage: QuizStage = "setup";
  let configuredQuestions: TeacherQuestion[] = [];
  let preparing = false;
  let sending = false;
  let selectedQuiz: ClassroomQuizDTO | null = null;
  let scores: QuizSubmissionDTO[] = [];
  let scoresLoading = false;

  $: totalPoints = configuredQuestions.reduce((total, question) => total + Number(question.points || 0), 0);

  function changeMode(nextMode: "mcq" | "fill" | "mix") {
    mode = nextMode;
    if (nextMode !== "mcq") questionSource = "deck";
  }

  function addManualQuestion() {
    manualQuestions = [...manualQuestions, { id: `manual-${manualQuestions.length + 1}-${Date.now()}`, prompt: "", answer: "" }];
  }

  function updateManualQuestion(id: string, field: "prompt" | "answer", value: string) {
    manualQuestions = manualQuestions.map((question) => question.id === id ? { ...question, [field]: value } : question);
  }

  function removeManualQuestion(id: string) {
    if (manualQuestions.length === 1) return;
    manualQuestions = manualQuestions.filter((question) => question.id !== id);
  }

  function shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function chooseQuestions(pool: TeacherQuestion[]): TeacherQuestion[] {
    const count = Math.max(1, Math.floor(Number(requestedQuestionCount) || 0));
    const hardCount = Math.max(0, Math.floor(Number(requestedHardQuestionCount) || 0));
    if (hardCount > count) throw new Error("The number of hard questions cannot exceed the total number of questions.");

    const hard = shuffle(pool.filter((question) => question.difficulty === "hard")).slice(0, hardCount);
    if (hard.length < hardCount) {
      throw new Error(`Only ${hard.length} hard quiz-eligible card${hard.length === 1 ? " is" : "s are"} available.`);
    }
    const hardIds = new Set(hard.map((question) => question.cardId));
    const remainingPool = pool.filter((question) => !hardIds.has(question.cardId));
    const matching = difficultyFilter === "all"
      ? remainingPool
      : remainingPool.filter((question) => question.difficulty === difficultyFilter);
    const selected = [...hard, ...shuffle(matching).slice(0, count - hard.length)];
    if (selected.length < count) {
      throw new Error(`Only ${selected.length} quiz-eligible card${selected.length === 1 ? " is" : "s are"} match this setup.`);
    }
    return shuffle(selected).map((question) => ({ ...question, points: 1 }));
  }

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

  async function prepareQuiz() {
    if (!deckId || preparing || sending) return;
    preparing = true;
    error = "";
    try {
      if (mode === "mcq" && questionSource === "manual") {
        if (manualQuestions.some((question) => !question.prompt.trim() || !question.answer.trim())) {
          throw new Error("Add a question and correct answer for every MCQ before generating options.");
        }
        const generated = await api.generateClassroomMcqOptions(classroomId, manualQuestions);
        configuredQuestions = generated.questions.map((question) => ({
          kind: "mcq",
          front: question.prompt,
          back: question.answer,
          answer: question.answer,
          options: question.options,
          difficulty: "medium",
          points: 1,
        }));
        if (showPreview) {
          stage = "preview";
        } else {
          await sendPreparedQuiz();
        }
        return;
      }

      const [mcq, fill] = await Promise.all([api.getQuiz(deckId), api.getFillQuiz(deckId)]);
      const mcqQuestions: TeacherQuestion[] = mcq.questions.map((question) => ({
        kind: "mcq", ...question, back: question.answer, answer: question.answer, points: 1,
      }));
      const fillQuestions: TeacherQuestion[] = fill.questions.map((question) => ({
        kind: "fill", ...question, options: [], answer: question.back, points: 1,
      }));
      const mcqByCardId = new Map(mcqQuestions.map((question) => [question.cardId, question]));
      const mixedQuestions: TeacherQuestion[] = fillQuestions.map((question) => {
        const multipleChoice = mcqByCardId.get(question.cardId);
        return multipleChoice && Math.random() < 0.5 ? multipleChoice : question;
      });
      const pool = mode === "mcq" ? mcqQuestions : mode === "fill" ? fillQuestions : mixedQuestions;
      configuredQuestions = chooseQuestions(pool);
      if (showPreview) {
        stage = "preview";
      } else {
        await sendPreparedQuiz();
      }
    } catch (e) {
      error = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Couldn't prepare this quiz.";
    } finally {
      preparing = false;
    }
  }

  function configuration(): QuizConfiguration {
    const manual = mode === "mcq" && questionSource === "manual";
    return {
      mode,
      questionCount: configuredQuestions.length,
      difficultyFilter: manual ? "all" : difficultyFilter,
      hardQuestionCount: manual ? 0 : Math.max(0, Math.floor(Number(requestedHardQuestionCount) || 0)),
      timerMinutes: Math.max(0, Math.floor(Number(timerMinutes) || 0)),
      showPreview,
    };
  }

  async function sendPreparedQuiz() {
    if (!deckId || sending || configuredQuestions.length === 0) return;
    sending = true;
    error = "";
    try {
      const { quiz } = await api.createClassroomQuiz(
        classroomId,
        deckId,
        title.trim(),
        configuration(),
        configuredQuestions.map((question) => ({
          cardId: question.cardId,
          kind: question.kind,
          points: Math.max(0, Number.isFinite(Number(question.points)) ? Number(question.points) : 1),
          options: question.options,
          prompt: question.cardId ? undefined : question.front,
          answer: question.cardId ? undefined : question.answer,
        })),
      );
      quizzes = [quiz, ...quizzes];
      title = "";
      configuredQuestions = [];
      stage = "setup";
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Couldn't send the quiz.";
    } finally {
      sending = false;
    }
  }

  function backToSetup() {
    configuredQuestions = [];
    stage = "setup";
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
      <p class="muted">Create a quiz deck before sending an assignment.</p>
      <button class="btn btn-primary" on:click={() => navigate("/decks")}>Create a quiz deck</button>
    {:else if stage === "setup"}
      <form on:submit|preventDefault={prepareQuiz}>
        <label>Deck<select bind:value={deckId}>{#each decks as deck}<option value={deck.id}>{deck.name} ({deck.cardCount} cards)</option>{/each}</select></label>
        <label>Quiz title <input bind:value={title} placeholder="Leave blank to use the deck name" /></label>
        <label>Format<select value={mode} on:change={(event) => changeMode((event.currentTarget as HTMLSelectElement).value as typeof mode)}><option value="mcq">Multiple choice</option><option value="fill">Fill in the blank</option><option value="mix">Mixed</option></select></label>
        {#if mode === "mcq"}
          <label>Question source<select bind:value={questionSource}><option value="deck">Deck cards with AI distractors</option><option value="manual">Write MCQs with AI options</option></select></label>
        {/if}
        {#if mode !== "mcq" || questionSource === "deck"}
          <label>Questions <input type="number" min="1" max="100" step="1" bind:value={requestedQuestionCount} /></label>
          <label>Difficulty<select bind:value={difficultyFilter}><option value="all">Any difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <label>Hard questions <input type="number" min="0" step="1" bind:value={requestedHardQuestionCount} /><small>Included in the total.</small></label>
        {/if}
        <label>Timer (minutes) <input type="number" min="0" step="1" bind:value={timerMinutes} /><small>Set to 0 for no timer.</small></label>
        <label class="check-row"><input type="checkbox" bind:checked={showPreview} /><span>Show question preview before students start</span></label>
        {#if mode === "mcq" && questionSource === "manual"}
          <div class="manual-editor">
            <div class="manual-heading"><div><h3>Write MCQs</h3><p class="muted small">Enter the question and correct answer. AI will create three wrong options.</p></div><button class="btn" type="button" on:click={addManualQuestion}>Add question</button></div>
            {#each manualQuestions as manualQuestion, questionIndex}
              <div class="manual-question">
                <strong>Question {questionIndex + 1}</strong>
                <label>Question <textarea rows="2" value={manualQuestion.prompt} on:input={(event) => updateManualQuestion(manualQuestion.id, "prompt", (event.currentTarget as HTMLTextAreaElement).value)} placeholder="e.g. What is the main function of...?"></textarea></label>
                <label>Correct answer <textarea rows="2" value={manualQuestion.answer} on:input={(event) => updateManualQuestion(manualQuestion.id, "answer", (event.currentTarget as HTMLTextAreaElement).value)} placeholder="Enter the reference answer"></textarea></label>
                {#if manualQuestions.length > 1}<button class="remove-question" type="button" on:click={() => removeManualQuestion(manualQuestion.id)}>Remove</button>{/if}
              </div>
            {/each}
          </div>
        {/if}
        <button class="btn btn-primary" type="submit" disabled={preparing}>{preparing ? mode === "mcq" && questionSource === "manual" ? "Generating options…" : "Preparing…" : mode === "mcq" && questionSource === "manual" ? "Generate answer options" : showPreview ? "Preview quiz" : "Send to classroom"}</button>
      </form>
    {:else}
      <div class="preview-heading">
        <div><h3>Quiz preview</h3><p class="muted">Review the questions and set their points before sending.</p></div>
        <span class="total-points">{totalPoints} total point{totalPoints === 1 ? "" : "s"}</span>
      </div>
      <ol class="preview-list">
        {#each configuredQuestions as question, questionIndex}
          <li class="preview-question">
            <div class="preview-content">
              <p class="muted small">{question.kind === "mcq" ? "Multiple choice" : "Fill in the blank"} · {question.difficulty}</p>
              <div class="front"><Katex text={question.front} /></div>
              {#if question.kind === "mcq"}<div class="preview-options">{#each question.options as option}<div><Katex text={option} /></div>{/each}</div>{/if}
            </div>
            <label class="points-control" for={`teacher-points-${questionIndex}`}><span>Points</span><input id={`teacher-points-${questionIndex}`} type="number" min="0" step="0.5" bind:value={question.points} /></label>
          </li>
        {/each}
      </ol>
      <div class="preview-actions"><button class="btn" on:click={backToSetup}>Back to setup</button><button class="btn btn-primary" on:click={sendPreparedQuiz} disabled={sending}>{sending ? "Sending…" : "Send to classroom"}</button></div>
    {/if}
  </section>

  {#if error}<p class="error">{error}</p>{/if}
  <div class="columns">
    <section><h2>Sent quizzes</h2>
      {#if quizzes.length === 0}<p class="muted">No quizzes sent yet.</p>{:else}<div class="list">{#each quizzes as quiz}<div class="card-surface row"><div><strong>{quiz.title}</strong><span class="muted">{quiz.mode} · {quiz.questionCount} questions{quiz.timerMinutes ? ` · ${quiz.timerMinutes} min` : ""} · {new Date(quiz.createdAt).toLocaleDateString()}</span></div><button class="btn" on:click={() => viewScores(quiz)}>View scores</button></div>{/each}</div>{/if}
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
  .back { background:none; border:none; color:var(--text-dim); padding:0; margin-bottom:1rem; }
  .heading,.score-heading,.preview-heading { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:1rem; }
  .heading h1,.assignment h2,.columns h2,.scores h2,.preview-heading h3 { margin:0; }
  .heading p { margin:.4rem 0 0; }.code { color:var(--accent); letter-spacing:.08em; }
  .assignment { padding:1.25rem; margin-bottom:1.25rem; }.assignment form { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:.75rem; align-items:end; margin-top:1rem; }
  .assignment label { display:grid; gap:.35rem; font-size:.85rem; color:var(--text-dim); }.assignment label small { font-size:.75rem; }.assignment .check-row { display:flex; align-items:center; gap:.45rem; min-height:2.5rem; }.assignment .check-row input { width:auto; }
  .manual-editor { grid-column:1 / -1; display:grid; gap:.75rem; margin-top:.25rem; }.manual-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }.manual-heading h3 { margin:0; }.manual-heading p { margin:.25rem 0 0; }.manual-question { display:grid; grid-template-columns:8rem 1fr 1fr auto; gap:.65rem; align-items:start; padding:.8rem; border:1px solid var(--border); border-radius:9px; }.manual-question > strong { padding-top:.5rem; font-size:.85rem; }.manual-question label { min-width:0; }.remove-question { background:none; border:0; color:var(--text-dim); padding:.5rem 0; cursor:pointer; }.remove-question:hover { color:var(--bad); }
  .preview-heading p { margin:.35rem 0 0; }.total-points { color:var(--accent); font-weight:600; white-space:nowrap; }.preview-list { display:grid; gap:.7rem; padding:0; margin:1rem 0; list-style:none; }.preview-question { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; padding:.85rem 1rem; border:1px solid var(--border); border-radius:10px; }.preview-content { min-width:0; }.front { font-weight:600; margin-bottom:.35rem; }.preview-options { display:grid; gap:.2rem; color:var(--text-dim); font-size:.9rem; }.preview-options div { padding:.25rem .5rem; border-radius:5px; background:var(--surface-2); }.points-control { display:grid; gap:.3rem; min-width:5.5rem; color:var(--text-dim); font-size:.8rem; }.points-control input { width:5.5rem; }.preview-actions { display:flex; justify-content:flex-end; gap:.6rem; }
  .columns { display:grid; grid-template-columns:1.4fr 1fr; gap:1.5rem; }.list { display:grid; gap:.7rem; }.row { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.85rem 1rem; }.row span { display:block; font-size:.85rem; margin-top:.2rem; }.students { padding:0; margin:0; list-style:none; }.students li { padding:.65rem 0; border-bottom:1px solid var(--border); }.students span { display:block; color:var(--text-dim); font-size:.8rem; }.scores { padding:1.25rem; margin-top:1.5rem; }.scores table { width:100%; border-collapse:collapse; }.scores th,.scores td { padding:.65rem; text-align:left; border-bottom:1px solid var(--border); }.error { color:var(--bad); }
  @media(max-width:800px){.assignment form{grid-template-columns:repeat(2,minmax(0,1fr))}.manual-question{grid-template-columns:1fr 1fr}.manual-question > strong{grid-column:1 / -1}.columns{grid-template-columns:1fr}}
  @media(max-width:560px){.assignment form,.preview-question,.manual-question{grid-template-columns:1fr;display:grid}.heading,.preview-heading,.manual-heading{flex-direction:column}.manual-question > strong{grid-column:auto}.scores{overflow:auto}}
</style>
