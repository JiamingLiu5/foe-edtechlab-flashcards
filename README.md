# Flashcards

FoE EdTechLab's full-stack flashcard application for Imperial students and teachers. The current implementation is a Svelte/TypeScript frontend, a Fastify API, a background AI-generation worker, PostgreSQL, Redis, and Caddy.

For using the application, see the [student user guide](./USER_GUIDE.md) and [teacher user guide](./TEACHER_USER_GUIDE.md). For the system design, see [design.md](./design.md); for a Linux deployment, see [infra/README.md](./infra/README.md).

## Current implementation

The prototype now provides:

- Email/password accounts restricted to the configured Imperial domains (`@ic.ac.uk` and `@imperial.ac.uk` by default), signed HTTP-only sessions, and admin approval for new accounts.
- Student deck management with manual cards, pasted text, PDF import, public URL import, tags, difficulty labels, search, and tag/difficulty filtering.
- Asynchronous AI card drafting with Gemini OCR/generation support and optional Claude generation/grading, followed by an explicit review step. Drafts can be accepted individually, accepted in bulk, edited, or discarded.
- AI review of existing cards for possible factual or clarity issues without silently overwriting the deck.
- Study mode with persisted review history, overdue-first scheduling, Again/Hard/Good/Easy ratings, configurable study intervals, retired cards, lapse counts, and “Needs Attention” indicators.
- Multiple-choice, fill-in-the-blank, and mixed self-study quizzes, with KaTeX rendering for mathematical notation.
- Typed-answer Self-check with AI grading, feedback, missing points, and the reference answer.
- Native Anki `.apkg` export containing a SQLite collection and media manifest.
- Teacher classrooms with join codes, reusable quiz decks, deck-based or manually written questions, difficulty selection, hard-question quotas, timers, previews, weighted points, multiple correct answers, and submission scores.
- Admin views for approving/deactivating users, inspecting user decks, and managing per-user AI quotas.
- Redis-backed daily quotas for generation, grading, deck review, distractor generation, and generated-card limits.

AI imports are deliberately asynchronous. The normal flow is `queued → extracting → generating → ready`, followed by human review before cards enter a deck.

## Repository layout

```text
/frontend    — Svelte + Vite browser application
/backend     — Fastify API, Prisma data access, and generation worker
/shared      — TypeScript types shared by frontend and backend
/infra       — Docker Compose, Caddy, and deployment files
```

## Local development

Requirements: Node.js/npm, Docker, and Docker Compose.

```sh
npm install
cp backend/.env.example backend/.env
npm run dev:infra
npm run prisma:migrate

# In separate terminals:
npm run dev:backend
npm run dev:worker
npm run dev:frontend
```

The frontend runs at `http://localhost:5173`. Set `GEMINI_API_KEY` for PDF OCR and live AI generation. `ANTHROPIC_API_KEY` is optional; generation and grading fall back to Gemini when it is absent. Never commit a populated `.env` file.

Useful checks:

```sh
npm test
npm run build
```

`npm run dev:infra` starts only local PostgreSQL and Redis. Production-like deployment, including the frontend, backend, worker, and Caddy, is documented in [infra/README.md](./infra/README.md).

## Main user journeys

### Students

1. Register with an approved Imperial-domain email and wait for admin approval.
2. Create a deck and add cards manually or request AI drafts from text, a PDF, or a public URL.
3. Review AI drafts before accepting them into the deck.
4. Practise with Study, Quiz, or Self-check; export the finished deck to Anki when needed.
5. Join teacher classrooms from **Classwork** and complete assigned quizzes.

### Teachers

1. Register as a teacher and wait for admin approval.
2. Create quiz decks and mark eligible cards for quizzes.
3. Create a classroom, share its join code, configure a quiz, preview it, and send it.
4. Review student submissions and scores from the classroom page.

Detailed instructions are in [USER_GUIDE.md](./USER_GUIDE.md) and [TEACHER_USER_GUIDE.md](./TEACHER_USER_GUIDE.md).

## Product background and next steps

The original requirements came from the anonymised student survey in [Flashcard_Expectation_From_Students_Summary.md](./Flashcard_Expectation_From_Students_Summary.md). The implementation addresses its main requests: spaced repetition, typed-answer checking, bulk/AI import, visible AI edits, formula rendering, forgotten-card indicators, and Anki export.

The dated [3rd_week_plan.md](./3rd_week_plan.md), [bugs.md](./bugs.md), and [IMPROVEMENT_IDEAS.md](./IMPROVEMENT_IDEAS.md) files are retained as project history. Remaining validation and product ideas are recorded there and in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).
