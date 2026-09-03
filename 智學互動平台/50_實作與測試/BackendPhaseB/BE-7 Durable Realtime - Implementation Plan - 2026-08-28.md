# BE-7 Durable Realtime — Implementation Plan

## Context

The backend currently has a lite, in-process post-commit realtime bus and Socket.IO `/live` gateway. The authoritative M2 realtime design requires durable PostgreSQL-backed outbox records, per-LiveSession monotonic event sequencing, replay/reconnect watermarks, `sync.required` on gaps, bounded publishing/coalescing, and preservation of current visibility and submit/close linearization invariants. BE-7 should extend the existing runtime additively without replacing PostgreSQL authority or exposing teacher-only/identity-sensitive data.

## Checkpoint A — Understand and freeze the contract

- Inspect the current realtime gateway/event bus, LiveSession/Participant/Submission services, transaction/lock helpers, Prisma models/migrations, and focused realtime/submit-close tests.
- Reconcile implementation details with `docs/智學互動平台/30_系統設計/即時同步與結果治理設計.md`, the API/schema design, ERD, architecture/observability design, and the current BE-7/WBS task entry.
- Freeze event envelope/catalog, sequence scope, aggregate-version semantics, reconnect `lastEventSeq` input, retention/gap behavior, visibility projection rules, and publisher retry/coalescing boundaries before coding.
- Confirm migration/additive-change and operational constraints; no destructive migration or DB reset.

## Recommended implementation

**Primary files/patterns:** extend `src/modules/realtime/live-session-event-bus.ts`, `live-gateway.ts`, and `realtime.module.ts`; integrate `src/modules/live-sessions/application/live-session.service.ts`, `src/modules/participants/application/participant.service.ts`, and `src/modules/submissions/application/submission.service.ts`; reuse `src/prisma/transaction.service.ts` and existing `src/bootstrap/configure-websocket.ts`; add focused realtime application/domain files and migrations under `prisma/migrations/`; extend `test/live-session-realtime.e2e-spec.ts` and `test/poll-submission.integration-spec.ts`.

1. **Durable event model and migration**
   - Add an additive Prisma model/migration for a LiveSession-scoped outbox/event record containing UUID identity, `liveSessionId`, monotonic `eventSeq`, event name/schema version, aggregate/session-question linkage as needed, visibility/projection metadata, payload or projection inputs, timestamps, delivery state/attempts/next-attempt, and bounded-retention fields.
   - Add the unique/index constraints needed for `(liveSessionId, eventSeq)`, pending delivery scans, replay-by-sequence, and coalescing of eligible `result.updated` notifications. Preserve UUID v7, UTC `TIMESTAMPTZ`, TEXT+CHECK conventions, and avoid storing raw participant tokens, identity-to-answer links, or secrets.
   - Add a per-session sequence allocation mechanism in the same transaction as authoritative mutation/outbox append; use existing `TransactionService` lock/advisory patterns and document lock order so submit/close/auto-close cannot deadlock.

2. **Transactionally append events at mutation boundaries**
   - Introduce a focused outbox/application service that allocates the next session sequence and appends an event within the caller’s existing transaction.
   - Replace or adapt current post-commit `LiveSessionEventBus.publish` calls at lifecycle, question open/close, submission/result, participant/join, manual close, and auto-close paths so the durable row is written before commit; retain post-commit publication as a delivery trigger/fallback, never as the authority.
   - Keep submit/close linearization unchanged: the committed submission/aggregate and its event must agree, and close-first must reject later submissions.

3. **Publisher, retry, coalescing, and observability**
   - Add a bounded publisher worker/scheduler with lifecycle startup/shutdown, batch limits, retry/backoff, stale/failed handling, and per-event/listener isolation. It must not block or roll back committed REST mutations.
   - Implement only the permitted coalescing (`result.updated` latest eligible notification); never coalesce state transitions, close events, acknowledgements/idempotency outcomes, or snapshots.
   - Add queue-depth/oldest-age/retry/failure metrics or structured logs using existing observability conventions, with sensitive-field redaction and bounded payload/log sizes. Define safe overload behavior (`sync.required`/retryable response) rather than silent loss or indefinite blocking.
   - Implement the Redis Socket.IO adapter as a separately gated BE-7 sub-slice (the WBS requires multi-instance fan-out), adding only the repository’s chosen maintained Redis client/adapter dependencies after checking current package compatibility. Redis remains auxiliary for fan-out/coordination only, PostgreSQL remains authoritative, adapter outage must mark multi-instance readiness degraded or return a stable retryable state when the selected mode requires it, and no fallback may bypass authz. Keep single-instance local delivery as the explicit safe fallback.

4. **Replay and reconnect protocol**
   - Extend gateway handshake/connection state to accept a validated `lastEventSeq` and authenticate exactly as today for teacher/admin, anonymous participant, and account-bound student.
   - On reconnect, query retained events strictly after the supplied sequence in order, apply the actor-specific visibility projection, and emit a current watermark. If the requested sequence is stale, missing, expired, permission-invalid, or crosses a closed-session boundary, emit `sync.required` and send/facilitate a fresh actor-specific snapshot.
   - Ensure snapshots expose authoritative `eventSeq`/aggregate-version watermarks and clients cannot use older events to overwrite newer state. Preserve manual cookie parsing and all existing privacy/reveal rules.
   - Keep teacher projections out of participant rooms and ensure open-text/quiz correctness and counts remain gated exactly as current REST/Socket behavior requires.

5. **Regression coverage and contract documentation**
   - Add domain/unit tests for sequence monotonicity, event envelope validation, coalescing eligibility, retry classification, and projection privacy.
   - Add PostgreSQL integration tests for same-session concurrent mutations, sequence uniqueness/order, transaction rollback (no orphan outbox event), submit/close event/data consistency, and bounded pending-row claims.
   - Extend realtime E2E coverage for reconnect replay, duplicate delivery/dedup watermark behavior, stale-gap `sync.required` + snapshot recovery, teacher/student/anonymous visibility, publisher restart/retry, and publisher failure isolation. Include auto-close and archive-triggered terminal events.
   - Update API/frontend reference and authoritative realtime/WBS documentation to distinguish delivered durable behavior from any deferred Redis/load/operational work.

## Acceptance criteria

- Every successful realtime-producing mutation has its authoritative row changes and outbox append committed atomically; rollback leaves neither a false event nor a committed mutation without a replayable record.
- `eventSeq` is gap-detectable and monotonic per LiveSession; `aggregateVersion` is monotonic for the relevant question/result projection.
- Reconnect with a contiguous retained `lastEventSeq` replays strictly newer events in order; stale/expired/gapped/unauthorized requests receive `sync.required` and an actor-safe snapshot/watermark.
- Publisher crash, restart, transient failure, and duplicate delivery do not lose accepted submissions, duplicate domain rows, or leak projections; eligible result updates alone may coalesce.
- Teacher, anonymous participant, and account-bound student projections retain existing authorization, reveal, anonymity, and token-redaction invariants; Redis cannot authorize or become domain truth.
- Existing lite lifecycle, archive, auto-close, submit/close race, and full regression suites remain green, with dedicated BE-7 tests non-skipped and DB scope recorded.

## Checkpoint B — Verification

- Run formatting before lint.
- Static: `npm run prisma:validate`, `npm run typecheck`, `npm run lint:check`, `npm run format:check`, `npm run build`, `git diff --check`.
- DB-backed tests only after explicit authorization, limited to `smartlearning_test`; note that test setup implicitly performs idempotent migration deployment and truncation. Never run migration deploy or destructive DB commands against development/production without authorization.
- Targeted first: outbox/sequence unit and integration tests, then realtime replay E2E, submit/close and auto-close regression, then archive/lifecycle/realtime adjacent suites.
- Expand to full unit, integration, and E2E regression; record failures, skips, warnings, migration status, and DB scope explicitly in `tasks/todo.md`.
- If schema/runtime parity is relevant, verify the compiled runtime artifact and generated Prisma client normalization conventions before claiming completion.

## Risk, rollback, and rollout

- **Risk:** high: durable event schema, concurrency/ordering, replay authorization, and realtime privacy are production-impacting.
- **Rollback:** deploy application support before enabling publisher/replay mode; use a feature/config switch to keep the existing lite post-commit delivery path while preserving newly written outbox rows. Revert application code only after stopping workers safely; retain additive tables/migrations and forward-fix rather than destructive down migration.
- **Rollout:** migrate additively, enable append-only outbox writes, verify queue/age/retry metrics and event/data consistency, then enable replay/publisher per environment; stage any Redis adapter separately. Monitor sequence gaps, `sync.required`, pending age/dead-letter counts, publish failures, duplicate deliveries, and projection/privacy violations.
