# BE-8.3 CP3 — CLI key rotation / successor plan

## Context

BE-8.3 extends the existing admin-managed CLI credential subsystem with safe key rotation. The binding CP0 contract in `docs/智學互動平台/50_實作與測試/BackendBE8/be-8-contract-freeze.md` supersedes older WBS wording:

- rotation succeeds by creating an active successor and immediately revoking the predecessor;
- there is no grace period;
- the raw successor key is returned once, while PostgreSQL stores only its SHA-256 hash;
- CP3 implements **no credential TTL/expiry field** (`valid until revoke`);
- a failed rotation must leave the predecessor usable and must not persist an orphan successor;
- batch validation/idempotency semantics remain credential-bound and unchanged.

This is a high-risk authentication change. Implementation must complete automated verification and then stop at **Manual Checkpoint 3**. CP4 must not begin until the user explicitly confirms CP3.

## Acceptance criteria

1. `POST /api/v1/admin/accounts/:id/cli-credentials/:credentialId/rotate` requires an authenticated admin Web session, valid CSRF/Origin, and recent step-up.
2. The request has no body. On success it returns HTTP 201 with successor metadata plus `rawKey` once.
3. The successor inherits the predecessor's logical name and scope, has a new UUID/hash, is active, and records its direct predecessor.
4. The predecessor row is retained, renamed to an internal archival name, and marked revoked in the same transaction; its old raw key immediately returns 401 `CLI_CREDENTIAL_REVOKED`.
5. Any transaction failure rolls back the predecessor rename/revocation and successor insert together.
6. Repeating or concurrently rotating the same predecessor creates at most one successor; the losing request returns 409 `CONFLICT` without a raw key.
7. Account disable remains authoritative: after disable, no predecessor/successor is active; restore revives none. `canCreateCourse=false` remains unrelated to credential validity.
8. A predecessor-issued validation token is not migrated: predecessor cannot authenticate after rotation, successor cannot confirm that token, and successor must validate again. Existing idempotency rows/scopes are unchanged.
9. No response, list projection, error, log, OpenAPI example, or DB column exposes/stores a raw key; no CLI expiry/grace/pending-verification fields are introduced.

## Recommended implementation

### 1. Track CP3 and freeze its executable contract

Update `smartLearning-backend/tasks/todo.md` before code changes with:

- the acceptance criteria above;
- risk level: high (authentication/credential lifecycle);
- dependencies/environment: Node 24+, PostgreSQL test target exactly `smartlearning_test`, authorized setup migration/truncate boundary from CP0;
- rollback and stop conditions;
- separate automated-verification and Manual Checkpoint 3 sections.

Create `docs/智學互動平台/50_實作與測試/BackendBE8/be-8-3-cp3-cli-key-rotation.md` to reconcile the stale WBS expiry wording with the CP0 freeze and document the endpoint, immediate invalidation, lineage, race outcomes, token behavior, and deferred scope.

### 2. Add minimal successor lineage schema

Modify `smartLearning-backend/prisma/schema.prisma` and add one hand-written additive migration under `prisma/migrations/`:

- add nullable `rotatedFromId UUID` (`rotated_from_id`) to `CliCredential`;
- add a named self-relation from successor to predecessor using `ON DELETE SET NULL`;
- add a unique index on `rotated_from_id`, enforcing at most one direct successor per credential;
- retain the existing `active | revoked` status CHECK and `(accountId, name)` uniqueness;
- add no `expiresAt`, TTL, grace, pending state, version counter, or destructive/down migration.

Use the existing UUID v7 application generator (`newId`) and Prisma normalization/generation workflow already required by the project.

### 3. Resolve logical-name uniqueness without broad schema redesign

Because the predecessor row is retained and `(accountId, name)` is unique:

- preserve the original name as the active credential's logical name;
- in the rotation transaction, rename the predecessor to a deterministic internal archival name such as `${originalName.slice(0, 18)}~rotated~${predecessorId}` (maximum 63 characters);
- create the successor with the predecessor's original name;
- expose `rotatedFromId` so clients do not infer lineage from the archival name.

This avoids removing the uniqueness invariant, introducing duplicate visible names, requiring a caller-selected successor name, or adding a separate credential-family abstraction in CP3.

### 4. Extend DTO and projection boundaries

Modify:

- `src/modules/identity/api/dto/cli-credential.dto.ts`
- `src/modules/identity/api/admin.controller.ts`

Changes:

- add nullable `rotatedFromId` to `CliCredentialDto` and `toCliCredentialDto()`;
- add `RotateCliCredentialResponseDto extends CliCredentialDto` with the existing secret field name `rawKey`;
- keep `keyHash` excluded by `CliCredentialProjection` and explicit projection mapping;
- retain `rawKey` as the property name so existing Pino redaction paths apply;
- document that list responses include lineage metadata but never raw keys or hashes.

### 5. Implement the atomic service operation

Add `CliCredentialService.rotateCredential(accountId, credentialId)` in `src/modules/identity/application/cli-credential.service.ts`, reusing:

- `TransactionService.run()`;
- `TransactionService.lockAccountForUpdate()`;
- `generateToken()`, `hashToken()`, and `newId()`;
- existing `AccountStatus` / `CliCredentialStatus` constants;
- existing `NotFoundError`, `ForbiddenError`, and `ConflictError` contracts.

Transaction sequence:

1. Generate/hash the successor secret without logging it (generation may occur immediately before the transaction to minimize lock duration).
2. Begin transaction and lock the account row.
3. Re-read account; missing → 404 `NOT_FOUND` (`id`), inactive → 403 `FORBIDDEN`.
4. Read predecessor by ID and verify ownership; missing/cross-account → existence-safe 404 `NOT_FOUND` (`credentialId`).
5. Require active predecessor; already revoked/rotated → 409 `CONFLICT` (`credentialId`).
6. Capture original name/scope and one shared `now` timestamp.
7. Rename and revoke predecessor.
8. Insert active successor with new UUID/hash, original logical name/scope, and `rotatedFromId = predecessor.id`.
9. Omit `keyHash` from the returned projection.
10. Commit, then return successor metadata plus the one-time raw key.

Both mutations must stay in one transaction. No test-only failure hook should be added to production code.

### 6. Add the admin rotation route

In `src/modules/identity/api/admin.controller.ts`, add:

- `POST accounts/:id/cli-credentials/:credentialId/rotate`;
- `ParseUUIDPipe` on both IDs;
- method-level `StepUpGuard` in addition to existing class-level `SessionGuard`, `CsrfGuard`, and `AdminGuard`;
- no request body;
- default HTTP 201 response containing `RotateCliCredentialResponseDto`.

Keep rotation admin-only. Do not add teacher self-service or CLI-authenticated credential-management routes.

### 7. Preserve validation-token and idempotency boundaries

Do not update `QuestionValidationToken` or `QuestionBatchIdempotency` during rotation:

- predecessor-issued tokens retain their predecessor `cliCredentialId`;
- predecessor auth fails after commit;
- successor confirm with a predecessor token fails existing credential-binding validation;
- successor must call validate again;
- committed predecessor-scoped idempotency records remain unchanged and are not transferred to the successor.

Add regression coverage rather than changing `QuestionBatchService` unless testing reveals a genuine mismatch with this existing contract.

### 8. Secret-handling and documentation updates

- Extend `src/common/observability/pino-redaction.spec.ts` to exercise both `res.body.rawKey` and enveloped `res.body.data.rawKey`; do not add a differently named successor secret field.
- Extend `test/openapi.e2e-spec.ts` for the rotate route, `rotatedFromId`, one-time `rawKey`, and the absence of `keyHash`/TTL/grace/pending fields.
- Update `docs/frontend-api-reference.md` with the route, guards, status/error semantics, immediate invalidation, one-time secret warning, lineage, and required re-validation after rotation.

## Automated test plan

### Focused service/unit coverage

Add `src/modules/identity/application/cli-credential.service.spec.ts` using the existing transaction-client mock style:

- successful rotate acquires account lock and performs one predecessor update plus one successor insert;
- persistence receives only a hash and the result excludes `keyHash`;
- missing/cross-account/inactive/revoked cases perform no successor write;
- successor-create failure causes the transaction to reject and does not return the raw key;
- no unrelated session revocation, validation-token mutation, or lifecycle publication occurs;
- no expiry logic is introduced.

The DB-backed E2E test remains the authority for real rollback and concurrency behavior; unit mocks provide deterministic branch/failure coverage.

### CLI credential E2E coverage

Extend `test/cli-credential.e2e-spec.ts` (or split a dedicated rotation suite only if the existing file becomes unwieldy), preserving `setupTestDb()`, fail-loud DB guards, and `withQuiescedLiveSessionPublisher()` around destructive cleanup:

- predecessor works before rotation; successor works after; predecessor immediately returns 401;
- successor has a new ID/hash, original logical name/scope, and correct `rotatedFromId`;
- predecessor remains as revoked with archival name;
- list returns metadata only;
- no step-up, non-admin, invalid CSRF/Origin, malformed IDs, missing/cross-account credential, disabled account, and already-revoked cases;
- repeated rotation: first 201, second 409, one successor only;
- multi-generation A → B → C lineage;
- concurrent same-predecessor rotation: one 201, one 409;
- rotate/revoke race accepts only the two account-lock serialization outcomes;
- rotate/disable race ends with zero active credentials and restore revives none;
- `canCreateCourse=false` does not revoke the active successor.

### Batch regression

Extend the relevant CLI/batch E2E coverage:

1. validate with predecessor;
2. rotate;
3. predecessor confirm fails authentication;
4. successor confirm with old token fails validation-token binding;
5. successor re-validates and confirms successfully;
6. replay with the same successor idempotency key returns the existing result with no duplicate write;
7. existing predecessor idempotency rows remain unchanged.

### Real failure atomicity

Prefer a deterministic DB constraint/transaction test if one can be induced through the service without production failure hooks. The required invariant is:

- a failure after the predecessor update but before commit leaves the persisted predecessor active with its original name and persists no successor.

If no clean real-DB injection exists, retain deterministic unit rollback coverage plus the migration constraints and concurrent E2E evidence; record the limitation explicitly rather than adding unsafe test-only runtime behavior.

## Verification sequence

Run verbose suites through a dedicated test subagent, targeted first and then broaden:

1. Format new/changed TypeScript before lint.
2. `npm run prisma:generate`
3. `npm run prisma:validate`
4. Targeted service and redaction unit tests.
5. Targeted CLI credential, question-batch, account-admin, and OpenAPI E2E suites against guarded `smartlearning_test`.
6. Full verification bundle:
   - `npm test -- --runInBand`
   - `NODE_ENV=test npm run test:e2e -- --runInBand`
   - `NODE_ENV=test npm run test:integration -- --runInBand`
   - `npm run typecheck`
   - `npm run lint:check`
   - `npm run format:check`
   - `npm run build`
   - `NODE_ENV=test npm run prisma:migrate:status`
   - `git diff --check`

DB-backed suites must fail/block loudly if the target is not exactly `smartlearning_test`; no skipped DB suite is accepted. Use only the already authorized setup migration/truncate boundary—never `migrate reset`, `db push`, development DB cleanup, destructive down migration, or direct reactivation of revoked keys.

## Risk and rollback

- **Risk:** high — authentication lifecycle, additive schema, concurrency, and one-time secret handling.
- **Mitigations:** account `FOR UPDATE` lock, one transaction, unique direct-successor index, hash-only persistence, existing Web/CSRF/admin/step-up guard stack, explicit race and leakage tests.
- **Application rollback:** revert route/service/DTO behavior while retaining the nullable lineage column/index.
- **Database rollback:** forward-only; do not remove the additive column or restore revoked predecessors. Already committed rotations remain predecessor-revoked/successor-active; administrators can revoke successors through the existing endpoint.
- **Monitoring signals:** unexpected 5xx/conflicts on rotate, any raw-key redaction failure, more than one direct successor, disabled accounts with active credentials, or DB deadlocks/skipped suites.

## Manual Checkpoint 3 — mandatory stop

After all automated checks pass:

1. Add `test/manual-cp3-verify.e2e-spec.ts`, following `test/manual-cp2-verify.e2e-spec.ts`:
   - guarded `smartlearning_test` only;
   - publisher quiesced for cleanup;
   - one auditable scenario with direct DB row inspection;
   - raw keys used only in-memory and never printed or written to durable evidence.
2. Do **not** run this manual checkpoint automatically as part of the normal implementation bundle.
3. Present the user with the explicit command:
   `NODE_ENV=test npm run test:e2e -- --runInBand test/manual-cp3-verify.e2e-spec.ts`
4. Have the user manually decide based on these expected observations:
   - predecessor succeeds before rotation;
   - rotate returns 201 and a one-time raw successor key;
   - predecessor immediately returns 401 `CLI_CREDENTIAL_REVOKED`;
   - successor succeeds;
   - DB retains revoked predecessor and active linked successor with hashes only;
   - list/errors/log capture expose neither raw key nor hash;
   - predecessor validation token is not reusable by successor;
   - repeated/concurrent rotation creates one successor only;
   - no TTL/grace/pending-verification field exists.
5. Record the result in `tasks/todo.md` only after the user explicitly confirms it.
6. Stop the session and suggest opening a new session for CP4; do not continue automatically.

## Critical files

- `../docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md` — source checkpoint (read/reconciliation only unless documentation correction is explicitly included)
- `../docs/智學互動平台/50_實作與測試/BackendBE8/be-8-contract-freeze.md` — binding CP0 contract
- `prisma/schema.prisma`
- `prisma/migrations/<new_additive_rotation_lineage>/migration.sql`
- `src/modules/identity/application/cli-credential.service.ts`
- `src/modules/identity/application/cli-credential.service.spec.ts`
- `src/modules/identity/api/dto/cli-credential.dto.ts`
- `src/modules/identity/api/admin.controller.ts`
- `src/common/observability/pino-redaction.spec.ts`
- `test/cli-credential.e2e-spec.ts`
- `test/question-batches.e2e-spec.ts`
- `test/account-admin.e2e-spec.ts`
- `test/openapi.e2e-spec.ts`
- `test/manual-cp3-verify.e2e-spec.ts`
- `docs/frontend-api-reference.md`
- `tasks/todo.md`
- `../docs/智學互動平台/50_實作與測試/BackendBE8/be-8-3-cp3-cli-key-rotation.md`
