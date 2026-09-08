# FE-6 Archive／History UI 規劃

## Context

`智學互動平台剩餘工作WBS.md` 將 FE-6 定義為 teacher/admin 的 LiveSession 歷史封存、匿名結果查閱、提前刪除治理與 tombstone UI，並明確要求「BE-5 完成後才開始，不做 mock」（WBS `705-716`）。目前 backend 已有 archive list/detail、刪除申請與 admin step-up 刪除的初步 runtime，但 BE-5 WBS 仍未完成，且現有契約缺少 course filter、可讀的課程/場次 metadata、pending request 查詢、request-bound confirmation、可辨識 retention/early-delete 的 tombstone、完整 OpenAPI 與 retention/no-resurrection 證據。

因此採用 dependency-first 方案：先補齊並驗證 BE-5，再依 Option B 以真實 backend 實作 FE-6；不建立 mock、placeholder endpoint 或 frontend 推測狀態。兩個 repository 分開交付，既有 UI 未提交的 FE-5.4 變更必須保留且不混入 FE-6。

## Success criteria

- Teacher 僅能分頁查閱自己 Course 的 closed LiveSession archives；admin 可查全域；student 無 UI 且 API 被拒絕。
- Archive detail 使用不可變 snapshot，能呈現 poll、poll-multiple、quiz、open-text 匿名結果，且不讀取 current QuestionDefinition 或 live result endpoint。
- UI 明確區分：empty、not found/existence-hidden、active、deletion requested、retention-deleted、early-deleted、retryable error。
- Teacher 只能提交整堂課的提前刪除申請；admin 必須針對特定 request 完成 step-up 與明確確認後才能刪除。
- 刪除後 backend response、React Query cache、重新整理、登出/登入與瀏覽器返回都不能重新顯示 archive payload。
- BE-5 retention worker、dry-run、retry/restart、concurrency、metrics 與 restore no-resurrection 證據完成；FE-6 real-backend browser acceptance 0 skipped。

## Phase 0 — Baseline and isolation

- 分別記錄 backend/UI branch、dirty files 與既有 targeted baseline；不要 reset、stage 或全域 format。
- UI 下列既有 FE-5.4 變更不納入 FE-6：`tasks/lessons.md`、`tasks/todo.md`、`test/browser/support/fe5-real-backend-fixture.ts`、`test/fe-5-4-four-question-acceptance.test.tsx`、`test/learner-live-session-view.test.tsx`、`test/participant-realtime-adapter.test.tsx`。
- 開始 frontend code 前再次查閱 `node_modules/next/dist/docs/` 的 layouts/pages、dynamic routes、loading/error 與 testing 文件。

## Phase 1 — Complete and freeze BE-5 contract

### 1. Archive query contract

Extend `GET /api/v1/results` with validated optional filters:

- `page` default 1, min 1
- `pageSize` default 20, range 1–100
- `courseId` optional UUID
- `status` optional `active | deleted`
- authorization must be intersected before pagination; teacher cannot escape Course ownership via filters
- deterministic order: `closedAt DESC` plus stable ID tie-breaker

Freeze a concrete runtime/OpenAPI `ArchiveSummaryDto` containing:

- `id`, `liveSessionId`
- `course: { id, name }`
- stable server-projected session label plus `startedAt`, `closedAt`
- `status`, `purgeAt`
- nullable outstanding `deletionRequest`
- nullable completed `deletion` metadata

Do not expose session code, archive payload, prompts, participant/account/token linkage, request/executor account IDs, or submission metadata in list rows. Do not add a broad date-range feature unless acceptance is expanded; course/status filters are the minimum FE-6 requirement.

### 2. Detail and tombstone contract

Replace the loose `Prisma.JsonValue`/optional-property behavior with a documented discriminated response:

- active: summary + `payload: { schemaVersion: 1, questions[] }`
- each archived question: `id`, `position`, `prompt`, existing `SessionQuestionResultsDto` union
- deleted: summary + `deletion: { trigger: early_delete | retention, reason, deletedAt }`, and **no payload key/content**

Treat “expired” as a retention tombstone (`status=deleted`, `trigger=retention`), not a client-clock-derived status. If `purgeAt` has passed but purge has not committed, backend authority still controls readability; frontend refetches and never guesses deletion.

### 3. Deletion request state machine

- Expose outstanding request state in archive list/detail.
- Add `GET /api/v1/admin/results/deletion-requests?page&pageSize&status=requested` for the admin queue.
- Freeze teacher request receipt for `POST /results/:liveSessionId/deletion-requests`; duplicate outstanding requests return the same request without rewriting the original reason/time.
- Change admin confirmation body to include `deletionRequestId`, `confirmed: true`, and a validated reason.
- Within one locked transaction: verify request/session match and `requested` state, purge answer-bearing content, mark request completed, write exactly one canonical tombstone, and return the deletion result.
- Retry of a completed request returns the existing result without another destructive event. If retention wins while a request is pending, complete/remove it from the pending queue consistently.

Primary backend files:

- `src/modules/governance/api/governance.controller.ts`
- `src/modules/governance/api/dto/governance.dto.ts`
- `src/modules/governance/application/governance.service.ts`
- `src/modules/governance/domain/archive-projection.ts`
- `prisma/schema.prisma` and an additive migration if state/link constraints require it
- `src/common/errors/*` only for necessary stable archive codes
- `test/archive-governance.e2e-spec.ts`
- `test/openapi.e2e-spec.ts`
- `docs/frontend-api-reference.md`

Use concrete response DTO classes and Swagger decorators; OpenAPI and runtime tests are the contract freeze consumed by the frontend.

## Phase 2 — Finish BE-5 operational gate

Before FE-6 implementation starts:

- Register a production-invokable bounded retention runner around existing `purgeDue()` with non-overlap/claim policy, oldest-first processing, restart safety, and no public destructive browser endpoint.
- Add operator dry-run/due inspection that reports due work without deleting。
- Add DB-backed coverage for exact `purgeAt`, pre-deadline rejection, bounded batches, repeat runs, concurrent workers, crash/restart, and retention winning over a pending request.
- Emit/verify selected, deleted, failed, duration, and oldest-due metrics/alerts without answer-bearing labels.
- Prove restore filtering/no-resurrection: a deleted/tombstoned archive cannot regain payload, submissions, participant linkage, question snapshots, or aggregate data through application queries after controlled restore/reconciliation.
- Synchronize WBS/backend reference only after migrations, unit/integration/E2E, OpenAPI, and operational evidence pass with zero skip.

Risk is high and deletion is irreversible. Rollback means stop the worker or hide new navigation and forward-fix; never restore deleted answer-bearing data. Schema changes remain additive.

## Phase 3 — FE-6 transport and cache policy

After the backend contract is frozen:

- Extend `lib/api/types.ts` with archive status/reason/trigger/request enums, list/detail discriminated DTOs, deletion request/result types, and reuse existing `Page<T>` plus `SessionQuestionResults`.
- Add a role-separated archive namespace to `lib/api/query-keys.ts`; teacher/admin scope must be part of list/detail keys to prevent projection reuse across roles.
- Create `lib/api/archives.ts` with query options/hooks for list, detail, teacher request, admin pending queue, and request-bound confirmation. Reuse `apiRequest`, pass `AbortSignal`, use stable codes, and let existing mutation handling add cookies/CSRF/Origin.
- Add/reuse an auth step-up hook for `POST /auth/step-up`; password stays component-local, is never cached/persisted/logged, and is cleared after success/cancel/error/unmount.
- Use `retry: false`, short `staleTime`, finite short `gcTime`, no persistence, and no optimistic archive/deletion state.
- Teacher request success invalidates teacher detail/lists and admin queue. Admin deletion success first removes active archive detail queries across scopes, then stores/refetches only the returned tombstone and invalidates all archive lists/queue.
- Ensure login ownership changes and logout remove archive namespaces so another account cannot see stale archive data.

Tests modeled on `test/live-sessions-api.test.tsx` and `test/courses-api.test.tsx` must prove exact URL/body, query-key normalization, AbortSignal, CSRF mutation path, request ID forwarding, invalidation/removal, and no fabricated optimistic state.

## Phase 4 — Role-specific routes and shared presentation

Keep authorization shells separate; share presentation rather than weakening layouts.

Teacher routes:

- `/teacher/history`
- `/teacher/history/[liveSessionId]`

Admin routes:

- `/admin/results`
- `/admin/results/[liveSessionId]`
- `/admin/results/deletion-requests`

Each route follows current Next.js 16 pattern: Server Component page for metadata/awaited params/static shell, focused Client Component for React Query/interactions, plus accessible `loading.tsx`, `error.tsx`, and detail `not-found.tsx` where applicable. Add role-specific navigation links and corresponding layout tests.

Suggested feature structure:

- `features/archive-history/ArchiveListView.tsx`
- `features/archive-history/ArchiveDetailView.tsx`
- `features/archive-history/ArchiveStatus.tsx`
- `features/archive-history/TeacherDeletionRequestDialog.tsx`
- `features/archive-history/AdminDeletionConfirmDialog.tsx`
- `features/archive-history/PendingDeletionRequestsView.tsx`

Use `MyCoursesView` pagination/page-contraction behavior, `ErrorAlert`, `ConfirmDialog`, semantic lists/`dl`/`time`, `Asia/Taipei` display formatting, text labels in addition to color, and existing Tailwind conventions. No new dependency is needed.

## Phase 5 — Read UI (FE-6.2–6.4)

- Teacher list: owned archive sessions, authoritative Course filter, page size 20, newest-first, course/session labels, `closedAt`, `purgeAt`, state, detail link.
- Admin list: global archives, status filter, detail link, pending-request queue entry.
- Distinguish genuine empty page 1 from out-of-range page contraction and transport errors.
- Detail: render immutable ordered questions and archived aggregates only.
- Extract the pure rendering portion of `features/live-teacher/ResultPanel.tsx` into a reusable `SessionQuestionResultsView`; existing live `ResultPanel` remains the fetch/error container, while archive detail supplies embedded results directly.
- Open text remains plain React text; no HTML/Markdown execution, export, copy-all, participant grouping, or identity labels.
- Tombstone detail never mounts result components and shows only allowed deletion trigger/reason/time metadata.

## Phase 6 — Governance UI (FE-6.5–6.7)

Teacher:

- Accessible dialog requires a reason and explains whole-session scope, admin approval, irreversibility, and that submission is only a request.
- On authoritative success, show backend request receipt/pending state; never display “deleted” optimistically.

Admin:

- Queue displays only non-answer-bearing request context.
- Two-stage flow: review request, then enter current password for step-up and explicitly confirm the exact request.
- Keep mutation errors inside the dialog; `AUTH_STEP_UP_REQUIRED` reopens/requires step-up without altering archive state.
- On success, clear password and cached payload before rendering the tombstone.

No student navigation/routes, no direct teacher deletion, no partial deletion, no export/restore UI.

## Phase 7 — Verification and FE-6.8 acceptance

### Backend, smallest scope first

- Targeted governance/domain unit tests.
- Governance DB-backed E2E: multiple courses/sessions, filters/pagination/order, owner/admin/student matrix, active/deleted union, pending queue, request-bound confirmation, CSRF/Origin, step-up, retry/concurrency, exact retention boundary, and exhaustive prohibited-field assertions.
- OpenAPI response-shape assertions.
- Typecheck, lint, format check, build, unit, integration/E2E, migrate status, `git diff --check`.

### Frontend

- Transport/cache hook tests.
- Shared result renderer tests for all four question types, zero responses, correctness, ordering, and open-text escaping.
- List/detail/dialog tests for loading, empty, page contraction, 404 existence hiding, pending, retention tombstone, early-delete tombstone, keyboard/focus, stable errors, and no stale-payload flash.
- Route/layout tests for metadata, awaited params, one H1, loading/error/not-found boundaries, preserved `next` redirect, and mutually exclusive teacher/admin/student access.
- Typecheck, lint, focused Vitest, full Vitest, Next build/typegen, `git diff --check`.

### Real-backend Playwright

Create a dedicated FE-6 fixture/spec rather than modifying the dirty FE-5 fixture. Provision admin, two teachers, student/participants, representative poll/poll-multiple/quiz/open-text submissions, close the session, verify archive aggregate parity and owner isolation, submit a teacher request, require admin step-up, confirm by real request ID, and verify tombstones for both roles. Inspect actual JSON responses as well as DOM for prohibited fields. Refresh, logout/login, and browser-back must not resurrect payload. Add a controlled real retention case. Cleanup remains fail-closed, run-scoped, and aggregates all cleanup failures.

## Out of scope

- Student history
- Archive export/download or pre-delete backup
- Partial participant/answer/question deletion
- Restore UI, legal hold, custom retention, teacher retention extension
- Archive-specific Socket.IO events
- Broad audit portal or unrelated scheduler/design-system refactor

## Delivery checkpoints（每站須人工確認）

### Checkpoint 執行規則

- 每個 Checkpoint 完成後必須**停止後續實作**，整理「變更內容、diff 範圍、驗證命令與結果、未解風險、下一階段內容」交由使用者手動確認。
- 只有收到使用者明確的繼續指示，才能進入下一個 Checkpoint；測試通過、agent 結論或文件更新都不能視為人工批准。
- 若驗證失敗、契約改變或實作範圍超出本計畫，維持在目前 Checkpoint，先更新計畫與風險，不得自行跨站。
- destructive retention／early deletion 的真實資料操作需另外列出目標環境與資料安全證據；先取得該 Checkpoint 的人工批准再執行。

### Checkpoint 1 — BE-5 contract freeze

- 完成 DTO、course/status filters、request state machine、request-bound confirmation、tombstone、OpenAPI 與 targeted DB tests。
- **人工確認材料：** API/OpenAPI contract diff、migration/state-transition 說明、authorization/privacy matrix、targeted test report。
- **批准後才可進入：** BE-5 operational closeout。

### Checkpoint 2 — BE-5 operational closeout

- 完成 runner、dry-run、restart/concurrency、metrics/alerts 與 restore no-resurrection 證據。
- **人工確認材料：** worker 操作方式、dry-run 範例、deadline/concurrency/restart 結果、rollback/stop procedure、no-resurrection report。
- **批准後才可進入：** FE-6 frontend transport。

### Checkpoint 3 — FE-6 transport

- 完成 frozen types、role-separated query keys、archive/step-up hooks、cache eviction 與 transport tests。
- **人工確認材料：** frontend wire types、endpoint/body/query-key 對照、cache/privacy policy、targeted test report；此站不應出現產品 UI 或 mock fallback。
- **批准後才可進入：** FE-6 read UI。

### Checkpoint 4 — FE-6 read UI

- 完成 teacher/admin list/detail、shared result renderer 與 empty/not-found/active/pending/expired/deleted states。
- **人工確認材料：** teacher/admin route map、desktop/mobile 畫面或實際操作證據、accessibility/role boundary tests、未納入功能清單。
- **批准後才可進入：** FE-6 governance UI。

### Checkpoint 5 — FE-6 governance UI

- 完成 teacher request、admin pending queue、step-up 與 request-bound confirmation，以及刪除後 payload cache 清除。
- **人工確認材料：** destructive flow walkthrough、CSRF/Origin/step-up 證據、request idempotency、刪除前後 network/cache 差異、rollback 限制。
- **批准後才可進入：** FE-6 real-backend acceptance。

### Checkpoint 6 — FE-6 acceptance and closeout

- real-backend privacy/authorization/destructive-path browser matrix 必須為 0 failed／0 skipped，並確認既有 FE-5.4 work 未受影響。
- **人工確認材料：** WBS item → dedicated evidence matrix、backend/frontend verification bundle、Playwright report、privacy response inspection、cleanup 結果與所有 remaining gaps。
- 只有使用者人工確認後，才可勾選 FE-6.1–FE-6.8、更新 WBS closeout 或宣稱 FE-6 完成。
