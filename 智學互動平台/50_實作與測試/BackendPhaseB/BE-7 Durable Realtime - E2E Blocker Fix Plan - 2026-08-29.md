# Context

The BE-7 durable realtime runtime verification reached the guarded PostgreSQL-backed E2E suites and exposed two actionable failures recorded at the end of `tasks/todo.md` (2026-08-29):

1. `test/cp3-terminal-state.e2e-spec.ts` expects `409 SESSION_NOT_JOINABLE` for post-close anonymous submission, but close finalization now anonymizes participant token hashes in the same transaction, so the bearer-token guard returns `401 UNAUTHORIZED` before submission handling.
2. `test/live-session-realtime.e2e-spec.ts` registers the submission counts listener after participant join. The durable participant-join `session.snapshot`/compatibility `counts.updated` delivery can still be pending, so the listener captures the join-time `votedCount=0` event instead of the submission-time `votedCount=1` event.

The fix must preserve the authoritative contracts: closed/cancelled sessions accept no new writes; archive finalization removes account/display-name/token lookup links; durable event rows remain ordered and per-socket delivery remains serialized; teacher-only counts never reach participant sockets. DB-backed verification is authorized only against `smartlearning_test` and the guarded setup may perform its existing idempotent migration/truncation operations.

# Recommended approach

- Preserve the runtime archive/privacy behavior: closing a session rotates the anonymous participant token hash, so a stale anonymous bearer is invalid authentication and must remain `401 UNAUTHORIZED`; the authenticated student-cookie path still reaches the terminal-session state check and returns `409 SESSION_NOT_JOINABLE`. Update the CP3 E2E to assert these actor-specific outcomes separately, while keeping direct session-code join/reconnect and cancellation expectations strict. Do not weaken archive anonymization or broaden the helper to accept either status.
- Make the realtime E2E deterministic by pre-registering and awaiting the teacher’s participant-join snapshot/count notifications before registering listeners for the submission mutation. Keep the production outbox/publisher ordering implementation unchanged: the publisher’s sequence fence and per-socket queue are working as designed. Do not paper over the assertion with sleeps or broad timeouts.
- Format edited TypeScript before lint checks, then run focused E2E suites for CP3 and durable realtime first. If green, run the lifecycle/realtime/archive matrix and the full E2E regression, followed by typecheck, lint, format check, build, Prisma validation/status as applicable, and `git diff --check`.
- Update `tasks/todo.md` with the two root causes, files changed, exact verification counts, and any remaining non-blocking warnings. Update `tasks/lessons.md` only if implementation reveals a new reusable failure mode not already captured.

# Critical files

- `test/cp3-terminal-state.e2e-spec.ts` — post-terminal join/submission contract assertions, including the privacy-driven anonymous-token `401` path and account-bound `409` path.
- `test/archive-governance.e2e-spec.ts` — existing archive anonymization assertions to preserve and, if needed, strengthen with token-hash rotation/old-token rejection evidence.
- `test/live-session-realtime.e2e-spec.ts` — participant-join and vote-to-reveal event listener sequencing.
- `src/modules/governance/application/governance.service.ts` — existing archive anonymization invariant to preserve; no runtime change planned.
- `src/modules/realtime/live-session-publisher.ts` and `src/modules/realtime/live-gateway.ts` — verify durable ordering; no production change planned because the sequence fence and per-socket queue are correct.
- `tasks/todo.md` — current BE-7 verification record and final results.

# Checkpoints

- **Checkpoint A — understand/reproduce:** confirm both failures against the exact source paths and contract docs; distinguish the stale test fixture/order from a runtime defect.
- **Checkpoint B — minimal fix:** update the actor-specific terminal assertions and deterministic realtime listener setup; run focused E2E verification against `smartlearning_test`.
- **Checkpoint C — regression:** run the targeted lifecycle/realtime/archive matrix, then full E2E plus static/build gates; stop and re-plan on any unexpected failure.
- **Checkpoint D — evidence:** record exact commands/results, migration target/status, no-skip/no-failure counts, and rollback notes in `tasks/todo.md`.

# Acceptance criteria

- CP3 terminal-state E2E passes with no submissions or state mutation after close/cancel: direct session-code joins/reconnects and cancelled-token reconnects remain strict `409 SESSION_NOT_JOINABLE`; post-close anonymous bearer submission is `401 UNAUTHORIZED` because archive rotation removes the token lookup; post-close enrolled-student submission is `409 SESSION_NOT_JOINABLE`.
- Vote-to-reveal realtime E2E deterministically observes teacher `votedCount=1` and the matching `result.updated` payload, while participant-safe projection assertions remain green.
- Targeted and full E2E suites pass with zero failures/skips; integration and static quality gates pass, or any unavailable check is explicitly recorded with its reason.
- No destructive migration/down-migration or production-database mutation is performed; only the already-authorized guarded `smartlearning_test` test setup is used.

# Risk & rollback

- **Risk:** medium/high because participant auth error classification and durable realtime E2E coverage touch security/privacy and ordering boundaries.
- **Rollback:** revert the small participant-auth/test changes; retain the additive durable migration and do not restore anonymized participant links or run a destructive down migration.
- **Monitoring/evidence:** terminal `SESSION_NOT_JOINABLE`/`UNAUTHORIZED` responses, participant token-link anonymization, durable event sequence/order, teacher count/result projections, and publisher retry/open-handle diagnostics.

# Dependencies & environment

- Node.js 24+, generated Prisma client, PostgreSQL reachable through `.env.test` as `smartlearning_test`, and the current durable migration already applied there.
- DB-backed E2E commands use `NODE_ENV=test` and the repository guard in `test/setup/db.ts`; no other database may be touched.
- Redis remains outside the E2E claim while `.env.test` uses `REALTIME_REDIS_MODE=off`; Redis health is not reclassified as adapter/cross-instance coverage.

# Verification plan

1. Focused E2E: `NODE_ENV=test npm run test:e2e -- --runInBand --silent test/cp3-terminal-state.e2e-spec.ts`.
2. Focused durable realtime: `NODE_ENV=test npm run test:e2e -- --runInBand --silent test/live-session-realtime.e2e-spec.ts`.
3. Matrix: CP3, close/cancel, detail, results, route matrix, realtime, archive governance; then `NODE_ENV=test npm run test:e2e -- --runInBand --silent` (full suite) if the matrix is green.
4. Supporting checks: `npm run test:integration -- --runInBand --silent`, `npm run prisma:validate`, `npm run typecheck`, `npm run lint:check`, `npm run format:check`, `npm run build`, `NODE_ENV=test npm run prisma:migrate:status`, and `git diff --check`.
5. Record exact pass/fail/skip counts and any warnings in `tasks/todo.md`; do not claim BE-7 E2E completion until all required checks are run or explicitly documented as blocked.
