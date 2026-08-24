# Flashcards evaluation plan

> Updated 24 August 2026. This plan is for evaluating the current prototype before and during a small student/teacher pilot. It should be revisited after the first pilot cycle.

## 1. Evaluation purpose

The evaluation should answer five questions:

1. **Does it work?** Can students and teachers complete the important journeys reliably?
2. **Is it usable?** Can people create, review, study, quiz, and teach without avoidable confusion?
3. **Are AI outputs trustworthy?** Are generated cards grounded, concise, useful, and clearly reviewable?
4. **Does it support learning?** Do students show evidence of improved recall or study consistency?
5. **Is it safe to pilot?** Are privacy, data retention, cost, and operational risks understood?

This is a product evaluation, not a claim that the application causes better grades. Learning-effect evidence should be described as exploratory unless the pilot includes a sufficiently controlled comparison.

Related documents: [roadmap.md](./roadmap.md), [KNOWN_ISSUES.md](./KNOWN_ISSUES.md), and [Flashcard_Expectation_From_Students_Summary.md](./Flashcard_Expectation_From_Students_Summary.md).

## 2. Evaluation stages

| Stage | Participants/environment | Purpose | Output |
|---|---|---|---|
| A. Technical preflight | Clean staging environment | Verify correctness, security, export, and operational readiness | Release checklist and defect log |
| B. Formative usability | 5–8 students and 2–3 teachers, recruited from the target community | Find friction and misunderstandings before wider access | Prioritised usability fixes |
| C. Pilot | A small consenting student group using real study material, plus participating teachers/classes where appropriate | Measure usage, trust, reliability, and early learning signals over multiple weeks | Pilot report with evidence and limitations |
| D. Review | Project team and relevant educational/departmental stakeholders | Decide whether to continue, change scope, or stop | Go / revise / stop decision |

Participant counts are starting targets, not statistical power claims. Increase the sample only when the team needs stronger evidence for a specific decision.

## 3. Stage A — technical preflight

Run this on the release candidate before inviting pilot users.

### Critical user journeys

- [ ] Register with an allowed and disallowed email domain; approve and deactivate an account.
- [ ] Log in, create a deck, add/edit/delete cards, search, filter, and export.
- [ ] Import pasted text, a PDF, and a public URL; observe `queued → extracting → generating → ready` and failure states.
- [ ] Review AI drafts individually and in bulk; edit, accept, and discard drafts.
- [ ] Study due cards, submit each review outcome, retire a card, and confirm the next due time.
- [ ] Complete multiple-choice, fill-in-the-blank, mixed, and typed-answer self-check flows.
- [ ] Create a classroom, join as a student, send a quiz, submit it, and inspect teacher/student results.

### Technical checks

- [ ] `npm test` passes after the existing shared-package export issue is resolved.
- [ ] `npm run build` succeeds from a clean checkout.
- [ ] Prisma migrations apply to an empty staging database and an existing database backup.
- [ ] Authorisation prevents cross-user deck/card access and non-admin access to admin routes.
- [ ] Upload limits, URL-fetch limits, quotas, retry/backoff, and provider failures produce safe, understandable responses.
- [ ] A generated `.apkg` imports successfully into the pilot’s target Anki Desktop release.
- [ ] API, database, Redis, worker, backup, restore, and certificate checks are documented and observable.
- [ ] Main flows are usable on representative phone and tablet sizes with keyboard navigation and visible focus.

Record each check as pass, fail, blocked, or not applicable. Every failure should include reproduction steps, severity, owner, and retest status.

## 4. Stage B — formative usability study

### Tasks for students

Ask participants to think aloud while they:

1. create a deck manually;
2. generate cards from a short piece of study text;
3. inspect and correct an AI draft;
4. study a small due queue and use each review rating;
5. complete a quiz and a typed-answer self-check;
6. find and practise a card they got wrong; and
7. export the deck to Anki or explain why they would not.

### Tasks for teachers

Ask participants to:

1. create a quiz deck;
2. create a classroom and share the join code;
3. configure and preview a quiz;
4. send it to students;
5. inspect scores and an answer breakdown; and
6. explain what they would do after seeing a difficult question or incomplete submission.

### Capture for each task

- completion: completed, completed with help, or failed;
- time to completion;
- wrong turns, hesitation, and support requests;
- observed confusion or trust concerns;
- participant confidence after the task, rated 1–5; and
- one short explanation of what should change.

Do not optimise for speed at the expense of learning or careful AI review. A slower but more accurate review step may be desirable.

### Formative success signals

Treat these as starting thresholds for discussion, not universal usability laws:

- at least 80% of participants complete each critical task without facilitator intervention;
- no unresolved task failure blocks account access, card review, study, quiz submission, or teacher score viewing;
- participants can explain that AI cards are drafts requiring review;
- participants can identify how to recover from a failed import or generation job; and
- the same high-severity confusion is not observed in more than one session without a planned fix.

## 5. Stage C — pilot evaluation

### 5.1 Baseline and follow-up

Before access, collect:

- current study-tool use and frequency;
- typical weekly study time and number of active decks;
- confidence in making flashcards and judging AI-generated answers;
- a short baseline recall assessment for the pilot topic, if an appropriate assessment exists; and
- the existing student feedback questions where comparison is useful.

At the end, repeat the relevant questions and assessment. Use the same wording and difficulty where possible. The prior survey found an average AI trust rating of 2.8/5 among nine usable responses; this is contextual background, not a directly comparable control result.

### 5.2 Product-health metrics

| Area | Measures | Interpretation |
|---|---|---|
| Activation | approved users, first deck, first card, first study session | Whether onboarding leads to real use |
| Study engagement | active study days, sessions, cards reviewed, due-card completion | Whether the tool supports a repeatable habit |
| Study quality proxies | Again/Hard/Good/Easy distribution, lapse rate, repeat attempts, self-check scores | Signals for difficulty and recall; not direct proof of learning |
| AI workflow | generation success rate, queue time, draft acceptance/edit/discard rate, retry rate | Whether AI saves effort while preserving review |
| AI usage quality | factuality flags, review corrections, reported errors, missing-card suggestions accepted | Whether generated content is useful and safe |
| Classroom use | classroom join rate, quiz start/completion, submission rate, teacher review time | Whether the teacher workflow is viable |
| Reliability | API errors, worker failures, queue age, export failures, crash/restart events | Whether the service can be trusted |
| Support burden | support requests, repeated issues, time to resolution | Whether operation is sustainable |

Report counts and rates together. For example, an 80% acceptance rate is not reassuring if it comes from only five drafts.

### 5.3 AI-card quality rubric

Sample generated cards from each source type and have two reviewers assess them independently where feasible. Reviewers should see the source material and card, but not the model/provider or whether another reviewer has accepted it.

Score each dimension from 1 to 5:

| Dimension | 1 | 3 | 5 |
|---|---|---|---|
| Factual grounding | materially false or unsupported | mostly correct with a minor concern | fully supported by the source |
| Completeness | misses the core answer | captures the main idea with gaps | covers the required answer |
| Concision | too long or unfocused | usable but could be shorter | focused on one clear recall target |
| Course voice | misleading terminology or style | generally compatible | matches source terminology and level |
| Formula/format quality | unreadable or incorrect notation | readable with minor fixes | renders and communicates correctly |
| Study usefulness | not suitable for recall | usable after editing | immediately useful as a flashcard |

Track critical factual errors separately. A single serious hallucination should not be hidden by a high average score.

Suggested initial quality gates for a pilot release:

- no known critical factual error reaches a user as an accepted card without the user explicitly accepting it after review;
- at least 90% of sampled cards are factually grounded or clearly flagged for correction;
- median study-usefulness score is at least 4/5; and
- reviewer agreement is reported, not just the average score.

These thresholds can be tightened or relaxed after the first labelled sample; record the reason for any change.

### 5.4 Learning evidence

Use a light-touch design appropriate to a prototype:

- compare each participant’s baseline and follow-up recall on the same topic where possible;
- compare performance on cards reviewed regularly with performance on cards rarely reviewed, while noting selection bias;
- inspect changes in lapse rate and repeated self-check performance over time; and
- ask participants whether the app changed what they studied, how often they studied, and how confident they felt.

Do not present usage, self-reported confidence, or in-app quiz scores as proof of improved course attainment. If a stronger causal claim is needed, design a separate preregistered or department-approved controlled study with an appropriate assessment and comparison group.

## 6. Data collection and privacy

Collect the minimum data needed for the evaluation. Prefer aggregated or pseudonymised identifiers, and separate contact details from evaluation data.

Recommended event fields:

```text
event_name, occurred_at, pseudonymous_user_id, role,
deck_id_hash, source_type, client_version, duration_ms,
success, error_category
```

Useful events include `deck_created`, `import_started`, `generation_ready`, `draft_accepted`, `draft_edited`, `draft_discarded`, `study_started`, `review_submitted`, `self_check_graded`, `quiz_submitted`, `export_completed`, and `support_issue_reported`.

Do not store raw answers, lecture PDFs, or AI prompts in analytics logs unless there is an approved research need. Keep source material and evaluation exports under the retention policy agreed before the pilot. Tell participants what is collected, why it is collected, who can access it, and when it will be deleted.

## 7. Analysis and reporting

The final report should include:

1. participant profile and recruitment limitations;
2. technical preflight results and unresolved defects;
3. task success and usability findings, with representative anonymised observations;
4. AI quality scores, critical errors, reviewer agreement, and examples of edits;
5. usage and learning-signal metrics with denominators and time windows;
6. teacher workflow results and classroom completion data;
7. privacy, support, cost, and operational incidents;
8. what changed during the pilot, since changing the product affects comparisons; and
9. a clear recommendation: proceed, proceed with conditions, revise and retest, or stop.

Use medians and ranges for small samples, show missing data, and avoid ranking individuals. Segment findings by role and source type where the sample supports it.

## 8. Decision gates

### Proceed with a wider pilot when

- critical student and teacher tasks are reliable;
- no unresolved P0 privacy, security, correctness, or data-loss issue exists;
- AI drafts are clearly labelled and reviewable;
- export, backup, restore, and worker recovery have been verified;
- participants can explain the product’s limitations; and
- the team has an owner and response path for reported incorrect cards.

### Continue only with conditions when

- usability is acceptable but specific high-impact friction remains;
- AI quality is useful but requires a narrower source scope, stronger review, or lower quotas;
- reliability is adequate for a small group but not yet for a larger classroom; or
- evidence is encouraging but too sparse to support learning-impact claims.

### Pause or stop when

- critical factual errors are accepted without meaningful review safeguards;
- personal or copyrighted source material is retained or shared outside the approved policy;
- users can access another user’s data or classroom results;
- backups cannot be restored; or
- the operational burden or external AI cost is not sustainable for the intended use.

## 9. Responsibilities and cadence

- **Before each release:** engineering runs Stage A and records the release checklist.
- **During formative testing:** a facilitator observes sessions; a separate reviewer triages findings.
- **Weekly during the pilot:** review reliability, AI errors, support issues, usage totals, and safety incidents.
- **At pilot close:** freeze the analysis window, export the agreed dataset, run the rubric review, and write the decision report.
- **After the decision:** update [roadmap.md](./roadmap.md), [KNOWN_ISSUES.md](./KNOWN_ISSUES.md), and the user/teacher guidance with verified findings.

