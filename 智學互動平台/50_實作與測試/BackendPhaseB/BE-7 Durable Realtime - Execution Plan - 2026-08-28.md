# BE-7 Durable Realtime Implementation Plan

## Context

The backend currently has an R-1-lite in-process Socket.IO bus. Signals are published after a mutation commits, but they have no durable record, per-session sequence, aggregate watermark, replay cursor, retry queue, or cross-instance fan-out. A publisher or process failure can therefore lose a notification even though PostgreSQL committed the mutation. The current gateway also performs asynchronous signal handling without per-session ordering, while `transitionQuestion()` and auto-close do not fully share the submit/close lock protocol.

BE-7 will add a PostgreSQL-backed, replayable realtime path without making Socket.IO, Redis, or client state authoritative. It must preserve the existing teacher/anonymous/account-bound student authorization, vote-to-reveal, open-text anonymity, token redaction, immutable/idempotent submissions, and submit/close commit-order semantics. The working tree already contains an unrelated/uncommitted BE-6 evidence update in `tasks/todo.md`; preserve it and append BE-7 notes rather than replacing it.

## Contract decisions to freeze at Checkpoint A

- Wire envelope is v1 camelCase: `{ event, schemaVersion, eventSeq, aggregateVersion, serverTimestamp, liveSessionId, visibility, data }`.
- `eventSeq` is a monotonic PostgreSQL `BIGINT` scoped to one LiveSession. The wire mapper converts it safely to the agreed JSON representation; no snake_case aliases are introduced.
- `aggregateVersion` is the `SessionQuestion` result watermark. Increment it for every fresh accepted submission and for the question-close transition that freezes the final result; lifecycle-only events carry the neutral version. Snapshots include `watermark: { eventSeq, aggregateVersions: { [sessionQuestionId]: version } }`.
- Canonical durable events are `session.snapshot`, `session.state_changed`, `question.opened`, `question.closed`, `result.updated`, `session.closed`, and `sync.required`. A new participant is represented by a teacher-visible `session.snapshot` checkpoint with a safe reason; the existing `participant.joined` signal may remain only as an internal wake/legacy alias.
- Outbox rows store only safe immutable projection inputs (event/reason/status/question ID/version). They never store participant IDs, raw participant tokens, answer content, identity-to-answer links, passwords, or other credentials. Actor-specific result/snapshot data is materialized at delivery/replay time from PostgreSQL and reauthorized per socket.
- `lastEventSeq` is accepted as a validated non-negative decimal value in Socket.IO handshake auth. Malformed, stale, expired, missing, over-current, or permission-invalid cursors do not authorize access; after successful authentication they produce `sync.required` plus an actor-safe fresh snapshot where the session boundary permits recovery. Closed/cancelled new realtime handshakes remain rejected; already connected clients receive the terminal close signal and are disconnected.
- Replay reads retained rows strictly greater than `lastEventSeq`, in sequence order. Invisible rows are filtered by actor visibility without leaking their data; an actual retained gap, expired/coalesced checkpoint that cannot establish continuity, dead event, or terminal boundary forces `sync.required` and a snapshot rather than guessed deltas. Clients deduplicate by `(liveSessionId, eventSeq)` and must not apply an older watermark over newer state.
- Only pending/retry `result.updated` display notifications may coalesce by `(liveSessionId, sessionQuestionId, visibility)` to the newest aggregate version. Coalesced rows remain retained until expiry for gap accounting. State transitions, question/session close, snapshots, sync controls, and submission/idempotency outcomes are never coalesced.
- `REALTIME_REDIS_MODE=off|optional|required` gates the Socket.IO Redis adapter. `off` is the explicit local single-instance path; `optional` falls back to local delivery and reports multi-instance readiness degraded; `required` fails readiness or returns a stable retryable operational state when Redis is unavailable. Redis is fan-out/coordination only and never authorizes requests or stores domain truth.

## Recommended implementation

### 1. Checkpoint A: inventory, lock protocol, and contract fixtures

1. Reconcile the BE-7 plan with `30_系統設計/即時同步與結果治理設計.md`, `API 與共用 Schema 設計.md`, `資料模型與 ER 設計.md`, `架構、容量與可觀測性設計.md`, the WBS, and the current implementation/commit history.
2. Record the event catalog, visibility matrix, cursor validation rules, watermark semantics, retention/gap behavior, retry/coalescing rules, and Redis degradation policy in focused realtime contract types/tests. Reuse the existing gateway projection methods rather than duplicating privacy logic.
3. Normalize the documented transaction lock order to `liveSession -> sessionQuestion` for submission, question open/close, manual close, and auto-close. Account-bound paths retain the existing `liveSession -> course -> account` order.
4. Update `tasks/todo.md` with the Checkpoint A findings and stop for human confirmation before applying schema or runtime changes, as required by repository checkpoint rules.

### 2. Additive durable schema and sequence/version persistence

Modify `prisma/schema.prisma` and add one hand-written additive migration under `prisma/migrations/`:

- Add `LiveSession.realtimeEventSeq BigInt @default(0)` and `SessionQuestion.aggregateVersion Int @default(0)` with the existing UUID/UTC conventions.
- Add a `LiveSessionEvent` (outbox) model with UUID-v7 identity, LiveSession and optional SessionQuestion linkage, `eventName`, `schemaVersion`, `eventSeq`, `aggregateVersion`, server/created timestamps, visibility, bounded safe JSON projection inputs, delivery state, attempt count, next-attempt time, claim/lease fields, last failure classification, coalesced marker, and expiry/retention time.
- Use TEXT + CHECK for event names, visibility, and delivery states. Add the unique `(liveSessionId, eventSeq)` constraint and indexes for ordered replay, pending/lease scans, expiry cleanup, and eligible result coalescing. Use a relation/delete policy that does not make short-lived event retention block existing archive/tombstone governance.
- Allocate `eventSeq` by incrementing the locked LiveSession row and returning the new value inside the caller transaction. Do not use a second allocator transaction and do not use PostgreSQL advisory-lock calls through Prisma `$queryRaw` when the function returns `void`; retain `$executeRaw` for advisory locks.
- Run Prisma generation and the repository’s CJS normalization script after the schema change; do not run migration deployment until the user explicitly authorizes the guarded test database.

### 3. Transactional outbox append and mutation integration

Add a focused realtime persistence/application layer, for example `src/modules/realtime/live-session-outbox.service.ts` plus contract/materializer helpers. It must accept a `Prisma.TransactionClient`, assume or verify the documented session/question locks, allocate the next sequence, and append exactly one durable event for each committed realtime-producing transition.

Integrate it with:

- `LiveSessionService.startSession`, `transitionQuestion`/open/close, `closeSession`, `cancelSession`, and `autoCloseExpiredSessions`.
- `ParticipantService.join`, `joinForAccount`, and first-time account participant creation from `resolveAccountParticipant`.
- `SubmissionService.submit` for a fresh accepted submission only. Same-key idempotent replay returns the original row and does not create a second result event; conflicts remain conflicts.
- `GovernanceService` close/archive linkage so manual and automatic terminal close use one safe, idempotent transaction-scoped archive helper or a clearly durable repair path. Preserve the archive’s anonymous projection and retention behavior.

Each mutation must update authority, increment the relevant question aggregate version where applicable, and append its event before commit. Keep a post-commit wake trigger for the publisher and a compatibility `counts.updated` alias if needed by the current frontend, but make the outbox—not the in-process bus—the source of replay and event ordering. A wake/publisher failure must never change an already committed REST result.

When closing a session, lock and close open questions in deterministic order, append their `question.closed` events, append the session transition and terminal `session.closed` in the same transaction, and ensure auto-close goes through this exact path. `cancelled` remains terminal without an archive and emits its state transition only. Fix the current post-commit archive/error behavior so a committed close cannot return a misleading failure or lose its durable terminal event.

### 4. Bounded publisher, retry, and coalescing

Add `src/modules/realtime/live-session-publisher.ts` (or the repository-equivalent) and wire it through `realtime.module.ts` with lifecycle start/stop:

- Claim a bounded batch using PostgreSQL row locks/`SKIP LOCKED`, leases, and exponential bounded backoff. Enforce per-LiveSession sequence order so a later event is not delivered while an earlier event is pending/processing.
- Treat Socket.IO dispatch as notification delivery, not client acknowledgement. Mark delivered only after dispatch succeeds; transient failures return rows to retry, permanent/stale failures become an explicit dead state retained long enough for replay gap detection and metrics.
- Materialize each event through the existing teacher/participant snapshot/result readers at publish time. For participant result events, enumerate authenticated participant sockets and compute each actor-safe projection; never persist or broadcast a teacher projection to a participant room.
- Coalesce only eligible pending/retry `result.updated` rows, retaining sequence evidence. Preserve all ordered lifecycle/close/snapshot/control events and all domain idempotency/ack outcomes.
- Wake the worker from post-commit signals but retain startup scanning so process restarts recover pending rows. Add bounded payload/log handling and low-cardinality operational telemetry for queue depth, oldest age, attempts, retries, dead letters, coalesced updates, and `sync.required`.
- On shutdown, stop new claims, finish a bounded in-flight batch, release/expire leases, unsubscribe listeners, and close transport resources without blocking the application indefinitely.

Update `LiveSessionEventBus` so it remains a listener-isolated wake/legacy boundary rather than the durable event authority. Serialize publisher/materializer work per session; do not rely on the current concurrently launched `handleSignal()` calls for event order.

### 5. Gateway envelope, snapshot watermark, and replay

Refactor `src/modules/realtime/live-gateway.ts` while preserving its manual `cookie.parse()` handshake path, room split, authorization rechecks, and visibility-specific result methods:

- Add the canonical event name and `eventSeq`/`aggregateVersion` to every emitted durable envelope. Keep `serverTimestamp` informational.
- Add authoritative watermark data to `session.snapshot` and `snapshot.fetch` (and the REST participant snapshot DTO where required), computed from the event table and SessionQuestion versions rather than client state.
- Authenticate first exactly as today for teacher/admin cookie, anonymous session-code + participant token, and account-bound student cookie. Parse and validate `lastEventSeq` only after the actor/session scope is known; never use room membership as authorization.
- On a contiguous cursor, replay strictly newer retained events in order and then emit the current watermark. On stale/expired/gapped/coalesced/dead/permission-invalid requests, emit one actor-safe `sync.required` and a fresh snapshot; do not expose why another actor’s rows were filtered.
- Keep teacher-only counts/results in `teacher:<id>` and per-client participant results out of the shared session room. Preserve quiz correctness/reveal gates and open-text plain-text anonymity during replay exactly as in REST.
- On `session.closed`, emit the terminal event once per eligible connected client, then disconnect. New closed/cancelled/expired handshakes remain rejected with the existing stable boundary semantics.
- Add explicit sequence/dedupe handling so a late async delivery cannot overwrite a newer state. Keep the existing legacy event names only as compatibility aliases with the same safe projections.

### 6. Redis adapter sub-slice and readiness

- Pin `redis` and `@socket.io/redis-adapter` versions compatible with the installed Socket.IO major; update `package.json`/lockfile, `.env.example`, `env.validation.ts`, and `configure-websocket.ts`.
- Build the adapter during application bootstrap/lifecycle according to `REALTIME_REDIS_MODE`, with bounded connect/disconnect handling. Keep the existing local adapter when mode is `off` or optional fallback is active.
- Ensure `fetchSockets()` and room fan-out work across instances when Redis is available. Redis outage must not bypass `SessionGuard`, participant reauthorization, enrollment checks, or PostgreSQL reads.
- Extend readiness only for the selected required mode; liveness remains process-only. Add a safe optional Redis Compose profile/service without changing the existing default database stack unless explicitly enabled.
- Keep account/participant reauthorization on every sensitive projection so a missed cross-instance lifecycle signal cannot retain access.

### 7. Tests, docs, and evidence

Add/extend focused tests:

- Unit: event envelope/cursor validation, sequence/version monotonicity, coalescing eligibility, retry classification, snapshot watermark mapping, and projection privacy. Extend `src/modules/realtime/live-session-event-bus.spec.ts` only for wake/legacy behavior.
- PostgreSQL integration: a new outbox/sequence suite plus `test/poll-submission.integration-spec.ts` coverage for same-session concurrency, unique ordered sequences, rollback with no orphan event, fresh-vs-replayed submission events, close/submit consistency, deterministic question lock order, bounded claims, retry/lease recovery, and version increments.
- Realtime E2E: extend `test/live-session-realtime.e2e-spec.ts` and add a replay-focused suite for initial watermark, contiguous replay, duplicate/out-of-order deduplication, stale/gap `sync.required` recovery, publisher restart/transient failure, teacher/student/anonymous visibility, close/auto-close terminal events, archive linkage, and no secret/answer leakage. Reuse existing pre-registered listeners and guarded database helpers.
- Redis contract/integration: verify off/optional/required modes, local fallback/degraded readiness, cross-instance room delivery, and PostgreSQL-only authorization. These tests must be deterministic and non-skipped when the Redis profile is explicitly enabled.
- Re-run adjacent lifecycle/archive/result/privacy suites, including the existing BE-6 E2E prerequisites. The current `tasks/todo.md` records that auto-close lifecycle E2E was blocked at teacher provisioning (`Missing __Host-csrf cookie`); do not claim it passed without reproducing and resolving that fixture failure.
- Update `docs/frontend-api-reference.md`, the authoritative realtime/WBS status, and `tasks/todo.md` with the delivered durable contract, deferred load/operations evidence, migration status, warnings, and exact database scope. Add a lesson entry only for a verified new failure mode.

## Acceptance criteria

- Every successful realtime-producing mutation commits its authoritative changes and outbox row atomically; rollback leaves neither a false event nor a committed mutation without a replayable record.
- `eventSeq` is gap-detectable and monotonic per LiveSession; `aggregateVersion` is monotonic for each relevant question/result projection.
- A contiguous retained cursor replays only strictly newer events in order. Stale, expired, gapped, dead, or unauthorized cursors receive `sync.required` and an actor-safe snapshot/watermark.
- Publisher restart, crash, transient failure, duplicate delivery, and coalescing do not lose accepted submissions, create duplicate domain rows, or leak projections; only eligible result notifications coalesce.
- Teacher, anonymous participant, and account-bound student authorization, reveal, anonymity, and redaction invariants remain intact. Redis cannot authorize or become domain truth.
- Existing lite lifecycle, archive, auto-close, submit/close race, and full regression suites pass; dedicated BE-7 tests are not skipped and record their database/service scope.

## Verification and rollout

1. At the implementation checkpoints, run `npx prettier --write` before `npm run format:check`/`npm run lint:check`.
2. Static gates: `npm run prisma:validate`, `npm run typecheck`, `npm run lint:check`, `npm run format:check`, `npm run build`, and `git diff --check`.
3. After explicit user authorization, run only against `smartlearning_test` (the test setup implicitly deploys migrations and truncates that database): targeted outbox/sequence integration, replay E2E, submit/close and auto-close regression, archive/lifecycle/realtime suites, then full unit/integration/E2E regression and `npm run prisma:migrate:status`.
4. If schema generation changes, verify `generated/prisma` normalization and the compiled runtime entrypoint (`node dist/src/main.js`) before claiming completion.
5. Roll out additively: migration and append-only rows first; enable the durable publisher/replay mode after sequence/data consistency checks; enable Redis independently. Keep a reversible config switch to the lite path during rollout, stop workers before application rollback, retain additive tables for forward repair, and monitor sequence gaps, `sync.required`, pending/oldest age, retries/dead letters, publish failures, duplicate deliveries, and privacy violations. Never use a destructive down migration or restore deleted/revoked data as rollback.
