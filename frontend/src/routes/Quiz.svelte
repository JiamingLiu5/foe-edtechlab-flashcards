<script lang="ts">
  import { onDestroy } from "svelte";
  import type { CardDifficulty, SelfCheckGradeDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { navigate } from "../lib/router";
  import Katex from "../lib/Math.svelte";

  export let deckId: string;
  export let mode: "mcq" | "fill" | "mix" | undefined = undefined;
  export let onTourStage: (stage: "format" | QuizStage) => void = () => {};

  type McqQuestion = { kind: "mcq"; cardId: string; front: string; back: string; options: string[]; answer: string; difficulty: CardDifficulty; points: number };
  type FillQuestion = { kind: "fill"; cardId: string; front: string; back: string; options: string[]; answer: string; difficulty: CardDifficulty; points: number };
  type QuizQuestion = McqQuestion | FillQuestion;
  type QuizAnswer = { selected?: string; typedAnswer?: string; fillResult?: SelfCheckGradeDTO };
  type QuizStage = "setup" | "preview" | "quiz" | "done";

  let stage: QuizStage = "setup";
  let configuredQuestions: QuizQuestion[] = [];
  let requestedQuestionCount = 10;
  let difficultyFilter: "all" | CardDifficulty = "all";
  let requestedHardQuestionCount = 0;
  let timerMinutes = 0;
  let showPreview = true;
  let preparing = false;
  let configError = "";

  let index = 0;
  let answers: QuizAnswer[] = [];
  let typedAnswer = "";
  let checking = false;
  let fillError = "";
  let remainingSeconds: number | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  $: questionCount = configuredQuestions.length;
  $: quizFinished = index >= questionCount;
  $: currentQuestion = configuredQuestions[index] ?? null;
  $: currentAnswer = answers[index] ?? {};
  $: totalPoints = configuredQuestions.reduce((total, question) => total + question.points, 0);
  $: pointsEarned = configuredQuestions.reduce((total, question, questionIndex) => {
    const answer = answers[questionIndex];
    if (question.kind === "mcq") return total + (answer?.selected === question.answer ? question.points : 0);
    return total + (answer?.fillResult ? question.points * (answer.fillResult.score / 100) : 0);
  }, 0);
  $: fillResults = answers.flatMap((answer) => answer.fillResult ? [answer.fillResult] : []);
  $: fillAnswered = fillResults.length;
  $: fillScore = fillResults.reduce((total, result) => total + result.score, 0);
  $: minutesLabel = remainingSeconds === null
    ? ""
    : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  $: onTourStage(mode ? stage : "format");

  function shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function clearTimer() {
    if (timer) clearInterval(timer);
    timer = undefined;
    remainingSeconds = null;
  }

  function startTimer() {
    clearTimer();
    if (!timerMinutes || timerMinutes < 1) return;

    const deadline = Date.now() + timerMinutes * 60_000;
    const updateRemaining = () => {
      remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remainingSeconds === 0) finishQuiz();
    };
    updateRemaining();
    timer = setInterval(updateRemaining, 250);
  }

  function finishQuiz() {
    clearTimer();
    index = questionCount;
    stage = "done";
  }

  function chooseQuestions(pool: QuizQuestion[]): QuizQuestion[] {
    const count = Math.max(1, Math.floor(Number(requestedQuestionCount) || 0));
    const hardCount = Math.max(0, Math.floor(Number(requestedHardQuestionCount) || 0));
    if (hardCount > count) throw new Error("The number of hard questions cannot exceed the total number of questions.");

    const hard = shuffle(pool.filter((question) => question.difficulty === "hard")).slice(0, hardCount);
    if (hard.length < hardCount) throw new Error(`Only ${hard.length} hard quiz-eligible card${hard.length === 1 ? " is" : "s are"} available.`);

    const remainingPool = pool.filter((question) => !hard.some((selectedQuestion) => selectedQuestion.cardId === question.cardId));
    const matching = difficultyFilter === "all"
      ? remainingPool
      : remainingPool.filter((question) => question.difficulty === difficultyFilter);
    const selectedQuestions = [...hard, ...shuffle(matching).slice(0, count - hard.length)];
    if (selectedQuestions.length < count) {
      throw new Error(`Only ${selectedQuestions.length} quiz-eligible card${selectedQuestions.length === 1 ? " is" : "s are"} match this setup.`);
    }
    return shuffle(selectedQuestions).map((question) => ({ ...question, points: 1 }));
  }

  async function prepareQuiz() {
    if (!mode || preparing) return;
    preparing = true;
    configError = "";
    try {
      const [mcq, fill] = await Promise.all([api.getQuiz(deckId), api.getFillQuiz(deckId)]);
      const mcqQuestions: McqQuestion[] = mcq.questions.map((question) => ({ kind: "mcq", ...question, back: question.answer, points: 1 }));
      const fillQuestions: FillQuestion[] = fill.questions.map((question) => ({ kind: "fill", ...question, options: [], answer: question.back, points: 1 }));
      const mcqByCardId = new Map(mcqQuestions.map((question) => [question.cardId, question]));
      const mixedQuestions: QuizQuestion[] = fillQuestions.map((question) => {
        const multipleChoice = mcqByCardId.get(question.cardId);
        return multipleChoice && Math.random() < 0.5 ? multipleChoice : question;
      });
      const pool = mode === "mcq" ? mcqQuestions : mode === "fill" ? fillQuestions : mixedQuestions;
      configuredQuestions = chooseQuestions(pool);
      if (showPreview) {
        stage = "preview";
      } else {
        startQuiz();
      }
    } catch (error) {
      configError = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Couldn't prepare this quiz.";
    } finally {
      preparing = false;
    }
  }

  function startQuiz() {
    configuredQuestions = configuredQuestions.map((question) => ({
      ...question,
      points: Math.max(0, Number.isFinite(question.points) ? question.points : 1),
    }));
    index = 0;
    answers = configuredQuestions.map(() => ({}));
    typedAnswer = "";
    checking = false;
    fillError = "";
    stage = "quiz";
    startTimer();
  }

  function saveAnswer(questionIndex: number, answer: QuizAnswer) {
    answers = answers.map((current, answerIndex) => answerIndex === questionIndex ? answer : current);
  }

  function choose(option: string) {
    saveAnswer(index, { selected: option });
  }

  function next() {
    moveToQuestion(index + 1);
    if (index >= questionCount) finishQuiz();
  }

  function previous() {
    if (index > 0) moveToQuestion(index - 1);
  }

  function moveToQuestion(nextIndex: number) {
    index = nextIndex;
    const nextQuestion = configuredQuestions[nextIndex];
    typedAnswer = nextQuestion?.kind === "fill" ? answers[nextIndex]?.typedAnswer ?? "" : "";
    fillError = "";
  }

  async function submitFillAnswer() {
    const question = currentQuestion;
    const questionIndex = index;
    const answer = typedAnswer.trim();
    if (!answer || !question || question.kind !== "fill" || checking) return;

    checking = true;
    fillError = "";
    try {
      // Grade each fill-in response as it is submitted, but defer all feedback
      // and correctness signals until the final results screen.
      const fillResult = await api.gradeSelfCheck(question.cardId, answer);
      saveAnswer(questionIndex, { typedAnswer: answer, fillResult });
      if (stage === "quiz" && index === questionIndex) next();
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

  function restartSetup() {
    clearTimer();
    configuredQuestions = [];
    answers = [];
    stage = "setup";
  }

  onDestroy(clearTimer);
</script>

<button class="back" on:click={() => navigate(`/decks/${deckId}`)}>&larr; Back to deck</button>

{#if !mode}
  <h1>Choose your quiz</h1>
  <p class="muted">Choose a format, then set up the questions before you begin.</p>
  <div class="mode-grid" data-tour-target="quiz-format">
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

  {#if stage === "setup"}
    <form class="card-surface setup" data-tour-target="quiz-setup" on:submit|preventDefault={prepareQuiz}>
      <h2>Quiz configuration</h2>
      <label>
        <span>Number of questions</span>
        <input type="number" min="1" step="1" bind:value={requestedQuestionCount} />
      </label>
      <label>
        <span>Difficulty level</span>
        <select bind:value={difficultyFilter}>
          <option value="all">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label>
        <span>Hard questions</span>
        <input type="number" min="0" step="1" bind:value={requestedHardQuestionCount} />
        <small>Reserved hard questions are included in the total above.</small>
      </label>
      <label>
        <span>Whole-quiz timer (minutes)</span>
        <input type="number" min="0" step="1" bind:value={timerMinutes} />
        <small>Set to 0 for no timer.</small>
      </label>
      <label class="check-row">
        <input type="checkbox" bind:checked={showPreview} />
        <span>Preview questions and set points before starting</span>
      </label>
      {#if configError}<p class="error">{configError}</p>{/if}
      <button class="btn btn-primary" type="submit" disabled={preparing}>{preparing ? "Preparing…" : showPreview ? "Preview quiz" : "Start quiz"}</button>
    </form>
  {:else if stage === "preview"}
    <div class="preview-heading">
      <div>
        <h2>Quiz preview</h2>
        <p class="muted">Edit the point value beside each question. Every question starts at one point.</p>
      </div>
      <span class="total-points">{totalPoints} total point{totalPoints === 1 ? "" : "s"}</span>
    </div>
    <ol class="preview-list">
      {#each configuredQuestions as question, questionIndex}
        <li class="card-surface preview-question">
          <div class="preview-content">
            <p class="muted small">{question.kind === "mcq" ? "Multiple choice" : "Fill in the blank"} · {question.difficulty}</p>
            <div class="front"><Katex text={question.front} /></div>
            {#if question.kind === "mcq"}
              <div class="preview-options">
                {#each question.options as option}<div><Katex text={option} /></div>{/each}
              </div>
            {/if}
          </div>
          <label class="points-control" for={`points-${questionIndex}`}>
            <span>Points</span>
            <input id={`points-${questionIndex}`} type="number" min="0" step="0.5" bind:value={question.points} />
          </label>
        </li>
      {/each}
    </ol>
    <div class="preview-actions">
      <button class="btn" on:click={restartSetup}>Back to setup</button>
      <button class="btn btn-primary" data-tour-target="quiz-preview-start" on:click={startQuiz}>Start quiz</button>
    </div>
  {:else if stage === "done" || quizFinished}
    <div class="card-surface done" data-tour-target="quiz-results">
      <p>Points: {Number(pointsEarned.toFixed(2))} / {totalPoints}</p>
      {#if fillAnswered}<p>Average AI score: {Math.round(fillScore / fillAnswered)}%</p>{/if}
      <h2>Results</h2>
      <ol class="results-list">
        {#each configuredQuestions as question, questionIndex}
          {@const answer = answers[questionIndex] ?? {}}
          <li class="result-item" class:correct-result={question.kind === "mcq" ? answer.selected === question.answer : (answer.fillResult?.score ?? 0) >= 70}>
            <div class="result-question"><Katex text={question.front} /></div>
            {#if question.kind === "mcq"}
              <p><strong>{answer.selected === question.answer ? "Correct" : "Incorrect"}</strong></p>
              <p>Your answer: {#if answer.selected}<Katex text={answer.selected} />{:else}Not answered{/if}</p>
              {#if answer.selected !== question.answer}<p>Correct answer: <Katex text={question.answer} /></p>{/if}
            {:else if answer.fillResult}
              <p><strong>{answer.fillResult.score >= 70 ? "Good answer" : "Needs improvement"} · {answer.fillResult.score}%</strong></p>
              <p>Your answer: {answer.typedAnswer}</p>
              <p>{answer.fillResult.feedback}</p>
              <p>Correct answer: <Katex text={question.back} /></p>
              {#if answer.fillResult.missing.length}<p class="missing"><strong>Still to include:</strong> {answer.fillResult.missing.join("; ")}</p>{/if}
            {:else}
              <p><strong>Not answered</strong></p>
              <p>Correct answer: <Katex text={question.back} /></p>
            {/if}
          </li>
        {/each}
      </ol>
      <button class="btn btn-primary" on:click={restartSetup}>Configure another quiz</button>
    </div>
  {:else if currentQuestion?.kind === "mcq"}
    {@const q = currentQuestion}
    <div class="question-status">
      <p class="muted small">Question {index + 1} of {questionCount} · {q.points} point{q.points === 1 ? "" : "s"}</p>
      {#if remainingSeconds !== null}<strong class="timer">{minutesLabel}</strong>{/if}
    </div>
    <div class="card-surface question" data-tour-target="quiz-question">
      <div class="front"><Katex text={q.front} /></div>
      <div class="options">
        {#each q.options as option}
          <button
            class="option"
            class:selected={currentAnswer.selected === option}
            on:click={() => choose(option)}
          >
            <Katex text={option} />
          </button>
        {/each}
      </div>
      <div class="question-actions">
        <button class="btn" on:click={previous} disabled={index === 0}>Previous question</button>
        {#if currentAnswer.selected}<button class="btn btn-primary" on:click={next}>{index + 1 === questionCount ? "Finish quiz" : "Next question"}</button>{/if}
      </div>
    </div>
  {:else if currentQuestion?.kind === "fill"}
    {@const q = currentQuestion}
    <div class="question-status">
      <p class="muted small">Question {index + 1} of {questionCount} · {q.points} point{q.points === 1 ? "" : "s"}</p>
      {#if remainingSeconds !== null}<strong class="timer">{minutesLabel}</strong>{/if}
    </div>
    <form class="card-surface question" data-tour-target="quiz-question" on:submit|preventDefault={submitFillAnswer}>
      <div class="front"><Katex text={q.front} /></div>
      <label for="fill-answer" class="muted small">Your answer</label>
      <textarea id="fill-answer" rows="4" bind:value={typedAnswer} disabled={checking} placeholder="Type your answer…"></textarea>
      {#if fillError}<p class="error">{fillError}</p>{/if}
      <div class="question-actions">
        <button class="btn" type="button" on:click={previous} disabled={index === 0 || checking}>Previous question</button>
        <button class="btn btn-primary" type="submit" disabled={!typedAnswer.trim() || checking}>{checking ? "Saving answer…" : index + 1 === questionCount ? "Submit quiz" : "Save & next"}</button>
      </div>
    </form>
  {/if}
{/if}

<style>
  .back { background: none; border: none; color: var(--text-dim); margin-bottom: 1rem; padding: 0; }
  .back:hover { color: var(--text); }
  .mode-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin-top: 1.5rem; }
  .mode-card { color: var(--text); min-height: 170px; padding: 2rem; text-align: left; display: flex; justify-content: center; flex-direction: column; gap: 0.7rem; border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 19%, var(--surface)), var(--surface)); font-size: 1rem; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
  .mode-card strong { font-size: 1.15rem; }
  .mode-card:hover, .mode-card:focus-visible { border-color: var(--accent-strong); box-shadow: 0 10px 24px color-mix(in srgb, var(--accent) 23%, transparent); transform: translateY(-3px); outline: none; }
  .quiz-heading, .preview-heading, .question-status { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
  .quiz-heading h1, .preview-heading h2 { margin: 0; }
  .small { font-size: 0.8rem; }
  .setup { max-width: 620px; padding: 1.25rem; display: grid; gap: 1rem; }
  .setup h2 { margin: 0; }
  .setup label { display: grid; gap: 0.35rem; font-weight: 600; }
  .setup input, .setup select { width: min(100%, 18rem); }
  .setup small { color: var(--text-dim); font-size: 0.8rem; font-weight: 400; }
  .setup .check-row { display: flex; align-items: center; gap: 0.55rem; font-weight: 400; }
  .setup .check-row input { width: auto; }
  .preview-heading p { margin: 0.35rem 0 0; }
  .total-points, .timer { color: var(--accent); font-weight: 700; white-space: nowrap; }
  .preview-list { list-style-position: inside; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
  .preview-question { padding: 1rem; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1rem; }
  .preview-question p { margin: 0 0 0.55rem; text-transform: capitalize; }
  .preview-options { display: grid; gap: 0.4rem; }
  .preview-options div { padding: 0.45rem 0.65rem; border-radius: 6px; background: var(--surface-2); }
  .points-control { display: grid; align-content: start; gap: 0.35rem; font-size: 0.8rem; color: var(--text-dim); }
  .points-control input { width: 5.5rem; }
  .preview-actions { display: flex; justify-content: flex-end; gap: 0.6rem; }
  .question { padding: 1.5rem; }
  .front { font-weight: 600; font-size: 1.1rem; margin-bottom: 1.1rem; }
  .options { display: flex; flex-direction: column; gap: 0.55rem; }
  .option { text-align: left; padding: 0.7rem 0.9rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); }
  .option.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface-2)); }
  .question-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1.25rem; }
  .done { padding: 2rem; text-align: center; }
  textarea { width: 100%; margin-top: 0.4rem; }
  .missing { color: var(--text-dim); }
  .error { color: var(--bad); margin: 0; }
  .done { text-align: left; }
  .done > :is(p, h2) { text-align: center; }
  .results-list { display: grid; gap: 0.8rem; margin: 1.25rem 0; padding-left: 1.4rem; }
  .result-item { padding: 0.9rem; border: 1px solid var(--bad); border-radius: 8px; background: rgba(248, 113, 113, 0.08); }
  .result-item.correct-result { border-color: var(--good); background: rgba(74, 222, 128, 0.08); }
  .result-item p { margin: 0.45rem 0 0; }
  .result-question { font-weight: 600; }
  @media (max-width: 600px) {
    .mode-grid { grid-template-columns: 1fr; }
    .quiz-heading, .preview-heading { align-items: flex-start; flex-direction: column; }
    .preview-question { grid-template-columns: 1fr; }
    .points-control { display: flex; align-items: center; }
  }
</style>
