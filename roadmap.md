# Flashcards roadmap

> Updated 24 August 2026. This roadmap describes the path from the current feature-complete prototype to a dependable student and teacher pilot. It is a prioritised plan, not a promise of delivery dates.

## Product outcomes

The project should make it easy for students to:

- turn lecture material into trustworthy, concise flashcards;
- practise with spaced repetition and active recall every day;
- understand which cards need more attention; and
- keep ownership of their material through reliable export and data controls.

Teachers should be able to create useful classroom quizzes, share them with a class, and understand participation and performance without adding unnecessary administration.

## Current baseline

The following capabilities are implemented:

- Imperial-domain email/password accounts, signed sessions, admin approval, and role-based admin views;
- deck and card management, manual entry, pasted-text import, PDF import, public URL import, tags, difficulty, search, and filters;
- asynchronous AI generation with Gemini/Claude fallback, retries, quotas, and an explicit draft review step;
- AI review of existing cards, typed-answer self-check, multiple-choice/fill/mixed quizzes, and KaTeX rendering;
- study history, overdue-first scheduling, configurable intervals, retired cards, lapse counts, and “Needs Attention” indicators;
- native Anki `.apkg` generation;
- teacher classrooms, reusable quiz decks, configurable quizzes, multiple correct answers, timers, weighted points, previews, and score breakdowns.

The detailed implementation inventory is in [README.md](./README.md). Historical product findings are retained in [IMPROVEMENT_IDEAS.md](./IMPROVEMENT_IDEAS.md), and current validation gaps are listed in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

## Roadmap at a glance

| Phase | Priority | Focus | Exit condition |
|---|---:|---|---|
| 0 | P0 | Release validation and trust | The core student and teacher journeys are reproducibly verified end to end. |
| 1 | P0 | Pilot operations and safety | The service can be deployed, monitored, backed up, restored, and operated responsibly. |
| 2 | P1 | High-value study experience | Students can efficiently find, repeat, and track the learning that matters most. |
| 3 | P1 | Teacher workflow maturity | Teachers can run classroom work with less manual follow-up and better feedback. |
| 4 | P2 | Quality, scale, and integrations | AI quality and platform capacity are measured, and the most valuable integrations are supported. |

## Phase 0 — Release validation and trust

### 0.1 Automate the critical journeys

- [ ] Add browser-level smoke coverage for registration/approval, login, deck creation, manual cards, study, quiz, self-check, and export.
- [ ] Add a credentialed AI smoke path covering PDF or pasted-text import, worker progress, draft review, acceptance, and grading.
- [ ] Exercise teacher flows: classroom creation, student join, quiz delivery, submission, score view, and answer breakdown.
- [ ] Add regression tests for authorisation boundaries, quotas, worker retries, upload limits, and failed provider requests.
- [ ] Run the existing unit tests and production build in a clean environment on every change.

### 0.2 Close known validation gaps

- [ ] Import a generated `.apkg` into the pilot’s target Anki Desktop release and verify cards, fields, media, tags, and mathematical notation.
- [ ] Test the application on representative phone and tablet sizes, including long card content, quizzes, dialogs, and navigation.
- [ ] Check keyboard navigation, visible focus, labels, colour contrast, and screen-reader names on the main study and quiz flows.
- [ ] Replace the native `window.confirm()` deck-delete prompt with the application’s accessible modal pattern.

### 0.3 Establish AI trust controls

- [ ] Record the source, provider/model, prompt version, and generation timestamp for each AI draft and grading result.
- [ ] Make source context and AI edits easy to inspect before a draft becomes a real card.
- [ ] Define a small, versioned evaluation set of lecture excerpts and expected card qualities: factuality, concision, course terminology, and mathematical formatting.
- [ ] Document how users should report incorrect cards and how an administrator can remove problematic generated content.

**Phase 0 is complete when:** a clean staging deployment passes the student and teacher smoke journeys, the Anki package has been opened in Anki Desktop, and no unresolved P0 correctness, security, or data-loss issue remains.

## Phase 1 — Pilot operations and safety

### 1.1 Repeatable deployment

- [ ] Add CI for type-check/build/test, Prisma migration validation, and container builds.
- [ ] Create a staging environment that uses separate credentials, databases, Redis data, and uploaded files from production.
- [ ] Add a reviewed release process with migration sequencing, rollback guidance, and a short post-deploy checklist.
- [ ] Keep the deployment and local-development instructions aligned with the actual Compose configuration.

### 1.2 Backups and observability

- [ ] Schedule encrypted off-box PostgreSQL backups and document retention.
- [ ] Perform and record a restore drill, including uploaded-source recovery or an explicit source-retention decision.
- [ ] Add health checks for the API, database, Redis, and generation worker; distinguish “API healthy, worker unavailable” from full service health.
- [ ] Add structured logs and basic operational signals for request failures, queue age, failed jobs, provider errors, quota rejection, and database capacity.
- [ ] Define alerts and an incident runbook for failed deployments, stuck generation jobs, expired certificates, and database recovery.

### 1.3 Privacy and security review

- [ ] Confirm the departmental policy for retaining uploaded PDFs and public-page extracts, including deletion and access rules.
- [ ] Document what content is sent to external AI providers and the approved data classification for pilot material.
- [ ] Review session, cookie, CORS, URL-fetch, file-upload, rate-limit, and role-authorisation behaviour before wider access.
- [ ] Add account deletion or an administrator-assisted deletion process with clear handling of decks, sources, reviews, and classroom submissions.

**Phase 1 is complete when:** a new operator can deploy from documented instructions, restore the service from backup, identify a failed worker, and explain how pilot data is protected and deleted.

## Phase 2 — High-value study experience

These items respond directly to the student feedback and the site review. They should be implemented after the core flows are stable so that new study modes do not complicate release validation.

### 2.1 Make review targeting useful

- [ ] Add a cross-deck “Study everything due” queue with deck attribution and fair ordering.
- [ ] Make “Needs Attention” actionable: open a focused session containing frequently forgotten or repeatedly failed cards.
- [ ] Allow a student to retry a self-check card immediately after receiving AI feedback, then continue to the next card.
- [ ] Preserve clear progress, empty, loading, and error states when cards are requeued or a session spans multiple decks.

### 2.2 Show progress without distracting from study

- [ ] Add a lightweight progress view: cards reviewed, accuracy, lapses, due cards, and recent study activity.
- [ ] Add an optional streak or return-visit signal, with an inclusive treatment of missed days.
- [ ] Surface which decks are overdue and provide a direct route into the relevant session.
- [ ] Evaluate per-deck study intervals alongside the current global settings; introduce them only if pilot behaviour shows a real need.

### 2.3 Improve everyday usability

- [ ] Complete responsive design fixes across deck editing, AI review, quizzes, classroom pages, tables, and dialogs.
- [ ] Add bulk card operations such as tag, difficulty, quiz eligibility, archive, and delete where they reduce repetitive work.
- [ ] Improve draft and import error recovery so users can retry a failed job without losing their source or prior edits.

**Phase 2 is complete when:** a student with several decks can start one due-card session, target weak cards, retry feedback immediately, and see enough progress information to decide what to study next.

## Phase 3 — Teacher workflow maturity

- [ ] Add quiz lifecycle controls such as scheduled availability, due dates, closing, retakes, and clear late-submission rules.
- [ ] Provide a teacher gradebook view with filtering, completion status, averages, question-level difficulty, and exportable results.
- [ ] Give students useful, policy-controlled feedback after submission while preserving teacher settings for answer breakdown visibility.
- [ ] Add classroom announcements or a clear “new work” indicator so students do not need to revisit every classroom manually.
- [ ] Improve quiz-deck maintenance with duplicate, bulk edit, archive, and reusable question-set workflows.
- [ ] Validate classroom permissions and privacy with realistic multi-teacher and multi-student test data.

**Phase 3 is complete when:** a teacher can publish, monitor, close, review, and reuse classroom work from one workflow, and a student can reliably tell what work is outstanding and what feedback is available.

## Phase 4 — Quality, scale, and integrations

### AI quality and cost

- [ ] Use the evaluation set from Phase 0 to compare provider/model changes before deployment.
- [ ] Add prompt/model versioning and an admin view of generation quality, latency, failure rate, and cost proxies.
- [ ] Support source-grounded suggestions for missing cards while keeping the existing accept/edit/discard guardrail.
- [ ] Tune quotas and model selection using measured pilot usage rather than assumptions.

### Data portability and access

- [ ] Consider Anki import and richer export formats after the existing Anki export is proven in practice.
- [ ] Improve multi-device experience, installability, and offline tolerance if pilot usage shows demand.
- [ ] Evaluate Imperial SSO/Entra integration only if account administration becomes a material barrier.

### Scale and maintainability

- [ ] Load-test study, quiz, export, and generation endpoints with realistic classroom and queue sizes.
- [ ] Add queue idempotency and safe recovery for worker restarts and duplicate delivery.
- [ ] Define retention/archival policies for old sources, drafts, reviews, and classroom submissions.
- [ ] Split large route and UI modules where it improves testability without introducing unnecessary abstraction.

## Prioritisation rules

1. Protect learning correctness, user data, and AI transparency before adding more generation features.
2. Prefer work that removes a repeated student or teacher action across many sessions.
3. Validate externally dependent behaviour in staging before calling it production-ready.
4. Keep optional integrations and native-app ambitions behind evidence from the pilot.

## Release gates

Every pilot release should satisfy:

- `npm test` passes and `npm run build` succeeds from a clean checkout;
- database migrations apply successfully to a staging copy and a rollback/recovery path is documented;
- the critical student and teacher smoke journeys pass;
- AI-dependent paths have a clear degraded/error state when credentials or the worker are unavailable;
- export has been tested with the target Anki release;
- backup freshness and restore readiness are known;
- no unresolved P0 security, privacy, correctness, or data-loss issue is accepted.

