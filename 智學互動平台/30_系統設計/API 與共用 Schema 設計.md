---
title: 智學互動平台 - API 與共用 Schema 設計
type: research
status: draft
created: 2026-08-16
updated: 2026-08-16
tags:
  - project
  - 系統設計
  - API
  - Schema
  - M2
  - 智學互動平台
project: 智學互動平台
---

# 智學互動平台 - API 與共用 Schema 設計

> [!important] Phase B API actor addendum（2026-08-23）
> Join/reconnect/submit 的 current actor model 除 anonymous session-code + participant-token 外，新增 student Web Session + active `CourseEnrollment` → account-bound Participant 分支；student join 不回 raw participant token，student mutation 仍需 CSRF + exact Origin。student 不能使用 teacher/admin owner routes。Participant snapshot/result 仍採 participant-safe visibility；open_text responses 只含 `{ text }`，不得含 account/display/participant/token linkage；student 沒有歷史結果 API/portal。
> 本 addendum 同步 wire actor/scope 語意，不把 API contract 文字當作 full runtime verification；B3/full regression 與 archive/retention target 仍依 backend status evidence 分層。

> [!important] 文件定位
> 本檔把 [[題目領域契約]]、[[P0 核心需求基線]]、[[結果資料治理]] 與 [[M2 關鍵技術決策]] 轉成 Web、匿名 Participant、CLI/Agent 與 Socket.IO 共用的 wire contract。本檔定義介面與資料交換語意，不取代需求規則、ERD 或即時同步設計。

> [!warning] Current / target boundary
> Backend runtime 已支援 `/api/v1`、Identity/Course/Enrollment、LiveSession、Question、Participant、Submission、Result、CLI credential 與 Socket.IO lite wire paths；本檔仍保留 archive/retention 與 durable realtime/replay 為 deferred target。Runtime evidence 與 target contract 分開記錄。

## 1. Source of truth 與共用規約

| 順序 | 來源 | 本檔使用方式 |
|---:|---|---|
| 1 | [[P0 核心需求基線]] | Course/LiveSession/Account/Participant/Submission 狀態、權限與可觀察結果 |
| 2 | [[題目領域契約]] | QuestionDefinition、Option、SessionQuestion、validation、error semantics |
| 3 | [[結果資料治理]] | ArchivedResult、匿名化、90 天 retention、提前刪除與 tombstone |
| 4 | [[MVP 效能目標]] | W1～W8 workload 與 p95/p99/正確性門檻 |
| 5 | [[M2 關鍵技術決策]] | UUID v7、PostgreSQL authority、opaque validation token、Redis boundary、wire baseline |
| 6 | ER/Auth/Realtime/Architecture design | 資料映射、授權、事件、部署與觀測的具體落地 |

### 1.1 Global wire invariants

- REST base path 為 `/api/v1`；health path 維持 `/health/live`、`/health/ready`，不進 `/api/v1`。
- Public identifier 使用 UUID v7 字串；client 不得自訂正式 resource ID。`client_ref` 與 `option_ref` 只用於一次 payload 內的定位。
- Timestamp 使用 UTC ISO 8601，例如 `2026-08-16T03:00:00.000Z`。
- Enum/state 在 wire 上使用穩定 lowercase snake case：`draft`、`waiting`、`active`、`closed`、`cancelled`、`not_open`、`open`。
- JSON 欄位使用 `camelCase`；CLI 可提供人類可讀繁中/英文，但 machine output 使用相同 JSON contract。
- 未知 request 欄位被拒絕；response 不回傳 password、hash、raw cookie、participant token、CLI key、internal SQL 或 stack trace。
- REST、Socket 與 CLI 共用 language-neutral error code；人類訊息可翻譯，不作程式判斷依據。

## 2. Envelope、meta 與錯誤

### 2.1 Success envelope

```json
{
  "data": {},
  "meta": {
    "schemaVersion": 1,
    "requestId": "0190c6b8-0000-7000-8000-000000000001"
  },
  "error": null
}
```

`meta` 可按 endpoint 擴充 `page`、`total`、`nextCursor`、`eventSeq` 或 `aggregateVersion`，但不得改變 `schemaVersion` 的語意。無資料成功回傳 `data: null`，不可用空 object 代替未知語意。

### 2.2 Error envelope

```json
{
  "data": null,
  "meta": {
    "schemaVersion": 1,
    "requestId": "0190c6b8-0000-7000-8000-000000000001"
  },
  "error": {
    "code": "FIELD_FORBIDDEN",
    "field": "questions[2].correctOptionRefs",
    "message": "This field is not allowed for poll questions.",
    "blocking": true,
    "nextStep": "Remove the field and submit validation again.",
    "retryAfterSeconds": null
  }
}
```

Backend current `ErrorEnvelope` 使用 `error.code/message/field/blocking/nextStep`；target success envelope 的 `meta` 與 error `retryAfterSeconds` 是向後相容的 additive extension，`field` 維持目前 common HTTP contract 的欄位名稱，正式實作前需由 common HTTP contract 一次定案，不在本文件逕自修改 runtime。

### 2.3 HTTP/Socket/CLI mapping

| 情境 | HTTP | Socket ack | CLI exit | Code |
|---|---:|---|---:|---|
| malformed/validation input | 400 | error ack | 2 | `VALIDATION_FAILED` 或題目 domain code |
| missing/invalid/expired auth | 401 | error ack | 3 | `UNAUTHORIZED` / auth-specific code |
| authenticated but not permitted | 403 | error ack | 3 | `FORBIDDEN` |
| resource absent or existence hidden | 404 | error ack | 4 | `NOT_FOUND` |
| state/unique/idempotency conflict | 409 | error ack | 5 | `CONFLICT` / `SUBMISSION_CONFLICT` |
| rate/connection/backpressure limit | 429 | error ack | 6 | `RATE_LIMITED` |
| timeout with unknown commit result | 503/504 | error ack | 7 | stable retry guidance; client must query by idempotency key |
| unexpected server failure | 500 | error ack | 1 | `INTERNAL_ERROR` |

A missing Web Session is always 401; an authenticated caller lacking role, ownership or `canCreateCourse` is 403. This preserves the guard semantics recorded in `tasks/lessons.md`.

## 3. Shared question schemas

### 3.1 Question input

The following is the wire representation of the domain contract; it is not the persistence model.

```json
{
  "schemaVersion": 1,
  "courseId": "0190c6b8-0000-7000-8000-000000000001",
  "questions": [
    {
      "clientRef": "q1",
      "type": "poll",
      "prompt": "Which database do you use?",
      "selectionMode": "single",
      "options": [
        { "optionRef": "a", "text": "PostgreSQL" },
        { "optionRef": "b", "text": "SQLite" }
      ]
    }
  ]
}
```

Rules are inherited from [[題目領域契約]]:

- `poll`: `selectionMode` required; 2～10 options; `correctOptionRefs` forbidden.
- `open_text`: options, selectionMode and correctOptionRefs forbidden; submission is trimmed plain text, 1～2,000 Unicode characters.
- `quiz`: 2～10 options; selectionMode forbidden; one or more correctOptionRefs required and each must reference an option.
- Prompt is trimmed plain text, 1～1,000 Unicode characters; option text is trimmed plain text, 1～250 characters.
- No HTML, Markdown, attachments, images or rich content in MVP.
- `clientRef` is unique per batch; formal question IDs are server-generated and immutable.

### 3.2 Validation result

```json
{
  "schemaVersion": 1,
  "valid": false,
  "payloadHash": "sha256:base64url-or-hex",
  "errors": [
    {
      "code": "OPTION_DUPLICATE",
      "field": "questions[0].options[1].text",
      "message": "Option text duplicates another option after normalization.",
      "blocking": true,
      "nextStep": "Change the option text."
    }
  ],
  "warnings": [],
  "preview": null,
  "validationToken": null,
  "expiresAt": null
}
```

Validation normalizes before checking empty/length/duplicate rules: trim, Unicode normalization, collapse consecutive whitespace and case-insensitive comparison. Web and CLI must produce the same canonical result, error code and `field` path for the same fixture.

### 3.3 Preview and confirm

A successful validation returns a complete preview containing `courseId`, course name, key scope (CLI only), ordered questions, full content, correct answers and deterministic warnings. The preview is not a write.

```json
{
  "schemaVersion": 1,
  "previewId": "0190c6b8-0000-7000-8000-000000000002",
  "courseId": "0190c6b8-0000-7000-8000-000000000001",
  "payloadHash": "sha256:...",
  "validationToken": "opaque-value-returned-only-to-authorized-client",
  "expiresAt": "2026-08-16T03:15:00.000Z",
  "questions": [],
  "warnings": []
}
```

The raw validation token is never logged, placed in a Socket event, shown in a human-readable CLI message, or returned after the initial validation response. The confirm request sends the token through a dedicated header or body field defined by the endpoint contract; the server stores only its hash.

## 4. Resource and endpoint catalog

The following catalog is the target v1 surface. Each endpoint must use the actor and transaction boundaries below; unimplemented rows remain design targets.

| Resource | Method/path | Actor/scope | Boundary and outcome |
|---|---|---|---|
| Login | `POST /auth/login` | Web account | Verify credentials, create DB session and cookie in one application operation; generic 401 on failure |
| Current session | `GET /auth/session` | Web session | Load PostgreSQL session; return account projection only |
| Logout | `POST /auth/logout` | Web session | Revoke current session and clear cookie; safe retry |
| Accounts | `POST /admin/accounts` | Admin | Create account with temp password; no password/hash in response |
| Account state | `PATCH /admin/accounts/{accountId}` | Admin + policy/step-up | Disable/restore or permission change; revoke according to Auth design |
| Courses | `GET/POST /courses` | Web account/CLI | List owned draft courses; create only when role/flag permits |
| Questions | `GET/POST/PATCH/DELETE /courses/{courseId}/questions` | Course owner/admin | Single-question CRUD; draft and ownership checks; course append/reorder transaction |
| Batch validation | `POST /courses/{courseId}/question-batches/validate` | Teacher or CLI key | Validate all items, return all errors/warnings and opaque token |
| Batch confirm | `POST /courses/{courseId}/question-batches/confirm` | Same actor + confirmation | Recheck auth/state/token/hash, write all or none, return idempotent result |
| Live session | `POST/GET /live-sessions` | Course owner/admin | Create/list; enforce one waiting/active session per Course |
| Join | `POST /live-sessions/{sessionCode}/join` | Student Web Session + active enrollment, or anonymous participant | Student creates account-bound Participant and returns `participantToken: null`; anonymous validates code/display name and returns raw session-scoped token once |
| Reconnect snapshot | `GET /live-sessions/{sessionId}/snapshot` | Participant token/teacher | PostgreSQL snapshot with role-specific visibility |
| Submit | `POST /live-sessions/{sessionId}/submissions` | Account-bound Participant (student CSRF + exact Origin) or anonymous Participant token | `Idempotency-Key`; lock SessionQuestion and accept first answer only |
| Control question | `POST /live-sessions/{sessionId}/questions/{questionId}/open|close` | Course teacher/admin | Lock/state transition; publish event after commit |
| Results | `GET /live-sessions/{sessionId}/questions/{sessionQuestionId}/results` | Teacher/admin or eligible participant | Per-question vote-to-reveal and anonymized projection; no session-level results route |
| Archived results | `GET /results` / `GET /results/{liveSessionId}` | Teacher owner/admin | Paginated query, `closedAt`, deletion deadline; no participant identity link |
| Delete request | `POST /results/{liveSessionId}/deletion-requests` | Course teacher | Creates request only; no data deletion |
| Delete confirm | `POST /admin/results/{liveSessionId}/deletion` | Admin + explicit confirmation | Delete whole archive in transaction/job boundary; write minimal tombstone |

### 4.1 Enrollment

| Resource | Method/path | Actor/scope | Boundary and outcome |
|---|---|---|---|
| Course roster add | `POST /courses/{courseId}/enrollments` | Course owner/admin teacher | Active duplicate returns the same row; removed row is reactivated; archived Course rejects new/reactivation |
| Course roster | `GET /courses/{courseId}/enrollments` | Course owner/admin teacher | Includes active and removed enrollments, ordered `createdAt ASC, id ASC`; non-owner teacher receives 404 |
| Course roster remove | `DELETE /courses/{courseId}/enrollments/{studentAccountId}` | Course owner/admin teacher | Idempotent; student receives 403 |
| My courses | `GET /me/courses` | Student | Active enrollments only, ordered `enrolledAt DESC, id DESC`; paginated |

### 4.2 CLI/Agent boundary

MVP supports one verified Agent host and these semantic commands: `auth configure`, `auth status`, `courses list`, `questions validate`, `questions create`. Final executable naming is an implementation concern; the server contract remains the same.

- CLI credential uses an explicit authorization header, never query string, JSON content, argv or shell history.
- `courses list` returns only key-scope-owned draft courses with immutable IDs.
- `questions create` never supports `--yes`/`--force` to bypass validation, preview or teacher confirmation.
- CLI output is stable JSON when machine mode is selected; human output cannot include raw secrets or full validation token.
- Question content and tool output are untrusted data; they cannot change authorization, confirmation or command policy.

## 5. Validation token, canonical hash and idempotency

### 5.1 Canonical payload hash

The server canonicalizes the validated payload using deterministic object-key ordering, normalized strings, preserved array order and UTF-8 JSON without insignificant whitespace. It computes SHA-256 over the canonical bytes and compares the resulting digest on confirm. The exact canonicalization implementation becomes a shared library contract before M3; clients must treat `payloadHash` as opaque.

### 5.2 Token lifecycle

- Generate high-entropy opaque token server-side; persist only token hash.
- Bind token to actor/account, optional CLI key ID, Course ID, payload hash, schema version and `expiresAt = issuedAt + 15 minutes`.
- Confirm requires active actor, current permission, draft Course ownership, matching payload hash and unexpired unused token.
- Payload mutation, actor/key revoke, account disable, Course archival or token expiry invalidates confirmation.
- A failed transaction does not consume the token; a committed success marks it consumed together with the command result.
- Cancellation creates no pending command or durable answer.

### 5.3 Idempotency

`Idempotency-Key` is required for batch confirm and Submission. The server stores `(actor scope, operation, idempotency key, payload hash)` with the first committed response.

- Same key + same hash: replay the original response; no duplicate write.
- Same key + different hash: `409 CONFLICT`; never overwrite the original result.
- Unknown commit outcome: client retries with the same key or queries the idempotency status endpoint; it must not create a new key to guess.
- Idempotency records are retained at least as long as the retry window and any active command/token; exact retention is set with the ERD/architecture implementation.

## 6. Authorization and transaction contract

| Operation | Authentication | Authorization | Linearization/transaction |
|---|---|---|---|
| Course create | Web session/eligible CLI | role + `canCreateCourse` | account check + Course insert |
| Question append/reorder | Web/CLI actor | owner/admin + Course `draft` | Course-scoped advisory lock + ordered write |
| Batch confirm | Web/CLI actor + token | recheck actor/key/owner/draft | one transaction; all-or-nothing |
| Join/reconnect | session code/participant token | session state + token scope | participant upsert/lookup + snapshot query |
| Submit | participant token | active LiveSession + open question | SessionQuestion `FOR UPDATE`, unique Submission, commit |
| Open/close question | teacher/admin session | Course ownership/admin | same SessionQuestion lock and state transition |
| Result query | Web session/eligible participant | Course ownership or visibility rule | read authority from PostgreSQL |
| Early delete | teacher request then admin | explicit confirmation + admin policy | delete archive and tombstone atomically or resumable idempotent job |

The successful state change is authoritative only after PostgreSQL commit. Socket events, caches and client timestamps cannot grant permission or decide ordering.

## 7. Schema versioning and compatibility

- `schemaVersion: 1` is the MVP wire version and must be present in REST payloads, Socket event payloads and CLI machine output.
- Additive optional response fields are backward compatible; changing field meaning, requiredness, enum semantics, visibility or error code is breaking.
- A new major API path/version is required for breaking changes. Do not silently accept both old and new meanings under one version.
- Error codes are append-only and never reused. Existing `ErrorEnvelope` keys (`code`, `message`, `field`, `blocking`, `nextStep`) remain stable.
- Canonical fixtures must be shared by Web and CLI validation tests; OpenAPI/JSON Schema generation is derived from this contract, not the other way around.
- Socket event names and fields are governed jointly by [[即時同步與結果治理設計]]; this document owns the shared envelope and primitive schema only.

## 8. Current implementation / target / evidence

| Capability | Current backend evidence | Target/evidence |
|---|---|---|
| `/api/v1` and explicit controller version | `configure-app.ts`, Identity/Course controllers | Preserve in all new controllers; route contract tests |
| Error envelope | `src/common/errors/domain-error.ts`, global filter | Extend only additively; contract tests for HTTP/Socket/CLI |
| UUID v7 and UTC | `src/common/crypto/uuid.ts`, DTO serialization | All resource schemas and OpenAPI/JSON Schema |
| Pagination | `src/common/pagination/pagination.ts` | Reuse for archive/result queries; cap page size at 100 |
| Question schema | Not implemented | Shared validator/fixtures before M3 |
| Validation token | Not implemented | DB-backed opaque record, 15-minute contract |
| Submission idempotency | Not implemented | Unique/transaction design from ERD + race tests |
| Socket wire contract | Runtime lite `/live` implemented; snapshot fallback | Durable event catalog/replay remains deferred |

## 9. Acceptance and related links

- [ ] Web and CLI valid/invalid fixtures produce identical canonical result, error code and `field` path.
- [ ] Batch errors are complete and all-or-nothing; preview/confirm requires explicit confirmation.
- [ ] Same idempotency key is replay-safe; hash mismatch is a stable conflict.
- [ ] Every endpoint has actor, scope, status guard, transaction boundary and stable failure code.
- [ ] API schemas match ER entities, Socket events and Archive projections in [[M2 跨文件 Contract Review]]。
- [ ] Runtime implementation and contract tests remain deferred to M3/M4; this document is not implementation evidence.

## 相關連結

- 需求：[[P0 核心需求基線]]、[[題目領域契約]]、[[結果資料治理]]
- 效能：[[MVP 效能目標]]、[[MVP 效能需求 BDD 場景]]
- 上游設計：[[系統領域與需求分析]]、[[非功能、風險與驗收分析]]、[[資料模型與 ER 設計]]、[[Web Auth 與安全設計]]
- 同步與治理：[[即時同步與結果治理設計]]
- 架構：[[架構、容量與可觀測性設計]]
- 技術決策：[[M2 關鍵技術決策]]、[[技術棧]]
- Review：[[M2 跨文件 Contract Review]]
