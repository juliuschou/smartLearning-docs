# BE-5.2 Archive Retention Implementation Plan

## Context

BE-5.1 has established the close-to-archive boundary and anonymous archive projection, but the WBS still leaves BE-5.2.1–BE-5.2.6 open. The backend already contains `ArchivedResult.purgeAt`, oldest-first purge selection, transactional tombstones/outbox, a leased manifest exporter, S3 immutability checks, retention metrics, alerts, and substantial tests. The remaining work is to turn these guarded foundations into a complete retention capability without duplicating the existing governance design.

The key correctness gap is deletion scope: after 90 days, current code deletes submissions, session questions/options, participants, and only `participant_after_submit` realtime events, then nulls the archive payload. The authoritative governance contract requires all answer-bearing session data, aggregates, participant identity/reconnect state, and question snapshots to be irreversibly removed. The current worker also has only invocation-local poison-row handling, `inspectDue()` is not an execution-equivalent dry-run, and manifest export is registered but not scheduled or callable through the operator CLI.

**Intended outcome:** a bounded, restart-safe and replica-safe retention worker that never deletes before `closedAt + 90 days`, removes the complete governed data set atomically with the canonical tombstone/outbox, provides a no-write dry-run using the same plan as execution, independently drains immutable manifests, exposes actionable low-cardinality observability, and remains disabled by default until separately authorized rollout gates are met.

## Current Status (2026-09-12)

**Overall status: source implementation and disposable qualification foundations are complete; staging qualification is BLOCKED. The capability is not production-authorized or WBS-closed.**

The detailed execution evidence is recorded in `smartLearning-backend/tasks/todo.md`. This section supersedes the original gap description above for current-state reporting; the remaining checkpoint descriptions below are retained as the implementation and authorization contract.

| Checkpoint                                       | Status             | Evidence / disposition                                                                                                                                                                                                                                        |
| ------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Freeze deletion contract                     | **GREEN**          | Governed deletion inventory, retained-data boundaries, deadline invariant, stop conditions, and rollback policy frozen.                                                                                                                                       |
| B — Durable purge state                          | **GREEN**          | Additive `ArchivedResult` claim/retry/lease/quarantine state and migration implemented and verified against the authorized guarded test database.                                                                                                             |
| C — Shared plan and true dry-run                 | **GREEN**          | Dry-run and destructive execution share the same eligibility, ordering, table predicates, category counts, and invariant checks.                                                                                                                              |
| D — Durable leasing                              | **GREEN**          | Bounded PostgreSQL claims, per-item transactions, lease recovery, retry/backoff, quarantine, and replica-safe compare-and-set transitions implemented.                                                                                                        |
| E — Worker/operator wiring                       | **GREEN**          | Independent purge and manifest-export workers, validated configuration, operator CLI commands, redacted output, and job metrics implemented.                                                                                                                  |
| F — Regression and observability                 | **GREEN**          | Targeted unit/DB/concurrency coverage, retention artifact checks, metrics, dashboards, and alert definitions implemented.                                                                                                                                     |
| G.1 — Static verification                        | **GREEN**          | Prisma/static/build/test gates completed in the recorded checkpoint evidence.                                                                                                                                                                                 |
| G.2 — Guarded PostgreSQL qualification           | **GREEN**          | Authorized `smartlearning_test` migration and targeted/full DB evidence completed; no other database was authorized by that evidence.                                                                                                                         |
| G.3 — Disposable S3 rehearsal                    | **GREEN**          | Immutable MinIO/S3 write, replay, checksum, encryption/object-lock, acknowledgement-loss recovery, and cleanup ownership rehearsed.                                                                                                                           |
| G.4 — Prometheus/Alertmanager rehearsal          | **GREEN**          | Metric → rule → Alertmanager → receiver chain rehearsed. The Prometheus reserved-label collision was fixed by changing application job labels from `job` to `bg_job`.                                                                                         |
| G.5/G.6 — Staging dry-run and destructive canary | **BLOCKED**        | The current environment has no identifiable staging deployment target, immutable S3 bucket/prefix, Prometheus/Alertmanager control plane, or verified rollback revision. The available `.env.production` is a localhost template and is not staging evidence. |
| G.7 — Capacity validation                        | **NOT AUTHORIZED** | W1–W8/load/saturation evidence remains behind its own authorization gate.                                                                                                                                                                                     |
| G.8 — Production rollout                         | **NOT AUTHORIZED** | Production migration, credentials, deployment, worker enablement, purge/export, and rollout observation remain behind a separate gate.                                                                                                                        |
| G.9 — WBS closeout                               | **NOT AUTHORIZED** | BE-5.2.1–BE-5.2.6 must remain open until staging, capacity, and authorized production evidence are pinned to the qualifying revision.                                                                                                                         |

### Latest canary-safety correction

Backend commit `63bc03d` (`fix(governance): isolate retention canary operations`) was committed and pushed to `origin/main` before staging execution:

- operator commands force both retention schedulers off before creating `AppModule`, so `inspect`, `dry-run`, `run-once`, and `manifest-export-once` cannot trigger an additional startup sweep;
- recurring workers require the master `RETENTION_OPERATIONS_ENABLED` gate, the matching operation gate, and the matching scheduler-specific gate;
- operation and scheduler gates remain disabled by default, and invalid scheduler combinations fail environment validation;
- `SmartLearningRetentionPurgeNoRecentSuccess` now requires a positive due backlog, avoiding a default-disabled/no-work false alarm;
- tests assert the exact `bg_job` label contract used by the deployed alert rules and dashboards.

The post-correction non-DB verification was GREEN: targeted Jest **5 suites / 75 tests**, retention artifact tests **1 suite / 2 tests**, plus typecheck, lint, format, build, `git diff --check`, and high-effort review. `promtool` was unavailable locally; the repository alert artifact test passed. No staging migration, DB-backed staging test, container deployment, provider call, purge, or manifest export was performed.

### Resume gate

Resume G.5/G.6 only after recording all of the following without exposing secrets:

1. exact staging deployment context and environment identity;
2. staging database identity and evidence that its schema is already current, or a separate migration authorization;
3. immutable S3-compatible bucket/prefix, object-lock retention, encryption, and least-privilege credential owner;
4. Prometheus/Alertmanager targets, matching `bg_job` rules, receiver/on-call ownership, and baseline health;
5. exact source commit, immutable image digest, previous rollback revision, operator, and second reviewer;
6. one uniquely identified synthetic archive whose batch-size-1 dry-run counts have been independently reviewed.

After a successful staging canary, stop again. Capacity validation, production rollout, recurring scheduler rollout, and WBS closeout each require their own explicit authorization.

## Success Criteria

- `purgeAt` remains immutable and exactly `closedAt + 90 days`; unrelated lifecycle/read operations never change it.
- At or after `purgeAt`, one transaction removes all session-scoped governed content:
  - all `Submission` rows;
  - all `LiveSessionEvent` rows for the session, including routing/projection/replay state;
  - all `SessionQuestionOption` and `SessionQuestion` rows;
  - all `Participant` rows and account/token/display/reconnect linkage;
  - `ArchivedResult.payload`, with archive state changed to deleted.
- Retain only non-answer lifecycle metadata, the deleted archive shell, one canonical `DeletionEvent`, and one manifest outbox record. Reusable Course `QuestionDefinition` rows are unaffected.
- Dry-run and destructive execution share the same eligibility, ordering, scope predicates, validation, and category-count logic; dry-run performs no writes or provider calls and emits no governed content.
- Purge failure state survives ticks, restarts, and multiple replicas; poison rows back off and eventually quarantine without blocking later due rows.
- Purge, manifest export, and reconciliation apply remain independently pausable. Export failure cannot roll back a committed purge.
- Targeted unit/DB concurrency/restart tests pass, followed by authorized provider/alert/staging evidence before WBS closeout.

## Implementation Checkpoints

### Checkpoint A — Freeze deletion contract and baseline

1. Add a new dated BE-5.2 section to `tasks/todo.md` with acceptance criteria, one in-progress item, dependencies/environment, high-risk classification, authorization gates, stop conditions, and rollback policy.
2. Record a table-by-table deletion inventory and confirm that `DELETED_CATEGORIES` matches the actual retained/deleted data contract.
3. Preserve these boundaries:
   - PostgreSQL is the clock and coordination authority.
   - `purgeAt` is the legal deadline and is never moved by retries.
   - `LiveSession`, Course, Account, and reusable `QuestionDefinition` data remain.
   - BE-5.3 provider-backed restore filtering/reconciliation is not reimplemented here; BE-5.2 must continue producing the canonical tombstone and immutable manifest required by it.
4. Stop for review before any migration or DB-backed verification.

### Checkpoint B — Add durable purge claim/retry state

Create one additive hand-written migration and update `prisma/schema.prisma` for durable work state on `ArchivedResult` (reuse the archive row as the unit of work):

- `purgeState`: `pending | processing | retry | quarantined | deleted` (`TEXT + CHECK`).
- `purgeAttempts` (non-negative).
- `nextPurgeAttemptAt` (backfill active rows from `purgeAt`).
- `purgeLeaseToken` and `purgeLeaseExpiresAt` (both set or both null).
- `lastPurgeFailureCode` and `lastPurgeFailedAt` using only stable, low-cardinality failure classes.
- `quarantinedAt`; optionally `purgedAt` if needed for efficient lateness metrics.

Migration requirements:

- Preflight existing active/deleted and payload invariants; fail loudly on inconsistent rows.
- Backfill active rows as pending and deleted rows as deleted.
- Enforce state/lease/quarantine/deleted coherence with CHECK constraints.
- Add a bounded due/lease-recovery index for active `pending`, `retry`, and expired `processing` rows.
- Preserve the existing `active + payload` / `deleted + NULL payload` invariant.
- No down migration; rollback is disable/forward-fix.
- Use existing UUID v7 generation for lease tokens and governance IDs.

**Authorization boundary:** do not run Prisma generation, migration deployment/status, or DB-backed suites until the user separately authorizes the exact `smartlearning_test` operations.

### Checkpoint C — Build one shared retention plan and true dry-run

Refactor `GovernanceService` so early deletion, retention purge, and manifest replay do not maintain divergent deletion table lists. Reuse `TransactionService.lockLiveSessionForUpdate()`, canonical event lookup, `parseDeletionManifest()`, and existing tombstone/outbox creation.

Introduce a small internal planning/execution seam, e.g.:

- `buildRetentionDeletionPlan(...)`
- `inspectRetentionDeletionPlan(...)`
- `executeRetentionDeletionPlanInTransaction(...)`

The plan contains identifiers, eligibility/state, fixed deletion categories, exact row-count predicates, stable blockers, and deterministic operation order—never prompts, answer values, names, tokens, or unrestricted exception text.

Execution order inside the locked transaction:

1. Re-read and validate archive/session identity, due boundary, current state, lease ownership, and canonical-event consistency.
2. Delete all session `Submission` rows.
3. Delete all session `LiveSessionEvent` rows.
4. Delete session question options, then session questions.
5. Delete all session participants.
6. Assert the governed row counts are zero.
7. Null archive payload and mark archive/purge state deleted.
8. Create or validate the canonical successful `DeletionEvent` and `DeletionManifestOutbox` in the same transaction.
9. Resolve any matching early-deletion request when that trigger uses the shared executor.

Add an execution-equivalent `planDuePurgeBatch(limit, asOf)` dry-run:

- Same due predicate, ordering (`purgeAt`, then ID), limit 1–100, plan builder, row predicates, and invariant checks as execution.
- Point-in-time only; it does not claim rows and execution must revalidate.
- Output stable JSON with observed time, batch bound, selected IDs/deadlines, category-level counts, executable status, and stable blockers.
- Explicitly records that no writes/provider requests were attempted.
- Keep `inspectDue()` as a lightweight metrics query, not as the BE-5.2 dry-run.

### Checkpoint D — Replace invocation-local purge with durable leasing

Rework `GovernanceService.purgeDue()` into bounded claim, per-item execution, and compare-and-set failure transitions:

1. **Claim transaction:** select at most the configured batch of oldest eligible active archives using `FOR UPDATE SKIP LOCKED`; include due pending/retry rows and expired processing leases; increment attempts and assign UUID v7 lease ownership.
2. **Per-item transaction:** lock the live session/archive, verify the matching lease, run the shared deletion executor, and commit tombstone/outbox/deleted state atomically. One item failure must not roll back successful siblings.
3. **Failure transition:** update only when the lease token still matches. Retry transient fixed-class failures with bounded exponential backoff; quarantine permanent or exhausted failures; clear the lease; never alter `purgeAt`.
4. Remove the in-memory `failedIds` set. Expired leases provide crash/restart recovery across scheduler ticks and replicas.
5. Use DB time for production eligibility/claiming; retain injected time only for deterministic tests.

Stable failure classes should be an explicit allowlist such as invariant conflict, FK blocker, lease lost, transient DB, unavailable DB, and unknown. Do not persist raw exception messages that could contain governed data.

### Checkpoint E — Complete worker and operator wiring

1. Split scheduling responsibilities for clear independent control:
   - retain/refine `RetentionScheduler` for purge;
   - add a manifest-export scheduler that calls `DeletionManifestExporter.exportDueBatch()`.
2. Give each loop independent enable, interval, batch, no-overlap, shutdown-drain, and health/last-success behavior. Cross-replica safety remains PostgreSQL leases/locks, not process memory.
3. Add validated/coerced environment fields for purge lease/max attempts and manifest export enable/tick/batch. Defaults remain disabled; production validation requires durable S3 configuration when purge/export is enabled.
4. Replace the no-op branches in `src/bootstrap/retention.ts`:
   - `inspect`: lightweight backlog inspection;
   - `dry-run`: shared execution-equivalent plan;
   - `run-once`: one bounded purge run;
   - `manifest-export-once`: one bounded outbox export run;
   - preserve separately gated reconciliation inspect/apply commands for BE-5.3 compatibility.
5. Return redacted stable JSON and non-zero exit status for failed/quarantined operation outcomes. Require explicit operation gates; do not make a broad persistent flag sufficient for destructive production use.
6. Update `.env.example`, package scripts, runbook, and backend operational/API references where the command/config contract changes.

### Checkpoint F — Regression, concurrency, and observability coverage

Add the smallest tests that prove each WBS item rather than duplicating existing coverage.

**Unit/static tests**

- Exact 90-day deadline and immutability under retry.
- Shared plan’s deletion categories and predicates.
- Dry-run output redaction and zero side effects.
- Retry/backoff bounds, lease compare-and-set, lease recovery, and quarantine.
- Scheduler independence, exporter invocation, non-overlap, and shutdown drain.
- Environment fail-closed rules and numeric coercion.
- Operational artifact tests for alerts/dashboard/runbook.

**Authorized PostgreSQL E2E/integration tests**

- Boundary: not eligible immediately before `purgeAt`, eligible exactly at it.
- Fixtures include poll/quiz/open-text submissions, all realtime visibility classes, question snapshots/options, participants with account/token linkage, aggregate/projection state, and archive payload.
- Post-purge zero-count assertions for every governed table plus exactly one canonical event/outbox.
- Transaction failure after an intermediate delete rolls back the full item.
- Two worker instances do not double-process.
- Crash/expired lease is reclaimed after restart.
- Poison row retries/quarantines while later due rows continue.
- Dry-run category counts equal immediately following execution on unchanged fixtures.
- Repeated purge and exact manifest replay remain idempotent.
- Early-delete/retention race still produces one canonical successful deletion.

Reuse `test/archive-governance.e2e-spec.ts`, `test/deletion-manifest-exporter.integration-spec.ts`, existing S3 provider tests, and `withQuiescedLiveSessionPublisher` around destructive fixture cleanup.

**Observability**

Reuse `MetricsService.recordJobItem()` / `recordJobRun()` and existing retention metrics. Add only low-cardinality backlog/retry/quarantine/oldest-age/lateness/last-success signals and fixed outcome/failure labels. Update alerts for overdue backlog, any quarantine, repeated worker failure, manifest lag/dead rows, and missing expected successful runs. Never label by archive/session/course/user/provider object ID or exception text.

### Checkpoint G — Guarded operational qualification and WBS closeout

After code and targeted tests are green, expand evidence only through separately authorized gates:

1. Static bundle: Prisma validation, generated-client compile, typecheck, format, lint, build, targeted unit tests, artifact tests, `git diff --check`.
2. Guarded `smartlearning_test`: explicitly authorized migration deployment/status and targeted E2E/integration suites, then full unit/E2E/integration regression.
3. Disposable S3-compatible rehearsal: conditional immutable write, exact replay equality, conflict/unverifiable replay failure, encryption/object-lock evidence, exporter restart/ack-loss recovery, and cleanup ownership.
4. Prometheus/Alertmanager rehearsal: pending → firing → delivered → resolved evidence for backlog, quarantine/failure, and manifest lag/dead alerts.
5. Staging read-only dry-run; review category counts and query plans before any destructive run.
6. Staging canary with disposable seeded data and batch 1–5; verify DB zero counts, tombstone/outbox, manifest, metrics, and BE-5.3 reconciliation compatibility.
7. Capacity/load evidence showing bounded workers do not starve API/realtime traffic.
8. Production rollout, if separately authorized: deploy schema/code disabled; enable exporter first; enable purge on one replica with batch 1; observe; then ramp and finally qualify multi-replica operation.
9. Update `tasks/todo.md` Results and only check BE-5.2.1–BE-5.2.6 in the authoritative WBS when the item-specific evidence is pinned to a clean revision. Do not use repository tests/YAML alone as proof of deployed provider, alert routing, or production readiness.

## Critical Files

- `prisma/schema.prisma`
- `prisma/migrations/<new-additive-retention-worker-state>/migration.sql`
- `src/modules/governance/application/governance.service.ts`
- `src/modules/governance/application/retention.scheduler.ts`
- `src/modules/governance/application/deletion-manifest.exporter.ts`
- `src/modules/governance/application/retention-reconciliation.ts` (compatibility only; provider-backed restore work remains BE-5.3)
- `src/modules/governance/governance.module.ts`
- `src/bootstrap/retention.ts`
- `src/config/env.validation.ts`
- `src/modules/metrics/metrics.service.ts`
- `test/archive-governance.e2e-spec.ts`
- `test/deletion-manifest-exporter.integration-spec.ts`
- `test/s3-sandbox-rehearsal.integration-spec.ts`
- `ops/observability/prometheus-alerts.yml`
- `ops/observability/retention-runbook.md`
- `.env.example`, `package.json`, backend operational/API docs
- `tasks/todo.md`; authoritative WBS only at evidence closeout

## Risk and Rollback

**Risk: high.** This is irreversible deletion across privacy-sensitive data and concurrent workers.

Immediate stop conditions:

- any deletion before `purgeAt`;
- dry-run/execution category mismatch;
- unexpected retained or unexpectedly selected governed rows;
- tombstone/outbox not atomic with deletion;
- manifest checksum/immutable-key conflict;
- growing quarantine or lost lease ownership;
- worker impact on interactive API/realtime SLOs.

Rollback before deletion is disabling purge/export gates and reverting or forward-fixing application code while leaving additive schema in place. After a successful purge, deleted answer-bearing data must never be restored by application rollback or backup restore. Preserve tombstones, outbox rows, immutable manifests, logs, and metrics; pause new claims and forward-fix. No normal down migration and no reconstruction of deleted aggregates or submissions.
