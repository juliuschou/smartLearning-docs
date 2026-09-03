# Context

Checkpoint C’s serialized seven-suite E2E matrix reproduced PostgreSQL `40P01` while `test/setup/db.ts::truncateAll()` raced an in-flight `LiveSessionPublisher` cycle. The publisher starts at application initialization, may continue projection/ack/retry work after a socket assertion completes, and is only shut down at suite end; the next `beforeEach` can therefore begin schema-wide `TRUNCATE ... CASCADE` while publisher DB work is active. Isolated reruns can pass, so timing-based retries or sleeps would only mask the missing lifecycle boundary.

The intended outcome is deterministic test isolation: fully quiesce the publisher before destructive cleanup, restore it immediately afterward for realtime tests, preserve all durable delivery/ordering/privacy behavior, and rerun Checkpoint C plus the authorized full verification bundle against only `smartlearning_test`.

## Acceptance criteria

- `truncateAll()` starts only after the publisher has stopped accepting wakes and its active drain/lease cleanup has completed.
- The publisher restarts with exactly one bus subscription, one poll timer, and a startup scan; repeated init/destroy calls are harmless.
- `live-session-realtime` exercises the real durable publisher during each test body; CP3 may remain permanently quiesced because it is HTTP-only.
- No fixed sleeps, deadlock retries, suite retries, broad timeout increases, disabled assertions, schema/migration changes, or outbox/gateway contract changes.
- The isolated realtime suite and exact seven-suite Checkpoint C matrix pass with zero failures/skips, no `40P01`, and no Jest open-handle warning.
- Only after the matrix is green, full E2E and supporting verification run successfully.

## Implementation

1. **Make the existing publisher lifecycle repeatable and idempotent** — `src/modules/realtime/live-session-publisher.ts`
   - Add an explicit active/started guard.
   - In `onModuleInit()`, no-op if already active; otherwise clear the stopped state, create exactly one event-bus subscription and poll timer, then preserve the startup `queueWake()` scan.
   - In `onModuleDestroy()`, mark inactive/stopped before removing wake sources, clear and unset subscription/timer handles, clear queued wakes, capture and await the active `drainPromise`, then release only this instance’s outstanding leases and reset the tracked count.
   - Preserve polling intervals, claim SQL, lease/retry policy, ordering, projections, and delivery semantics.

2. **Prove the lifecycle boundary deterministically** — `src/modules/realtime/live-session-publisher.spec.ts`
   - Add deferred-promise coverage showing shutdown remains pending until an in-flight batch/dispatch settles.
   - Verify restart after shutdown performs a real startup/wake cycle.
   - Verify duplicate init does not duplicate processing/timers/subscriptions.
   - Verify repeated destroy does not duplicate lease cleanup or throw.
   - Use fake timers/deferred promises rather than wall-clock sleeps.

3. **Add a test-only scoped cleanup helper** — `test/setup/app-factory.ts`
   - Add `withQuiescedLiveSessionPublisher(app, action)` using the exported `LiveSessionPublisher` provider.
   - `await publisher.onModuleDestroy()`, execute the callback, and restart with `publisher.onModuleInit()` in `finally` so cleanup failures propagate without leaving realtime disabled.
   - Keep `truncateAll()` generic and DB-focused; do not add Nest/realtime coupling or deadlock retries to `test/setup/db.ts`.

4. **Apply the boundary to the active realtime suite** — `test/live-session-realtime.e2e-spec.ts`
   - Wrap only the `truncateAll(prisma.prisma)` call in `beforeEach` with the scoped helper.
   - Bootstrap fixtures after the publisher has restarted.
   - Preserve the existing long-lived app, listener-before-mutation ordering, exact-state `counts.updated` predicates (`1/0`, then `1/1`), durable publisher assertions, and current timeouts.
   - Review socket cleanup paths; add a suite-level socket registry/`afterEach` cleanup only if implementation inspection confirms a socket can escape existing `try/finally` paths. Do not broaden scope otherwise.

5. **Retain HTTP-only CP3 behavior and record the lesson**
   - Leave `test/cp3-terminal-state.e2e-spec.ts` permanently stopping the publisher once after initialization unless a small shared stop helper materially improves clarity.
   - Update `tasks/lessons.md` with the failure mode, `40P01` detection signal, lifecycle-barrier prevention rule, and a deterministic lifecycle unit-test tripwire.
   - Update `tasks/todo.md` with implementation checkpoints, exact commands/results, database boundary, warnings, and final scope limitations.

## Verification

All DB-backed commands remain guarded by `NODE_ENV=test` and must resolve to database `smartlearning_test`; the previously authorized idempotent migration/truncation setup is allowed. Stop the line at the first required gate failure.

1. Focused publisher unit coverage:
   - `npm test -- --runInBand src/modules/realtime/live-session-publisher.spec.ts`
2. Isolated realtime E2E:
   - `NODE_ENV=test npm run test:e2e -- --runInBand --silent test/live-session-realtime.e2e-spec.ts`
3. Exact Checkpoint C matrix:
   - `NODE_ENV=test npm run test:e2e -- --runInBand --silent test/live-session-realtime.e2e-spec.ts test/live-session-close-cancel.e2e-spec.ts test/live-session-results.e2e-spec.ts test/archive-governance.e2e-spec.ts test/live-session-route-matrix.e2e-spec.ts test/cp3-terminal-state.e2e-spec.ts test/participant-account.e2e-spec.ts`
4. Only if Checkpoint C is green:
   - `NODE_ENV=test npm run test:e2e -- --runInBand --silent`
   - `NODE_ENV=test npm run test:integration -- --runInBand --silent`
   - `NODE_ENV=test npm run prisma:migrate:status`
   - `npm test -- --runInBand`
   - `npm run prisma:validate`
   - `npm run prisma:generate`
   - `node scripts/normalize-prisma-client.mjs generated/prisma`
   - `npm run typecheck`
   - `npm run lint:check`
   - `npm run format:check`
   - `npm run build`
   - `git diff --check`

Record suite/test/skip totals and specifically inspect for `40P01`, publisher retry/dispatch warnings, Jest open handles, Nest `LegacyRouteConverter`, and `pg client.query()` deprecation warnings. These checks prove local PostgreSQL-backed durable behavior; with `.env.test` using `REALTIME_REDIS_MODE=off`, they do not claim Redis adapter failover or cross-instance propagation.

## Risk and rollback

- **Risk: medium.** The production class lifecycle becomes restartable, but delivery algorithms and contracts remain unchanged; incorrect guards could duplicate subscriptions/timers or restart before a drain settles.
- **Mitigation:** explicit lifecycle state, deferred-promise unit tests, exact matrix gate, and full regression before completion.
- **Rollback:** revert lifecycle/helper/realtime-hook changes while retaining the already-correct CP3 one-time shutdown and Checkpoint C failure evidence. If repeatable lifecycle cannot be proven, use the heavier fallback of recreating/closing the realtime Nest app per test before truncation; never replace the fix with sleeps or retries.
