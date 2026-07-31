<script lang="ts">
  import { navigate } from "../lib/router";
</script>

<div class="guide-heading">
  <div>
    <h1>Beginner guide</h1>
    <p class="muted">Follow this flow whenever you start a new topic.</p>
  </div>
  <button class="btn btn-primary" on:click={() => navigate("/decks")}>Go to my decks</button>
</div>

<div class="flow card-surface" aria-label="Getting started flow">
  <div class="flow-item"><span>1</span>Sign in</div>
  <div class="arrow" aria-hidden="true">→</div>
  <div class="flow-item"><span>2</span>Create deck</div>
  <div class="arrow" aria-hidden="true">→</div>
  <div class="flow-item"><span>3–5</span>Add, generate & review</div>
  <div class="arrow" aria-hidden="true">→</div>
  <div class="flow-item"><span>6</span>Choose a mode</div>
</div>

<ol class="steps">
  <li class="card-surface step">
    <span class="step-number">1</span>
    <div>
      <h2>Sign in</h2>
      <p>Sign in with your university account. You will arrive at <strong>Your decks</strong>.</p>
    </div>
  </li>
  <li class="card-surface step">
    <span class="step-number">2</span>
    <div>
      <h2>Create a deck</h2>
      <p>Enter a descriptive name for your topic, such as “Week 3: Cell biology”, then choose <strong>Create deck</strong>.</p>
    </div>
  </li>
  <li class="card-surface step">
    <span class="step-number">3</span>
    <div>
      <h2>Choose a source</h2>
      <p>Select <strong>Add cards</strong> in the deck, then choose one route:</p>
      <ul>
        <li><strong>Create a card</strong> to write a question and answer yourself.</li>
        <li><strong>Paste cards</strong> to paste a bulk block of study text; no tabs or special formatting are needed.</li>
        <li><strong>From PDF</strong> or <strong>From link</strong> to use lecture slides or a public webpage.</li>
      </ul>
    </div>
  </li>
  <li class="card-surface step">
    <span class="step-number">4</span>
    <div>
      <h2>Generate cards</h2>
      <p>For pasted text, PDFs, and links, set the maximum number of cards and choose <strong>Draft cards with AI</strong>. Manual cards are created directly.</p>
    </div>
  </li>
  <li class="card-surface step">
    <span class="step-number">5</span>
    <div>
      <h2>Review your cards</h2>
      <p>Check every AI draft. You can <strong>Edit</strong>, <strong>Accept</strong>, or <strong>Discard</strong> it. When accepting a card, choose whether to include it in quizzes.</p>
      <p class="muted small">You can also use <strong>AI review</strong> later to check an existing deck for possible factual or clarity issues.</p>
    </div>
  </li>
  <li class="card-surface step">
    <span class="step-number">6</span>
    <div>
      <h2>Choose how to practise</h2>
      <div class="mode-grid">
        <div>
          <h3>Study</h3>
          <p>Flip cards, then record how well you remembered them. Cards return according to your Study settings.</p>
        </div>
        <div>
          <h3>Quiz</h3>
          <p>Choose multiple choice, fill-in-the-blank, or a mixed quiz. Results and feedback appear together after the quiz.</p>
        </div>
        <div>
          <h3>Self-check</h3>
          <p>Write an answer in your own words and receive AI feedback against the reference answer.</p>
        </div>
      </div>
    </div>
  </li>
</ol>

<section class="card-surface tip">
  <h2>Then repeat</h2>
  <p>Return to Study, Quiz, or Self-check whenever you revise. Add or edit cards as your understanding develops, and use tags and difficulty to keep the deck organised.</p>
</section>

<style>
  .guide-heading { display: flex; justify-content: space-between; align-items: start; gap: 1rem; margin-bottom: 1.25rem; }
  .guide-heading h1 { margin: 0; }
  .guide-heading p { margin: 0.4rem 0 0; }
  .flow { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 1rem; margin-bottom: 1.25rem; overflow-x: auto; }
  .flow-item { display: grid; gap: 0.3rem; min-width: 8.5rem; color: var(--text-dim); font-size: 0.82rem; font-weight: 600; text-align: center; }
  .flow-item span { color: var(--accent); font-size: 0.72rem; text-transform: uppercase; }
  .arrow { color: var(--accent); font-size: 1.25rem; }
  .steps { display: grid; gap: 0.8rem; margin: 0; padding: 0; list-style: none; }
  .step { display: grid; grid-template-columns: auto 1fr; gap: 1rem; padding: 1.15rem; }
  .step-number { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 999px; background: color-mix(in srgb, var(--accent) 18%, var(--surface-2)); color: var(--accent); font-weight: 700; }
  .step h2, .tip h2 { margin: 0; font-size: 1.05rem; }
  .step h3 { margin: 0; font-size: 0.95rem; }
  .step p { margin: 0.45rem 0 0; line-height: 1.5; }
  .step ul { margin: 0.55rem 0 0; padding-left: 1.2rem; }
  .step li { margin-top: 0.35rem; line-height: 1.45; }
  .mode-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; margin-top: 0.8rem; }
  .mode-grid > div { padding: 0.75rem; border-radius: 8px; background: var(--surface-2); }
  .mode-grid p { font-size: 0.88rem; }
  .small { font-size: 0.85rem; }
  .tip { margin-top: 1.25rem; padding: 1.15rem; border-left: 3px solid var(--accent); }
  .tip p { margin: 0.5rem 0 0; line-height: 1.5; }
  @media (max-width: 650px) {
    .guide-heading { align-items: stretch; flex-direction: column; }
    .guide-heading .btn { align-self: start; }
    .flow { justify-content: start; }
    .arrow { flex: 0 0 auto; }
    .mode-grid { grid-template-columns: 1fr; }
  }
</style>
