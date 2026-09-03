---
title: 智學互動平台 - M2 跨文件 Contract Review
type: research
status: draft
created: 2026-08-16
updated: 2026-08-16
tags:
  - project
  - 系統設計
  - ContractReview
  - M2
  - 智學互動平台
project: 智學互動平台
---

# 智學互動平台 - M2 跨文件 Contract Review

> [!important] Review result
> **PASS_WITH_FINDINGS — 無設計阻擋項；本次 BE-2 contract freeze 文件同步已完成，待 release approval 才可 final sign-off。** 本 review 以 source-of-truth hierarchy 判定衝突，不把目前 backend 尚未實作誤判為 contract 不一致；所有 deferred runtime capability 仍標示為 pending verification。

> [!important] Phase B follow-up status（2026-08-23）
> BE-2 freeze status（2026-08-27）：student Web Session + active enrollment account-bound Participant、anonymous fallback、CSRF/exact Origin、roster/my-courses ordering and idempotency semantics、owner/admin privacy boundaries、per-question results route and OpenAPI paths are aligned with runtime and evidence. Checkpoint D passed, but no final sign-off until synchronization/release approval. Archive/retention and durable realtime/replay remain deferred.

## 1. Scope、判定語意與方法

### 1.1 Review scope

本次檢查：

- `30_系統設計/API 與共用 Schema 設計.md`
- `30_系統設計/即時同步與結果治理設計.md`
- `30_系統設計/架構、容量與可觀測性設計.md`
- 既有 `系統領域與需求分析.md`、`非功能、風險與驗收分析.md`、`資料模型與 ER 設計.md`、`Web Auth 與安全設計.md`
- 上游 `P0 核心需求基線.md`、`題目領域契約.md`、`結果資料治理.md`、`MVP 效能目標.md`
- `M2 關鍵技術決策.md`、`技術棧.md`、`M2 系統分析與設計交付計畫.md`

### 1.2 Source-of-truth hierarchy

1. P0 可觀察狀態、權限與驗收：[[P0 核心需求基線]]。
2. 題目語意與 Web/CLI validation parity：[[題目領域契約]]。
3. 結果保存、匿名化、90 天 retention、提前刪除：[[結果資料治理]]。
4. 效能 workload 與 pass/fail 門檻：[[MVP 效能目標]]。
5. 由上述來源推導的 M2 technical decisions：[[M2 關鍵技術決策]]。
6. 交付計畫與索引只描述工作，不得覆寫以上 contract。

### 1.3 判定語意

| 結果 | 意義 |
|---|---|
| `PASS` | 名稱、欄位、狀態、權限、authority、錯誤與驗收證據一致 |
| `PASS_WITH_FINDINGS` | 設計可進入下一階段，但有非阻擋的 upstream wording/documentation follow-up |
| `BLOCKED` | 兩個以上 authority 對可觀察結果衝突，且沒有已批准的 M2 decision 可解消 |
| `OPEN_NON_BLOCKING` | 產品視覺或後續能力刻意延後，不改變資料/API/安全 contract |

方法是逐項追蹤 canonical entity/field/status/error/event/TTL/visibility/authority，回到來源 heading，並檢查 API → Socket → persistence → archive → capacity/metrics 的閉環。

## 2. Contract matrix

### 2.1 Entity、resource、event 與 archive

| Domain contract | API/resource | Socket/event | Persistence/archive | Result |
|---|---|---|---|---|
| Course | `/courses/{courseId}` | `session.state_changed` references Course-owned LiveSession | `Course` owns QuestionDefinition and LiveSession index | PASS |
| LiveSession | `/live-sessions/{sessionId}` and join by `sessionCode` | `session.snapshot`, `session.state_changed`, `session.closed` | `LiveSession` is one teaching run; close is irreversible | PASS |
| QuestionDefinition | `/courses/{courseId}/questions` and batch validate/confirm | no mutable source event; activation creates snapshot | Course-owned, draft-editable, reusable across sessions | PASS |
| SessionQuestion | snapshot/reconnect/submission paths | `question.opened`, `question.closed` | immutable per LiveSession; same row lock for submit/close | PASS |
| Participant | join/reconnect snapshot | participant-scoped snapshot/result projection | LiveSession-scoped token hash; no cross-session identity | PASS |
| Submission | `POST /live-sessions/{id}/submissions` + `Idempotency-Key` | ack is never coalesced; aggregate update may notify | `(participant, sessionQuestion)` unique; first accepted answer wins | PASS |
| ArchivedResult | `/results` and deletion request/confirm | `session.closed` precedes archive projection visibility | target only; archive/retention remains deferred | OPEN_NON_BLOCKING |
| DeletionEvent/tombstone | admin deletion status | no answer-bearing event | minimum actor/time/reason/category/count metadata | PASS |

### 2.2 Question fields, validation and errors

| Contract | API schema | CLI schema | Error/visibility | Result |
|---|---|---|---|---|
| `type` | `poll/open_text/quiz` | same canonical input | `QUESTION_TYPE_INVALID` | PASS |
| `prompt` | trimmed plain text, 1～1,000 | same | `TEXT_EMPTY`/`TEXT_TOO_LONG` | PASS |
| `selectionMode` | poll only | same | `FIELD_FORBIDDEN` when disallowed | PASS |
| `options` | poll/quiz 2～10, ordered refs | same | `OPTION_COUNT_INVALID`/`OPTION_DUPLICATE` | PASS |
| `correctOptionRefs` | quiz only, refs exist | same | `CORRECT_OPTION_INVALID` | PASS |
| `clientRef` | unique per batch, not formal ID | same | stable field-scoped validation error | PASS |
| batch | 1～50 only for batch command | same | all errors returned, all-or-nothing | PASS |
| preview/confirm | opaque token + payload hash + explicit confirmation | same; no `--yes/--force` bypass | token never logged/displayed in full | PASS |
| error shape | `field`, `nextStep`, blocking, request metadata | same machine schema | stable language-neutral code | PASS after naming resolution |

The review adopts `field` and `nextStep` because these are the existing backend `ErrorEnvelope` keys and the M2 decision baseline. A future `path` alias is not introduced under v1.

### 2.3 State, actor, transaction and event

| State/action | Allowed actor/precondition | Transaction/linearization | Success event | Failure code | Result |
|---|---|---|---|---|---|
| Course create | active admin/teacher with `canCreateCourse` | authorization + insert | resource response | `FORBIDDEN`/`CONFLICT` | PASS |
| LiveSession create | Course owner/admin; no waiting/active sibling | unique/transaction guard | `session.state_changed` | state conflict | PASS |
| Join/reconnect | valid code/token; waiting/active only | participant lookup/upsert + snapshot | `session.snapshot` | `SESSION_NOT_JOINABLE`/`UNAUTHORIZED` | PASS |
| Question open | Course teacher/admin; current state `not_open` | SessionQuestion row lock | `question.opened` | state/permission error | PASS |
| Submission | active session + question `open`; token scope | same SessionQuestion `FOR UPDATE`, READ COMMITTED | ack + `result.updated` outbox | `SUBMISSION_CONFLICT`/state error | PASS |
| Question close | teacher/admin; current state `open` | same row lock and commit order | `question.closed` | state/permission error | PASS |
| Auto-close | hard limit reached | same close command/lock path | `session.closed` | operational retry/alert | PASS |
| Archive | closed session; authoritative data frozen | archive/identity unlink boundary | deferred implementation | OPEN_NON_BLOCKING |
| Early delete | teacher request, admin explicit confirm | idempotent delete + tombstone | deletion status | `FORBIDDEN`/stable job error | PASS |

### 2.4 Authority, visibility and retention

| Data | Authority | Teacher | Participant | Retention/metric |
|---|---|---|---|---|
| Account/WebSession | PostgreSQL | own/admin scope | none | auth/session metrics; no secrets |
| LiveSession state | PostgreSQL | own/admin control | session-scoped view | state/event sequence |
| Submission | PostgreSQL transaction | anonymous aggregate only | own submission status | accepted/rejected/duplicate counters |
| Open-text answer | PostgreSQL, plain-text projection | anonymous content per governance | vote-to-reveal projection | no raw text logs; archive 90d |
| Socket event | outbox projection | role-scoped events | role-scoped events | event sequence/outbox age |
| ArchivedResult | PostgreSQL/archive store | own Course | no history entry | `closedAt` + `purgeAt`; retention alerts |
| Redis counter/adapter | auxiliary only | never a source | never a source | TTL/eviction/adapter metrics |

## 3. Findings and decisions

### F-01 — CLI `can_create_course` wording conflict (resolved)

- **Evidence:** [[M2 關鍵技術決策#8. can_create_course scope + CLI credential revocation — 已定案]] and [[Web Auth 與安全設計#Account、role 與 authorization matrix]] keep CLI credential revocation separate from removing `can_create_course`; the older CLI BDD scenario says removing the flag immediately rejects all CLI requests.
- **Decision:** `canCreateCourse=false` blocks creation of a new Course only. It does not revoke a CLI credential and does not remove management rights for an existing scoped Course. Existing CLI requests still require active account, active key, key scope, permission, ownership and Course state. Account disable or explicit key revoke blocks CLI immediately.
- **Disposition:** `RESOLVED / non-blocking documentation follow-up`. Update the older CLI BDD wording before its implementation tests are written; do not change the M2 technical decision or API contract.

### F-02 — Snake_case examples versus v1 camelCase wire contract (resolved)

- **Evidence:** The original M2 delivery plan examples use `event_seq`, `aggregate_version`, `server_timestamp` and `next_step`; backend `ErrorEnvelope`, current DTOs and the new API/realtime designs use `camelCase`.
- **Decision:** v1 JSON uses `camelCase`: `schemaVersion`, `requestId`, `eventSeq`, `aggregateVersion`, `serverTimestamp`, `nextStep`, `field`. The delivery-plan notation is planning prose, not a competing wire authority.
- **Disposition:** `RESOLVED / non-blocking documentation follow-up`. Future plan examples should be normalized to the v1 names; no dual wire names are accepted.

### F-03 — Current error envelope is narrower than target success envelope (resolved)

- **Evidence:** Backend currently returns `ErrorEnvelope` only; target API adds `data` and `meta` for successful responses and request metadata.
- **Decision:** This is an additive M3 common HTTP contract change, not current implementation evidence. Existing error keys remain stable; no runtime modification is part of this design gate.
- **Disposition:** `RESOLVED / implementation follow-up`, owned by Phase 2/3 common HTTP work.

### F-04 — Open-text list versus word cloud (accepted non-blocker)

- **Evidence:** [[M2 關鍵技術決策#9. Open text 安全投影 — 已定案（非阻擋部分延後）]] and [[結果資料治理]] fix plain-text input, safe projection, anonymization and retention but leave visual rendering to product.
- **Decision:** Server contract remains safe plain-text list projection; list/cloud/toggle is frontend product work and cannot change domain schema, visibility or retention.
- **Disposition:** `OPEN_NON_BLOCKING`; owner Product/Frontend, after M2.

## 4. M2 red-card closure

| Red card | Concrete decision | Evidence | Status |
|---|---|---|---|
| REST/CLI/Socket wire schema | v1 camelCase envelope, UUID/UTC, stable errors | API design | Closed |
| Validation token/payload hash | DB opaque token, token hash, canonical JSON SHA-256, 15 minutes | M2 decision + API design | Closed |
| Batch idempotency | same key/hash replay; hash mismatch conflict; all-or-nothing | API design + ERD | Closed |
| Socket protocol/replay | `/live`, canonical rooms, snapshot fallback | Realtime design | Lite runtime verified; durable eventSeq/outbox/replay deferred | OPEN_NON_BLOCKING |
| Submit/close race | same SessionQuestion `FOR UPDATE`, READ COMMITTED, commit order | M2 decision + realtime design | Closed pending Phase 6 proof |
| Backpressure/overload | bounded queue, coalesce display events only, stable retryable errors | Realtime + architecture | Closed pending load proof |
| Retention/early delete | 90d from closedAt, idempotent job, minimum tombstone, restore filter | Governance + realtime | Closed pending implementation proof |
| Compose/Redis/metrics/load | single-host topology, Redis auxiliary, Pino/metrics, W1～W8 harness | Architecture | Closed pending M4 proof |
| Open-text visual form | list/cloud/toggle deferred; safe plain-text server contract fixed | M2 decision | Non-blocking |

## 5. Phase 2 entry gate

### Allowed to proceed

- API, realtime and architecture contracts are internally consistent and have explicit source links.
- Current/gap status is visible; no document claims LiveSession/Submission/Archive runtime exists.
- No schema/runtime/DB change is authorized by this review; implementation must follow additive migration and the relevant phase gates.
- Phase 2 implementation must add contract fixtures, DB transaction tests and redaction tests before declaring capability verified.

### Required follow-ups (not design blockers)

1. Normalize snake_case examples in `M2 系統分析與設計交付計畫.md` to the v1 camelCase names.
2. Update the older CLI Agent BDD scenario so `can_create_course` removal is not described as credential revocation; preserve explicit key/account revocation behavior.
3. Implement the additive success `data/meta/error` response wrapper and expanded error codes in the common HTTP layer during M3.
4. Run true PostgreSQL race, outbox/reconnect, retention/restore and W1～W8 capacity verification; historical Phase 1 green results are not reused as evidence.

## 6. Review acceptance

- [x] ER entities, API resources, Socket events, archive objects and authority boundaries are mapped.
- [x] Question fields, validation rules, error semantics and Web/CLI parity are mapped.
- [x] Role, ownership, `can_create_course`, state guards, transaction boundary, event and failure code are mapped.
- [x] Submission/idempotency/aggregate/retention/deletion paths are closed.
- [x] W1～W8 workload, architecture components, metrics and evidence are mapped.
- [x] Only open-text visual rendering remains explicitly non-blocking.
- [x] Findings have dispositions and owners; no blocking inconsistency remains.

## 相關連結

- 需求 source of truth：[[P0 核心需求基線]]、[[題目領域契約]]、[[結果資料治理]]、[[MVP 效能目標]]
- 上游設計：[[系統領域與需求分析]]、[[非功能、風險與驗收分析]]、[[資料模型與 ER 設計]]、[[Web Auth 與安全設計]]
- 本次設計：[[API 與共用 Schema 設計]]、[[即時同步與結果治理設計]]、[[架構、容量與可觀測性設計]]
- 技術與交付：[[M2 關鍵技術決策]]、[[技術棧]]、[[M2 系統分析與設計交付計畫]]
