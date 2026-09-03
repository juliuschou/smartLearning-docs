# BE-8.6 CP6 — Redaction / disclosure review

狀態：`VERIFIED`

日期基線：2026-09-01。此文件記錄 CP1–CP5 累積輸出面的稽核與可執行 tripwire；所有值均為 synthetic sentinel，沒有真實秘密、PII、環境值或題目內容。

## Scope and policy

本次只處理 log、exception/validation details、OpenAPI schema metadata、bootstrap console output 與 rate-limit key/log disclosure。沒有修改 API wire contract、權限、Redis bucket/HMAC 演算法、Prisma schema、migration、資料或 CP7 metrics。

- 永不入 log：password/hash、cookie/auth/CSRF/session/participant/CLI/validation token、raw CLI key、idempotency/payload hash、answer/open-text/question content、request-body PII、raw/composed rate-limit key、任意 thrown message/value。
- Context-sensitive：API 合約允許的 `expiresAt` 與一次性 CLI `rawKey` 保留在指定 response；若 response-shaped record 被序列化進 log，對應 path 移除。`req.body.displayName` 僅在 request body path 遮罩。
- 可保留 metadata：stable resource ID、request ID、固定 code/reason、`errorType`。

## Audit matrix

| Data / field | Source | Sink / path | API allowed? | Log allowed? | Protection / tripwire |
|---|---|---|---|---|---|
| `password`, password hash | auth/account/bootstrap | request, persistence, errors | no | no | DTO/filter/redaction; auth and Pino sentinel tests |
| session/CSRF/participant/CLI/validation token | auth, handshake, batch | headers, cookie, response | only contract-specific response | no | exact Pino paths + envelope/E2E assertions |
| CLI `rawKey` | credential create/rotate | one-time response `data.rawKey` | create/rotate only | no | ordinary/one-time OpenAPI schema assertions + Pino |
| `expiresAt` | session/validation token | `SessionDto`, `ValidateBatchResponseDto` | only those contracts | no in response-shaped logs | OpenAPI placement assertion + Pino top-level/data paths |
| question/preview/prompt/options/correct refs | question DTO/batch service | request `questions`, response `questions`/`preview` | endpoint-specific | no | collection-root Pino redaction + OpenAPI metadata walker |
| submission answer/open text | submission DTO/results | request/response projections | endpoint-specific | no | existing answer paths + full serialized sentinel assertions |
| account `displayName` | update/join request | `req.body.displayName` | response projection may be allowed | request PII no | narrow request path; safe projection metadata remains |
| `payloadHash`/idempotency key | batch/submission | request/response | endpoint-specific | no | exact request/response paths + envelope tests |
| raw/composed login rate-limit key | key factory/store | Redis internal only | no | no | HMAC factory tests + Redis logger spies |
| arbitrary exception message/value | all catches | Logger/bootstrap console | no | no | `errorType(error)` only; source search + logger spies |
| stable IDs, request ID, code/reason, error type | application/filter | structured logs/envelopes | yes where contract permits | yes | tests assert presence while secrets are absent |

## Four required groups

1. **`expiresAt` context** — remains in session/validation response contracts; redacted from response-shaped logs and excluded from ordinary CLI credential schemas.
2. **CLI successor/raw key** — `rotatedFromId` remains safe metadata; `rawKey` exists only in one-time create/rotate DTOs and never in logs; `keyHash` is never public.
3. **Account-update values** — `UpdateAccountDto` remains the frozen allowlist (`displayName`, `role`, `canCreateCourse`); request `displayName` is redacted narrowly, while stable account identifiers and explicitly permitted response projections remain observable.
4. **Login/CLI rate-limit keys** — login keys remain HMAC/domain-separated and opaque; CLI operation bucket composition remains internal-only and is not blanket-redacted as generic `key`.

## Changed protections

- `src/common/observability/pino-redaction.ts` now removes request `displayName` and batch `questions`, plus top-level/data response `questions`, `preview`, `payloadHash`, and `expiresAt`.
- Logger catch paths use fixed messages/reasons, safe IDs, and `errorType` only. Post-commit fire-and-forget, listener isolation, socket cleanup, retry behavior and auto-close continuation remain unchanged.
- Bootstrap success output omits username; failure output reports only a fixed message and safe error type.
- Validation constraint messages that contain `$value` or the rejected string are replaced with fixed `Invalid value.` text while preserving field paths and deterministic ordering.
- Caller-controlled question type/correct-reference values are not interpolated into validation messages; the shared domain flow retains stable error codes/paths.
- OpenAPI test includes a recursive `example`/`examples`/`default` metadata scan and placement checks for `rawKey`, `expiresAt`, `validationToken`, and `keyHash`.
- `test/manual-cp6-verify.e2e-spec.ts` is intentionally excluded from default E2E and has a dedicated `test:cp6:manual` entrypoint.

## Verification evidence

### Automated tests and searches

| ID | Command / spec | Sentinel class | Status |
|---|---|---|---|
| CP6-U1 | `npm test -- --runInBand common/observability pino-redaction.spec.ts` (within final targeted command) | auth, PII, question, preview, hash, expiry | PASS — covered by final 12-suite run |
| CP6-U2 | `npm test -- --runInBand common/http ...` (within final targeted command) | target/value/rejected constraint | PASS — 2 suites included; final run 69 tests |
| CP6-U3 | final targeted unit command covering domain/logger/rate-limit specs | exception message/value, raw key, Redis URL | PASS — 12 suites / 69 tests |
| CP6-S1 | `rg -n "error\\.message|String\\(error\\)" src --glob '*.ts'` plus logger-argument search | arbitrary message/value logging | PASS — no matches |
| CP6-O1 | `NODE_ENV=test npm run test:e2e -- --runInBand test/openapi.e2e-spec.ts` | OpenAPI schema metadata | BLOCKED — four tests passed after schema fixes, but `afterAll` exceeded 30s while background scheduler/publisher DB work failed; guarded test schema/migration state is not confirmed |
| CP6-M1 | `npm run test:cp6:manual -- --runInBand` | complete synthetic specimens | PASS — 1 suite / 1 test; manual inspection still pending |

### Static quality gates

- **PASS:** `git diff --check`, `npm run typecheck`, `npm run lint:check`, `npm run format:check`, `npm run build`.
- **PASS:** `npm test -- --runInBand --silent` — 43 suites / 258 tests, 0 skipped.
- **OpenAPI E2E:** the authorized command reached 4/4 passing tests after adding the missing generated response models, but exited 1 because `afterAll` timed out at 30s while the full app's background scheduler/publisher encountered database errors. Do not treat this as a green DB-backed verification; migration/schema state still needs an authorized check.
- **Migration status:** `NODE_ENV=test npm run prisma:migrate:status` confirmed the guarded target `smartlearning_test` at `localhost:5432`, then returned `P1001` because PostgreSQL was unreachable. No mutation occurred.
- **Not run:** default E2E/integration.

### Manual specimens

The verifier was executed with synthetic sentinel `CP6-SENTINEL-DO-NOT-RETAIN` using the exact command below. The following are sanitized specimen shapes captured from the run; dynamic `time`/`pid`/`hostname` fields are intentionally omitted from this review document.

- **ID:** `pino-request-response`
  **Command/spec:** `npm run test:cp6:manual -- --runInBand`, `test/manual-cp6-verify.e2e-spec.ts`, 1 test
  **Sanitized JSON:** `{"req":{"body":{}},"res":{"body":{"data":{"accountId":"safe-account-id"}}}}`
  **Must be absent:** request display name/questions; response questions/preview/payloadHash/expiresAt sentinel.
  **Must remain:** `safe-account-id`.

- **ID:** `caught-exception-log`
  **Command/spec:** same command/spec, 1 test
  **Sanitized JSON:** `{"event":"realtime.signal.listener_failed","signalType":"question.opened","liveSessionId":"safe-session-id","errorType":"Error"}`
  **Must be absent:** thrown exception message/value.
  **Must remain:** fixed event, signal type, stable session ID, error type.

- **ID:** `validation-envelope`
  **Command/spec:** same command/spec, 1 test
  **Sanitized JSON:** `{"data":null,"meta":{"schemaVersion":1,"requestId":"cp6-validation-envelope"},"error":{"code":"VALIDATION_FAILED","message":"displayName: Invalid value.","field":"displayName","blocking":true,"retryAfterSeconds":null}}`
  **Must be absent:** target, rejected value, constraint sentinel.
  **Must remain:** stable field path and generic invalid-value message.

- **ID:** `unknown-error-envelope`
  **Command/spec:** same command/spec, 1 test
  **Sanitized JSON:** `{"data":null,"meta":{"schemaVersion":1,"requestId":"cp6-unknown-error-envelope"},"error":{"code":"INTERNAL_ERROR","message":"Internal error","blocking":false,"nextStep":"Retry; contact support if it persists.","retryAfterSeconds":null}}`
  **Must be absent:** exception message/stack.
  **Must remain:** request ID and stable internal-error envelope.

- **ID:** `rate-limit-envelope`
  **Command/spec:** same command/spec, 1 test
  **Sanitized JSON:** `{"data":null,"meta":{"schemaVersion":1,"requestId":"cp6-rate-limit-envelope"},"error":{"code":"AUTH_RATE_LIMIT_UNAVAILABLE","message":"Authentication is temporarily unavailable. Please try again later.","blocking":true,"retryAfterSeconds":null}}`
  **Must be absent:** internal Redis key, URL, source, account, and exception details.
  **Must remain:** stable outage code and retry-safe message.

- **ID:** `rate-limit-outage-log`
  **Command/spec:** same command/spec, 1 test
  **Sanitized JSON:** `{"reason":"command_error","errorType":"Error"}`
  **Must be absent:** username, source IP, digest/full Redis key, URL, exception message.
  **Must remain:** fixed reason and error type.

**HEAD/date:** `56b67dc8580c9e164f96de71ead6ea9f5b3cbcc1`, 2026-09-01.

For each actual specimen, record ID, exact command, spec/test, sentinel class, sanitized JSON, must-be-absent values, must-remain values, test count, HEAD and date here. Do not paste real credentials or production values.

## Manual status

`VERIFIED` — the user reviewed the sanitized log and error-envelope specimens and explicitly confirmed `Checkpoint 6 verified`.
