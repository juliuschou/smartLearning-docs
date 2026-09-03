# BE-8.9 CP9 — Final Release Evidence

## 1. Release identity and scope

- **CP9 rerun baseline UTC:** `2026-09-01T16:28:14Z`
- **Final gate/status recapture UTC:** `2026-09-01T17:26:39Z`
- **Branch:** `main`
- **HEAD:** `37bcbe02312f1e44b3bf458f201b929b82f5a2ef` (`37bcbe0`)
- **Working tree at rerun:** source/test adapter fix plus existing `tasks/lessons.md` and `tasks/todo.md` edits; no commit or reset was performed.
- **Working tree after rerun:** same intended source/test/docs changes in the backend repository; this evidence packet is stored in the parent documentation tree, outside the backend Git repository.
- **Node:** `v26.5.1`
- **npm:** `11.17.0`
- **Prisma CLI/client:** `7.9.1`
- **Evidence scope:** BE-8.1 through BE-8.10 release reconciliation. No WBS completion checkbox is changed by this packet.

This packet records the CP9 rerun against HEAD `37bcbe0` with the reviewed adapter lifecycle fix present in the working tree. Required current-HEAD checks are green except separately unauthorized real-Redis proof; it is not a release approval.

## 2. Sanitized environment and authorization

### Test database

- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `smartlearning_test`
- **Migration status:** up to date
- **Migration count:** 15

The target was parsed from `.env.test` without retaining credentials or the complete connection URL. The user authorized DB-backed verification only for `NODE_ENV=test` and exactly `smartlearning_test`, including the guarded test setup's idempotent `npx prisma migrate deploy` and non-migration-table `TRUNCATE ... RESTART IDENTITY CASCADE` boundary.

The CP9 rerun reached the authorized DB-backed suites and used only `smartlearning_test`; no development or production database was used. The guarded setup performed only its documented idempotent migration/truncation behavior.

### Explicitly outside this authorization

- `smartlearning_dev` and production databases
- `migrate reset`, `db push`, arbitrary SQL cleanup, or credential restoration
- volume deletion
- Compose/Redis runtime drills and service disruption
- real-Redis integration without separate disposable Redis authorization

No passwords, complete URLs, cookies, session/CSRF/participant/CLI tokens, Redis keys, hashes, answer content, or raw credentials are retained here.

## 3. Classification rules

Each matrix row uses exactly one permitted classification:

- `runtime verified`
- `contract decision confirmed`
- `BLOCKED (reason; dependency)`

`runtime verified` identifies signed executable evidence applicable to the release HEAD after reviewing the intervening scope. The rerun command inventory is complete for the authorized DB-free, test-DB, and manual checks. `BLOCKED` is used for proof not run because it requires separate authorization or runtime infrastructure. There is no “partial pass” status.

## 4. BE-8.1–BE-8.10 evidence matrix

| Item | Frozen behavior / contract | Implementation and evidence paths | Evidence commit(s) | Classification | Manual checkpoint record | Open limitation / CP9 note |
| --- | --- | --- | --- | --- | --- | --- |
| BE-8.1 | `/auth/session` returns real UTC `expiresAt`; absent session remains 401. | `src/common/auth/session.service.ts`; `test/auth-session-expiry.e2e-spec.ts`; CP1 evidence document. | `6131140` | `runtime verified` | CP1 verified 2026-08-30; explicit record at `be-8-1-cp1-session-expiry.md:169`. | Fresh CP9 E2E passed in the rerun: 32 suites / 219 tests. |
| BE-8.2 | Expired sessions use `AUTH_SESSION_EXPIRED`; missing, malformed, revoked, and disabled auth use `UNAUTHORIZED`. | `src/common/errors/domain-error.ts`; `src/common/errors/error-codes.ts`; session unit/E2E specs. | `6131140` | `runtime verified` | CP1 verified 2026-08-30. | Fresh CP9 E2E passed in the rerun: 32 suites / 219 tests. |
| BE-8.3 | Admin account update allowlist and must-change-password gate preserve authorization and disclosure boundaries. | `src/modules/identity/application/account.service.ts`; `test/account-admin.e2e-spec.ts`; `test/manual-cp2-verify.e2e-spec.ts`. | `1f48655`, `e0b53ba` | `runtime verified` | CP2 verified 2026-08-30. | Historical targeted/full evidence remains the available executable proof; current CP9 E2E and selected integration rerun passed. |
| BE-8.4 | CLI credential rotation creates one active successor, immediately revokes the predecessor, and persists only hashes. | `src/modules/identity/application/cli-credential.service.ts`; `test/cli-credential.e2e-spec.ts`; `test/manual-cp3-verify.e2e-spec.ts`; additive Prisma migration. | `4d906e0` | `runtime verified` | CP3 verified 2026-08-30. | Current-HEAD E2E rerun passed; no raw key or hash is retained. |
| BE-8.5 | CLI-owned course list/create routes preserve ownership and Web behavior. | `src/modules/courses/api/courses.controller.ts`; `src/modules/courses/application/course.service.ts`; `test/cli-courses.e2e-spec.ts`. | `36be9bb`, `0261327` | `runtime verified` | CP4 verified 2026-08-31. | Historical restored-DB targeted evidence is cited; current CP9 E2E rerun passed. |
| BE-8.6 | CLI/batch fixed-window limits are credential-scoped, isolated, and expire with stable 429 responses. | `src/modules/rate-limit/operation-rate-limiter.service.ts`; `test/cli-batch-rate-limit.e2e-spec.ts`; `test/question-batches.e2e-spec.ts`. | `36be9bb`, `0261327` | `runtime verified` | CP4 verified 2026-08-31. | The historical local full-suite deferral was superseded by later full-E2E evidence; current CP9 E2E rerun passed. |
| BE-8.7 | Redis-backed account/source login limits share state across instances, fail closed on outage, and use opaque keys. | `src/modules/rate-limit/redis-login-rate-limit.store.ts`; `test/login-rate-limit.redis.integration-spec.ts`; CP5 two-instance verifier. | `7403f45`, `5c71f6f`, `56b67dc` | `BLOCKED (current-head Redis proof not rerun; depends on separately authorized Redis/Compose verification)` | CP5 verified 2026-08-31. | Historical Redis evidence was 1 suite/6 tests and the two-instance evidence was 1 suite/4 tests; neither is current-HEAD output. No Redis runtime authorization was included in CP9. |
| BE-8.8 | Sensitive fields and exception/OpenAPI output do not disclose credentials, tokens, hashes, or payload content. | `src/common/observability/pino-redaction.ts`; `test/manual-cp6-verify.e2e-spec.ts`; CP6 review document. | `1e7e052` | `runtime verified` | CP6 verified 2026-09-01. | Current CP6 generator passed in the rerun: 1 suite / 1 test, with sanitized disclosure evidence. |
| BE-8.9 | Raw low-cardinality `/metrics`, semantic instrumentation, alert/dashboard handoff, and readiness semantics. | `src/modules/metrics/*`; `ops/observability/*`; `test/metrics.e2e-spec.ts`; `test/manual-cp7-verify.e2e-spec.ts`. | `1e7e052` | `runtime verified` | CP7 verified 2026-09-01. | Current CP7 generator passed in the rerun: 1 suite / 1 test. Prometheus/Grafana deployment and tuning remain OPS-owned; `promtool` was historically unavailable. |
| BE-8.10 | Nginx/TLS proxy compatibility, trusted forwarded headers, secure cookies/CSRF, Socket.IO upgrade, Redis adapter, and shutdown behavior. | `docker-compose.cp8.yml`; `ops/topology/nginx.conf`; `ops/topology/README.md`; `test/cp8-topology.spec.ts`; `src/modules/realtime/realtime-redis.service.ts`. | `37bcbe0` plus current working-tree fix | `BLOCKED (current-head CP8 Compose runtime not rerun; depends on separately authorized topology verification)` | CP8 verified 2026-09-01. | Adapter lifecycle regression and rapid unsubscribe/recovery race are fixed in source and covered by unit tests; CP8 static/unit evidence passed after the fix. Readiness recovered only after API restart, not automatically within 30 seconds; no production Nginx/Next or W1–W8 certification. |

## 5. CP9 command ledger

The prior CP9 attempt stopped at the unit regression. After the focused fix and regression coverage, the complete authorized current-HEAD inventory ran to completion. `—` is retained only for the separately unauthorized real-Redis proof.

| Command | Exit | Process / counts | Result and sanitized evidence |
| --- | ---: | --- | --- |
| `git diff --check` (baseline/final) | 0 | normal | PASS; no whitespace errors. |
| `NODE_ENV=test npm run prisma:migrate:status` (baseline/final) | 0 | normal | PASS; exact `smartlearning_test` at `localhost:5432`, 15 migrations, schema up to date; read-only. |
| `npm run prisma:validate` | 0 | normal | PASS; Prisma schema valid. |
| `npm test -- --runInBand src/modules/realtime/realtime-redis.service.spec.ts` | 0 | 1 suite, 3 tests; 0 failed, 0 skipped | PASS; synchronous close, async shutdown drain, and close-failure isolation covered. |
| `npm test -- --runInBand` | 0 | 49 suites, 293 tests; 0 failed, 0 skipped | PASS; full unit regression. |
| `npm run test:cp8:static -- --runInBand` | 0 | 1 suite, 3 tests; 0 failed, 0 skipped | PASS; CP8 topology contract. |
| `NODE_ENV=test npm run test:e2e -- --runInBand` | 0 | 32 suites, 219 tests; 0 failed, 0 skipped | PASS; normal teardown and no open-handle warning. |
| `NODE_ENV=test npm run test:integration -- --runInBand --testPathIgnorePatterns=login-rate-limit.redis.integration-spec.ts` | 0 | 3 suites, 16 tests; 0 failed, 0 skipped | PASS; real-Redis integration explicitly excluded. |
| `NODE_ENV=test npm run test:cp6:manual -- --runInBand` | 0 | 1 suite, 1 test; 0 failed, 0 skipped | PASS; sanitized disclosure/redaction evidence generated. |
| `NODE_ENV=test npm run test:cp7:manual -- --runInBand` | 0 | 1 suite, 1 test; 0 failed, 0 skipped | PASS; sanitized metrics/readiness/alert evidence generated. |
| `npm run typecheck` | 0 | normal | PASS; no TypeScript errors. |
| `npm run lint:check` | 0 | normal | PASS; no ESLint findings. |
| `npm run format:check` | 0 | normal | PASS; all checked files formatted. |
| `npm run build` | 0 | normal | PASS; NestJS build completed. |
| `NODE_ENV=test RUN_LOGIN_RATE_LIMIT_REDIS_TESTS=1 LOGIN_RATE_LIMIT_TEST_REDIS_URL=<authorized endpoint> npm run test:login-rate-limit:redis -- --runInBand` | — | not run | `BLOCKED (real Redis not separately authorized; depends on disposable/test Redis)`. |

The adapter fix is intentionally uncommitted in this working tree: `closeAdapter()` now invokes cleanup synchronously, uses shared `errorType()` classification, tracks asynchronous completion/rejection for graceful shutdown, and reuses the Redis adapter across availability-only failover so unsubscribe cleanup cannot race a new subscription. No schema, migration, runtime configuration, Redis, or Compose source changes were made.

## 6. Reconciliation of historical checkpoint evidence

- **CP0:** explicit confirmation recorded 2026-08-30 in the backend task ledger.
- **CP1:** the former stale pending line in `tasks/todo.md` was reconciled from the explicit user confirmation recorded at `be-8-1-cp1-session-expiry.md:169`; CP1 is recorded as complete without inventing a new confirmation.
- **CP2:** explicit confirmation recorded 2026-08-30.
- **CP3:** explicit confirmation recorded 2026-08-30; predecessor/successor, hash-only persistence, and one-successor race evidence were reviewed.
- **CP4:** explicit confirmation recorded 2026-08-31. The earlier local full-suite deferral is retained in the ledger; the later restored-DB targeted evidence and subsequent full guarded E2E evidence superseded that regression gap.
- **CP5:** explicit confirmation recorded 2026-08-31. Real Redis and two-instance results are historical and separate from this CP9 run.
- **CP6:** explicit confirmation recorded 2026-09-01. The current CP6 manual generator passed in the CP9 rerun (1 suite / 1 test).
- **CP7:** explicit confirmation recorded 2026-09-01. The current CP7 manual generator passed in the CP9 rerun (1 suite / 1 test).
- **CP8:** explicit confirmation recorded 2026-09-01. Required realtime Redis readiness recovered only after both API instances were restarted; automatic existing-process recovery within 30 seconds remains an open follow-up.

## 7. Known limitations and ownership

1. The CP8 topology is verification-only. It does not certify production Nginx/Next.js deployment, production TLS operations, or browser compatibility.
2. OPS-2 W1–W8 load/capacity certification is not part of BE-8.
3. Prometheus/Grafana deployment, scrape ACLs, threshold tuning, routing, retention, and incident response remain OPS-owned.
4. Durable replay must not be inferred from snapshot/reconnect evidence; unsupported replay claims remain `DEFERRED/BLOCKED`.
5. CP5 Redis evidence is historical until a separately authorized current-HEAD Redis/Compose run is completed.
6. The CP8 Redis automatic-recovery limitation remains open: readiness recovered after API restart, not automatically within 30 seconds.

## 8. Risk, rollback, and required next action

- **Risk:** high. The release packet covers authentication/session contracts, credential lifecycle, abuse controls, disclosure, metrics, realtime, proxy, and shutdown behavior.
- **Rollback:** discard only the CP9 documentation edits. Do not clear databases or Redis, restore revoked credentials, delete volumes, or use destructive migration rollback.
- **Required next action:** obtain separate authorization for real-Redis and CP8 Compose runtime evidence, then rerun those excluded proofs if required for BE-8 closure. Keep WBS CP9 checkboxes unchanged until explicit final sign-off.

## 9. Final approval state

# BLOCKED — PENDING MANUAL FINAL SIGN-OFF

The authorized CP9 rerun is complete with zero failures/skips across all executed checks. BE-8 remains pending because real-Redis/Compose runtime proof was not separately authorized and manual final approval is still required. Do not update the WBS CP9 checkboxes until the user explicitly approves the final matrix.
