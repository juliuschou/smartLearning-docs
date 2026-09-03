# BE-8.3 CP3 — CLI key rotation / successor

## Scope and binding decisions

This slice implements the CP0-frozen CLI credential rotation contract. The CP0 freeze in `be-8-contract-freeze.md` supersedes older WBS wording that proposed CLI expiry: CP3 has no credential TTL or expiry field. A credential remains valid until revoked or its account is disabled.

Rotation is an immediate replacement, not a grace-period flow:

- an authenticated admin Web session performs the operation with CSRF/exact Origin and recent step-up;
- the active predecessor is retained for audit, renamed to an internal archival name, and revoked;
- one active successor is inserted in the same transaction;
- the successor inherits the predecessor's logical name and scope and records `rotatedFromId`;
- the raw successor key is returned once and only its SHA-256 hash is stored in PostgreSQL;
- a failed transaction leaves the predecessor active and does not leave an orphan successor;
- concurrent requests for one predecessor serialize on the account row; at most one direct successor can exist.

## Endpoint

```text
POST /api/v1/admin/accounts/:id/cli-credentials/:credentialId/rotate
```

The route has the admin controller's `SessionGuard`, `CsrfGuard`, and `AdminGuard`, plus method-level `StepUpGuard`. Both path parameters are UUID-validated. The request has no body consumed by the operation. Success is HTTP 201 and is wrapped in the normal API envelope:

```json
{
  "data": {
    "id": "<successor UUID>",
    "accountId": "<account UUID>",
    "name": "automation",
    "scope": "all_courses",
    "status": "active",
    "lastUsedAt": null,
    "createdAt": "<ISO timestamp>",
    "revokedAt": null,
    "rotatedFromId": "<predecessor UUID>",
    "rawKey": "<one-time opaque key>"
  },
  "meta": { "schemaVersion": 1, "requestId": "..." },
  "error": null
}
```

`rawKey` is present only in the successful issue/rotate response. It is not returned by list, later reads, retries that lose a rotation race, or errors. `keyHash` is never part of a response projection or OpenAPI DTO.

Expected errors:

| Condition | HTTP / code |
| --- | --- |
| missing account | 404 `NOT_FOUND`, field `id` |
| missing or cross-account credential | 404 `NOT_FOUND`, field `credentialId` |
| inactive account | 403 `FORBIDDEN` |
| revoked or already-rotated predecessor | 409 `CONFLICT`, field `credentialId` |
| missing/invalid session, CSRF, Origin, admin, or step-up | existing auth/CSRF/authorization error contract |
| losing repeated/concurrent rotation | 409 `CONFLICT`, no raw key |

## Persistence and lineage

`CliCredential.rotatedFromId` is nullable and maps to `rotated_from_id`. It is a named self-relation from successor to predecessor with `ON DELETE SET NULL`, plus a unique index on the predecessor ID. The unique index enforces at most one direct successor while allowing multi-generation lineage (`A → B → C`).

The existing `(accountId, name)` uniqueness remains unchanged. To make room for the successor's original logical name, the transaction renames the predecessor to:

```text
<Array.from(originalName).slice(0, 18).join('')>~rotated~<predecessorId>
```

The result is at most 63 characters and remains within the existing 1–64 name check. The successor receives the original name. The archival name is metadata for audit/list projections; clients use `rotatedFromId` rather than parsing it.

## Transaction and race semantics

The service uses `TransactionService.run()` and calls `lockAccountForUpdate()` before reading or writing credentials. It then re-reads the account, verifies ownership and predecessor status, captures one timestamp, updates the predecessor, and inserts the successor before commit. The raw key is returned only after the transaction resolves.

The same account lock is already used by credential issue/revoke and account disable/restore. Therefore:

- a second rotation observes the predecessor as revoked/rotated and returns 409;
- rotate/revoke and rotate/disable have a defined account-lock serialization order;
- disable revokes all active credentials, including a committed successor;
- restore changes only account status and never revives a credential;
- `canCreateCourse=false` remains independent of CLI credential validity.

No production test hook is used to simulate failure. Unit tests verify rejection propagation; PostgreSQL E2E tests verify real unique/transaction/concurrency behavior.

## Batch validation and idempotency boundary

Rotation does not update `QuestionValidationToken` or `QuestionBatchIdempotency` rows. A validation token issued through predecessor A retains `cliCredentialId = A`; after rotation A cannot authenticate and successor B cannot confirm A's token because confirmation requires an exact credential-ID match. B must validate again. Existing idempotency rows remain under `cli:<predecessorId>` and are not transferred; successor operations use `cli:<successorId>`.

The only expiry involved in this behavior is the existing 15-minute validation-token lifetime. It is not CLI key expiry.

## Secret handling and deferred scope

PostgreSQL stores only the SHA-256 hash of the high-entropy opaque key. Pino redacts `X-CLI-Key`, top-level/enveloped `rawKey`, validation tokens, idempotency keys, and payload hashes. No raw key, hash, TTL, grace-period, pending-verification, key-version, prefix/suffix, or maximum-active-key field is introduced.

Credential TTL/expiry policy, CLI/batch rate limiting, key rotation UX beyond this endpoint, and other BE-8 follow-ups remain deferred to their separately authorized slices. CP3 ends at Manual Checkpoint 3; CP4 must not begin without explicit confirmation.
