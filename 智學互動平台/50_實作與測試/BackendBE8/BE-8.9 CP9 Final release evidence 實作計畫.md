# BE-8.9 CP9 — Final Release Evidence Plan

## Context

CP0–CP8 are implemented and mostly have explicit manual checkpoint records, but BE-8 cannot be closed yet because the WBS requires one coherent CP9 release-evidence packet tied to the release HEAD. CP9 must reconcile stale checkpoint documentation, map BE-8.1–BE-8.10 to concrete evidence, run current-HEAD verification with zero failures/skips, preserve known limitations, and stop for a distinct human final sign-off. This is an evidence/documentation slice; production code, schema, migrations, and runtime behavior should not change unless verification discovers a separately handled release blocker.

Authoritative criteria: `../docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md:492-499`.

## Success Criteria

- A BE-8.1–BE-8.10 matrix classifies every item exactly as `runtime verified`, `BLOCKED (reason; dependency)`, or `contract decision confirmed` and links implementation, automated evidence, evidence commit, and manual status.
- The authoritative current-HEAD run records branch, full HEAD, tree state, Node/npm/Prisma versions, sanitized DB target, migration status, and exact suite/test/failure/skip counts.
- Required DB-backed evidence has zero failures and zero skipped tests; Redis evidence is accounted for separately rather than silently excluded.
- `typecheck`, `lint:check`, `format:check`, `build`, `git diff --check`, and read-only test-DB migration status pass.
- CP1’s stale pending line is reconciled without inventing a manual confirmation.
- CP8’s unproven automatic Redis recovery remains an explicit follow-up.
- Evidence remains `PENDING MANUAL FINAL SIGN-OFF` until the user explicitly approves it; WBS closure happens only afterward.

## Checkpoint A — Baseline and Authorization

1. Read the relevant BE-8 commit bodies and existing CP0–CP8 evidence documents before editing.
2. Record UTC timestamp, branch, full/short HEAD, clean/dirty tree, `git diff --check`, and Node/npm/Prisma versions. Use the actual execution HEAD, not the planning snapshot (`37bcbe0`).
3. Confirm the authoritative run has an unambiguous baseline. Documentation-only preparation may be listed separately, but no product-code drift is allowed during evidence generation.
4. Before any DB-backed suite, obtain explicit authorization for `NODE_ENV=test` against database **exactly** `smartlearning_test`, including `test/setup/db.ts`’s implicit idempotent `prisma migrate deploy` and truncation of non-migration tables.
5. The authorization excludes `smartlearning_dev`, production databases, `migrate reset`, `db push`, schema/migration changes, arbitrary SQL cleanup, credential restoration, and volume deletion.
6. Before any Compose/Redis runtime drill, obtain separate authorization for the named isolated resources, temporary process-only credentials, service disruption, scoped cleanup, and migration target.
7. Parse and record only sanitized DB host/port/name; run read-only `NODE_ENV=test npm run prisma:migrate:status`. Stop if the target is wrong/unclear, unreachable, pending/diverged, or not `smartlearning_test`.

**Risk:** high for test infrastructure because suites migrate/truncate.  
**Rollback:** stop execution and discard only CP9 documentation edits; never restore DB rows or revoked credentials manually.

## Checkpoint B — Build the Evidence Matrix

Create `../docs/智學互動平台/50_實作與測試/BackendBE8/BE-8.9 CP9 Final release evidence.md` with:

- immutable execution metadata and sanitized environment targets;
- one row for each BE-8.1–BE-8.10 item;
- frozen behavior/contract, implementation paths, automated/runtime evidence, evidence commit, permitted status, manual checkpoint record/date, and open limitation;
- an exact command ledger with suite/test/pass/fail/skip counts and normal/nonzero exit status;
- blockers, stop conditions, risk/rollback, and final approval state.

Classification rules:

- `runtime verified` only for executable evidence applicable to the release commit;
- `contract decision confirmed` only for intentionally contractual decisions;
- `BLOCKED (reason; dependency)` for unavailable required proof—never “partial pass”;
- distinguish historical evidence from fresh CP9 execution in the evidence text;
- do not infer manual approval from green tests or commit presence.

Reconciliation requirements:

- CP0 and CP2–CP8: cite their explicit recorded confirmations.
- CP1: compare `tasks/todo.md:2183` with `be-8-1-cp1-session-expiry.md`; if no explicit user confirmation is traceable, leave manual CP1 blocked pending user review.
- CP4: note the historical local full-suite deferral and the later full-E2E evidence that supersedes regression coverage.
- CP5/CP7: account for real Redis separately from non-Redis integration.
- CP8: retain “readiness recovered after API restart”; do **not** claim existing-process automatic Redis recovery within 30 seconds.
- Keep BE/OPS ownership clear: no claim of production Nginx/Next deployment, W1–W8 capacity certification, or full production monitoring deployment.

## Checkpoint C — Current-HEAD Verification

Run verbose test/build commands through a dedicated test subagent and retain only the required structured report and minimal sanitized failure evidence.

### DB-free/static checks

```bash
npm run prisma:validate
npm test -- --runInBand
npm run test:cp8:static -- --runInBand
```

Require normal exit, zero failures, and zero skipped tests.

### Authorized DB-backed checks

```bash
NODE_ENV=test npm run test:e2e -- --runInBand
NODE_ENV=test npm run test:integration -- --runInBand \
  --testPathIgnorePatterns=login-rate-limit.redis.integration-spec.ts
```

Require exact `smartlearning_test`, normal process exit, zero failures/skips, and no teardown/open-handle failure. Record implicit migration/truncation behavior.

### Authorized real-Redis integration

Use a disposable/test-only Redis endpoint with scoped cleanup:

```bash
NODE_ENV=test \
RUN_LOGIN_RATE_LIMIT_REDIS_TESTS=1 \
LOGIN_RATE_LIMIT_TEST_REDIS_URL=<sanitized-test-redis-url> \
npm run test:login-rate-limit:redis -- --runInBand
```

Require zero failures/skips. If unavailable, classify it as `BLOCKED (real Redis unavailable; depends on authorized test Redis)` rather than merging it into the non-Redis pass.

### Current-HEAD evidence generators

```bash
NODE_ENV=test npm run test:cp6:manual -- --runInBand
NODE_ENV=test npm run test:cp7:manual -- --runInBand
```

These regenerate sanitized disclosure/metrics evidence but do not replace human approval.

### CP5 two-instance runtime proof

Reuse the existing isolated CP5 Compose verifier only under separate explicit authorization. Use a unique project, Compose-owned PostgreSQL/Redis, process-only credentials, prefix-scoped Redis cleanup, and no volume deletion. If not rerun, cite the signed historical CP5 evidence and label it as historical rather than current-HEAD runtime output.

### Failure handling

On any failure, skip, wrong target, teardown error, secret disclosure, pending migration, or proxy/Redis ambiguity:

1. stop broader verification;
2. record exact command/exit code, failing suite/test, expected vs. actual, first actionable location/error, and sanitized dependency status;
3. mark the affected row `BLOCKED`;
4. handle any required code fix as a separately reviewed change, then rerun the entire CP9 inventory from a new baseline.

Never retain passwords, complete URLs, cookies, session/CSRF/participant/CLI tokens, Redis keys, hashes, answer content, or raw credentials in evidence.

## Checkpoint D — Final Quality Gates and Evidence Draft

After behavioral checks, run:

```bash
npm run typecheck
npm run lint:check
npm run format:check
npm run build
git diff --check
NODE_ENV=test npm run prisma:migrate:status
```

Then recapture branch, HEAD, and tree state. All commands must exit zero; lint/format remain check-only. Any product/source/test/config/schema change invalidates earlier evidence and requires a complete rerun.

Update:

- `tasks/todo.md` — append a dated CP9 section with acceptance criteria, authorization boundary, working notes, exact results, limitations, risk/rollback, and `PENDING MANUAL FINAL SIGN-OFF`;
- the new CP9 evidence document — complete matrix and execution ledger;
- CP1 stale wording only to accurately reflect the evidence; do not self-mark manual approval.

Leave `智學互動平台剩餘工作WBS.md` CP9 checkboxes unchanged at this stage. Review the diff to ensure it contains evidence/documentation only.

## Checkpoint E — Mandatory Human Final Sign-off

Present the matrix and sanitized results. Existing explicit CP0 and CP2–CP8 confirmations may be cited; request explicit confirmation for any missing checkpoint, especially CP1, plus the final BE-8 evidence approval. Automation cannot substitute for this step.

Stop with status `PENDING MANUAL FINAL SIGN-OFF`. Do not claim BE-8 complete and do not update WBS completion until the user responds explicitly.

## Checkpoint F — Post-sign-off Closure

Only after explicit approval:

1. update the CP9 evidence document with exact confirmation text/date;
2. update `tasks/todo.md` with final status and reconcile CP1 accurately;
3. check WBS CP9 items at `智學互動平台剩餘工作WBS.md:494-497` only where their criteria are actually met;
4. preserve the CP8 Redis automatic-recovery follow-up as open;
5. run documentation-safe closure checks:

```bash
git diff --check
git status --short --branch
git diff --stat
```

Review the complete diff. CP9 closure must contain no production/schema/runtime changes.

## Critical Files

- `AGENTS.md` — manual checkpoint and DB authorization boundary.
- `test/setup/db.ts` — guarded implicit migrate/truncate behavior to disclose.
- `package.json` and `test/jest-*.json` — authoritative verification entrypoints and manual-suite exclusions.
- `tasks/todo.md` — central execution ledger and stale CP1 status.
- `tasks/lessons.md` — CP5/CP8/runtime test tripwires.
- `../docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md` — acceptance and eventual closure.
- `../docs/智學互動平台/50_實作與測試/BackendBE8/BE-8.9 CP9 Final release evidence.md` — new release packet.
- `ops/topology/README.md` and `ops/observability/README.md` — BE/OPS ownership and limitation boundaries.
