# US-F0 CP5 → US-F1 Backend Contract → F1 Frontend 實作計畫

## Context

目前 US-F0 的 UI static implementation 與 Playwright spec 已完成，但 **real-backend acceptance 仍是 BLOCKED**：缺少隔離的 admin/teacher fixture、migrated browser DB、`CORS_ORIGIN=http://localhost:3001` 的 runtime gate，以及已授權的 authenticated mutating browser run。不能把 `--list`、skipped test、component tests 或既有 F16 evidence 當成 CP5 通過。

US-F1 的 canonical next story 是「老師管理 Course 生命週期」，但 backend 目前只有 Course draft/detail/archive 與 LiveSession 的基本生命週期；尚無完整的 LiveSession history、ArchivedResult、session-wide historical results、90-day retention、anonymization、tombstone 或 early-delete governance contract。因此採嚴格順序：

1. 完成 US-F0 CP5 real-backend Playwright acceptance。
2. CP5 通過且經使用者手動確認後，只做 backend F1 history/result-governance contract。
3. Backend contract 的 schema、OpenAPI、文件、DB-backed tests 與 gates 全部通過，並經使用者手動確認後，才開始 F1 frontend。

本計畫只描述執行方式；本輪不修改產品檔案、資料庫、環境檔或 runtime。

## Authoritative sources

- CP5：`docs/智學互動平台/50_實作與測試/US-F0 CP5 真實 backend Playwright 驗收計畫.md`
- F1 次序與 readiness：`docs/智學互動平台/50_實作與測試/US-F1 下一個 User Story 評估.md`
- F1 lifecycle：`docs/智學互動平台/10_需求蒐集/功能需求 BDD 場景.md`（US-F1）與 `P0 核心需求基線.md`
- 結果治理唯一來源：`docs/智學互動平台/10_需求蒐集/結果資料治理.md`
- M2 API/ER/realtime target：`docs/智學互動平台/30_系統設計/API 與共用 Schema 設計.md`、`資料模型與 ER 設計.md`、`即時同步與結果治理設計.md`
- Backend wire baseline：`smartLearning-backend/docs/frontend-api-reference.md`
- UI conventions：`smartLearning-ui/CLAUDE.md` / `AGENTS.md`、`lib/api/client.ts`、`lib/api/query-keys.ts`、`lib/api/types.ts`

## Scope and hard boundaries

### In scope

- CP5 真實 backend + browser acceptance 及 sanitized handoff。
- Backend F1 的 Course/LiveSession history query、session-wide/historical result contract、ArchivedResult 與結果治理所需的最小完整實作。
- 由 authoritative docs 定義的權限、匿名化、retention、early deletion、tombstone 與 archived-course write rejection。
- F1 frontend 只在 backend gate 通過後實作，且只使用已確認的 API contract。

### Explicitly out of scope

- CP5 之前或 backend gate 之前的任何 F1 frontend、mock、placeholder、local-only lifecycle state 或自行推導 DTO。
- F9 題目流程、Course delete/restore/name PATCH、結果匯出、custom retention、legal hold、刪除後 restore。
- 以 `down -v`、truncate、arbitrary row delete 或 reset dirty working tree 代替隔離清理。
- 本計畫不新增 R-1 durable outbox/replay 或 R-4 auto-close scheduler；backend close/archive path 要可供未來 scheduler 重用，scheduler 另立 scope。

## Checkpoints and execution order

### Checkpoint 0 — CP5 non-mutating preflight

**目的：** 在任何 authenticated mutation 前證明 runtime/source/contract 條件正確。

1. 分別記錄 backend 與 UI repository 的 `git status --short`、`git diff --name-only`；backend 現有 dirty F8/Phase-B 變更不得 reset、staged 或混入 UI diff。
2. 從 live backend probe：
   - `/health/live`
   - `/health/ready`
   - `/api/docs`
   - `/api/docs-json`
3. 核對 live OpenAPI、目前 controller/DTO 與 `frontend-api-reference.md` 的 Course、admin permission、auth/session contract；確認 runtime 是目前 checked-out source build，而非 stale image。
4. 準備一次性、隔離的 CP5 Compose project/fresh volume、migrated DB、backend `3000`、UI `3001`，runtime `CORS_ORIGIN` 精確為 `http://localhost:3001`。不得修改 `.env.test` 作 workaround；它的 CORS 是 supertest 用的 `localhost:3000`。
5. 檢查八個必要的 process-only fixture variables：`F0_API_BASE`、`F0_UI_ORIGIN`、`F0_ADMIN_USERNAME`、`F0_ADMIN_PASSWORD`、`F0_TEACHER_ACCOUNT_ID`、`F0_TEACHER_USERNAME`、`F0_TEACHER_PASSWORD`、`F0_COURSE_NAME_PREFIX`。帳密、cookie、CSRF、raw token 不得進 source、task log、trace、console 或 chat。

**Exit criteria：** 所有服務、migration、OpenAPI、CORS、source/runtime parity 與 fixture prerequisites PASS；否則狀態為 `BLOCKED`，不進入 mutating browser。

**Manual confirmation 1：** 由使用者確認隔離 runtime 與 fixture 已準備完成，並明確授權下一步的 authenticated Course create/archive/permission mutation。未確認前停止。

### Checkpoint 1 — US-F0 CP5 real-backend Playwright acceptance

**原則：** 重用現有 CP5 spec 與 runner，不修改 F0 product source、Playwright config、runner、dependency 或 backend source；只有真實 browser reproduction 證明 CP4 defect 時才停止並重新規劃。

1. 使用既有 `smartLearning-ui/test/browser/us-f0-course-flow.spec.ts` 與 `test/browser/run.mjs`。
2. 保留兩個獨立 `browser.newContext()`：admin context 與 teacher UI context；使用 context-bound request，不假設 standalone request fixture 共用 cookies。
3. 驗收完整 flow：
   - 390×844、reduced-motion、keyboard/focus/ARIA、無水平溢出。
   - teacher login → `/courses/new` → 真實 POST `201`。
   - request body keys 僅 `name`/`description`；確認 exact Origin、CSRF header、session cookie。
   - 從 response envelope `data.id` 導向 `/courses/<server UUID>`，reload 後以真實 GET 證明 `draft`、`ownerAccountId`、唯一老師語意。
   - 缺 CSRF 與錯 Origin 均 `403 AUTH_CSRF_INVALID`，Course ID 集合不增加。
   - admin UI revoke `canCreateCourse` 後，保留 stale teacher session 再提交，取得 `403 FORBIDDEN`、curated error、URL 不導向 detail 且無新 row。
4. `finally` 只 archive 本次 exact UUID、還原原 permission、logout 兩個 context；任何 cleanup/teardown failure 都使 CP5 為 `BLOCKED`。
5. 保存 sanitized report：只記錄 command、HTTP status/stable code、fixture scope、Course UUID scope 結果與 cleanup status，不保存 secrets/raw token/raw backend message。

**Verification order（UI repo）：**

```bash
npx next typegen
npm test -- test/course-create-form.test.tsx test/course-detail-view.test.tsx test/course-detail-route.test.tsx
npm run typecheck
npm run lint:check
npm run build
git diff --check
npm test
node test/browser/run.mjs --list
node test/browser/run.mjs --workers=1 test/browser/us-f0-course-flow.spec.ts
```

**CP5 PASS 必須同時具備：** real browser flow、CSRF/Origin negatives、stale-session authorization、a11y/responsive smoke、static/full gates、scoped cleanup 全部 evidence。缺 fixture、skipped test、服務、CORS、migration、cleanup 或任一 gate 時只記 `BLOCKED`，不得宣稱完成。

**Manual confirmation 2：** CP5 handoff 寫入 `smartLearning-ui/tasks/todo.md` 前後，由使用者確認 CP5 acceptance matrix 為 `completed`。若為 `BLOCKED`，只修復 CP5 blocker 並重新過本 checkpoint；不得開始 F1 backend。

### Checkpoint 2 — F1 backend contract freeze（先定契約，再改 schema）

**目的：** 在高風險資料治理實作前，讓 route、DTO、權限與不可逆語意可審核、可測試、可被 frontend 直接使用。

需依 M2 target 與現有 route naming 凍結一套 canonical API，不重複建立互相矛盾的 alias。推薦契約方向：

- `GET /api/v1/live-sessions`：依 Course、日期範圍、狀態分頁查詢歷史場次，時間倒序；teacher 只看 owned Course，admin 可依管理職責跨平台查詢。
- `GET /api/v1/results`：ArchivedResult 分頁/篩選索引，回傳 `closedAt`、`purgeAt`、retention/deletion status 等 summary metadata。
- `GET /api/v1/results/:liveSessionId`：單一場次的 immutable archived snapshot、匿名 raw answers 與 aggregate；不含 display name、participant token、account identity linkage。
- `POST /api/v1/results/:liveSessionId/deletion-requests`：Course teacher 提出整場 early-delete request。
- `POST /api/v1/admin/results/:liveSessionId/deletion`：admin 經 step-up、明確確認與固定原因執行整場不可逆刪除。
- 若 M2/live-session consumer 需要 `/live-sessions/:id/results` 作為 session-wide result route，需在本 checkpoint 明確選定它與 `/results/:id` 的唯一 canonical/compatibility 關係，不能讓 frontend 自行猜測。

Contract freeze 必須明確寫下：

- Course `draft → archived` terminal lifecycle；archived 不可編輯、建場、改題，但歷史仍可查，MVP 不 delete/restore。
- archive 與 `waiting|active` LiveSession 的鎖定與 race 語意。
- `active → cancelled` 的現況與 P0 衝突：依 authoritative P0 建議收斂為 cancellation 僅適用於未 active 且無 Submission；cancelled 不建立 ArchivedResult。既有 active-cancel test/contract 必須在此決策後同步。
- close 的 linearization point、archive 建立是否同一 transaction、idempotency/retry semantics。
- `closed_at + 90 days` 固定 retention；Course archived、teacher disabled、query 或 backup 不延長。
- cancelled 且從未收集 Submission 不形成 ArchivedResult。
- expired/deleted 結果只回最小 tombstone/status，不能因 restore/backup 重新出現內容。
- teacher/admin/student 的查詢範圍；student 無歷史入口；disabled teacher 無法查詢。
- open-text 只提供匿名內容；刪除事件不得含 prompt/options/correct answer/open text/display name/token/aggregate。

**Manual confirmation 3：** 使用者確認上述 canonical routes、DTO 欄位、active-cancel 決策與 retention/deletion semantics 後，才允許 backend schema/migration 實作。

### Checkpoint 3 — Backend archive authority and additive persistence

**目標：** 讓 closed session 有唯一、不可變、可治理的歷史結果 authority。

1. 以 additive migration 擴充 `prisma/schema.prisma`，新增與 M2 對齊的 `ArchivedResult`、deletion request/event/tombstone state、retention deadline/index/job state；使用 app-generated UUID v7、UTC `TIMESTAMPTZ`、`TEXT + CHECK`、必要 unique/index，不寫 destructive down migration。
2. 明確保存 `LiveSession`/`Course` metadata、immutable SessionQuestion snapshot、匿名 raw Submission 與 aggregate；保存 `closedAt` 與 `purgeAt = closedAt + 90d`。
3. 在 `LiveSessionService.closeSession` 或共享 close/archive application command 中，以 `TransactionService` 鎖定正確 aggregate，完成：freeze questions/submissions → 建立一次 ArchivedResult → 解除/刪除 participant display-name/token/account 與答案的 application-queryable linkage → commit；重試不得產生第二份 archive。
4. 保持 realtime publish post-commit、fire-and-forget；archive 建立失敗不得讓已 commit 的 mutation 產生半成品。若 close/archive 需要拆成 follow-up，必須先在 Checkpoint 2 定義可見性與 retry/repair contract，不允許短暫無權威歷史結果卻宣稱 closed 完成。
5. 將既有 `closeSession`、`cancelSession`、per-question aggregate 與 clock abstraction 接到新 authority；不把目前只做 projection-level redaction 的結果 DTO 誤當 archive anonymization。

**資料安全驗證：** archive query 不能透過 participant/submission join 回推出 display name、token hash、account ID；不以只檢查 response DTO 的測試代替 storage/query negative test。

### Checkpoint 4 — History query and result-governance operations

1. 新增 bounded-context module（沿既有 `src/modules/<feature>/{api,application,domain}` pattern），包含 controller、DTO、domain validation、service、mappers、guards 與 OpenAPI。
2. 實作 history/result queries：ownership/admin scope、Course/LiveSession/date/status filters、stable descending order、page/pageSize、closed/purge metadata、deleted/expired minimal status；non-owner 依既有 existence-hiding convention，不洩漏 Course/session。
3. 實作 retention command/worker 的 bounded claim、retry、idempotency、failure status/metrics；先支援 dry-run/count/sample，再啟用 destructive delete。到期刪除內容與 identity linkage，只留下最小 `DeletionEvent`/tombstone。
4. 實作 teacher request → admin step-up confirm 的 early-delete flow；範圍永遠是整個 LiveSession archive，重送 idempotent，不支援單一 participant/answer delete、restore 或 export。
5. 對所有既有 Course write path（course update/題目 CRUD/reorder、LiveSession create/start/open/close/cancel 等）加上 archived rejection regression；確認 archive/close concurrency 依 server commit order 線性化。
6. 更新 `docs/frontend-api-reference.md`、Swagger decorators/OpenAPI e2e assertions，明確記載 envelope、CSRF/Origin、stable errors、pagination、retention/deletion statuses，禁止用 target doc 尚未落地的欄位冒充完成。

### Checkpoint 5 — Backend contract gate（F1 frontend 的硬閘）

**Targeted tests：**

- archive snapshot/aggregate/anonymization/retention date/deletion event pure unit tests；fake clock 覆蓋 90-day boundary。
- DB integration tests：migration、close/archive consistency、transaction retry/idempotency、owner/admin scope、filters/pagination/order、archived-course writes、cancelled-no-archive。
- E2E tests：完整 teacher/admin history/result/delete lifecycle、disabled teacher、step-up、tombstone/no resurrection、race matrix（archive vs waiting/active、submit vs close）。
- OpenAPI/reference contract tests：實際 route、status、DTO envelope、stable error code 與 docs 一致。

**Backend verification bundle（依環境權限由小到大）：**

```bash
npm run prisma:generate
npm run prisma:migrate:status
npm run typecheck
npm run lint:check
npm run format:check
npm run build
npm test
npm run test:e2e -- <targeted-history-governance-files>
npm run test:integration -- <targeted-history-governance-files>
git diff --check
```

DB-backed tests 只能使用 `test/setup/db.ts` 保護的 `smartlearning_test`，或明確建立一次性隔離 DB；先取得 migration 授權，不能對未知 database 執行 deploy/truncate。產出 sanitized route/status/count evidence、migration status、OpenAPI diff 與 test report。

**Backend PASS 必須同時具備：** schema/migrations 可部署、close/archive authority、history/result/deletion API、privacy/retention/race tests、OpenAPI、frontend reference、typecheck/lint/format/build/unit/integration/e2e/diff gates 全部通過。任何未完成 governance 項目只能標 `BLOCKED`，不能先交 UI。

**Manual confirmation 4：** 使用者審閱 backend contract diff、migration safety、sanitized test evidence 與 rollback plan，明確確認 backend gate PASS；未確認前禁止建立 F1 frontend route/hook/type/component。

### Checkpoint 6 — F1 frontend implementation（backend gate 後才可開始）

在 `smartLearning-ui` 只使用 Checkpoint 2/5 凍結的 API：

1. 擴充 `lib/api/types.ts`、`lib/api/query-keys.ts`，新增 live-session history/result/deletion DTO 與 stable error mapping。
2. 新增 `lib/api/live-sessions.ts`、`lib/api/results.ts`（或依既有命名合併至 `courses.ts`），沿用 `apiRequest`、credentials、exact Origin/CSRF、React Query v5、non-optimistic mutation、success 後 invalidate/refetch。
3. 新增 teacher `/courses` 分頁列表、Course lifecycle detail、不可逆 archive confirmation、archived read-only view、session history/result projections、retention/tombstone display；不新增 backend 未確認的欄位或行為。
4. 遵循既有 route guards、`ErrorAlert` stable-code mapping、loading/empty/error 狀態與 accessibility patterns；不以 local state 取代 server authority。
5. 補 focused component/transport tests，再補 real-backend Playwright acceptance；不以 mock endpoint、MSW 或 fixture server 取代。

**Manual confirmation 5：** F1 frontend static/real-backend acceptance 完成後，由使用者確認 UI acceptance matrix 與 handoff，才結束本輪。

## Critical files and expected change pattern

### CP5（UI test/handoff/runtime only）

- `smartLearning-ui/test/browser/us-f0-course-flow.spec.ts`（已存在，優先重用）
- `smartLearning-ui/test/browser/run.mjs`（只重用，不預期修改）
- `smartLearning-ui/tasks/todo.md`（只追加 sanitized CP5 result）
- `smartLearning-ui/features/courses/*`、`lib/api/client.ts`、`features/admin/AccountDetailView.tsx`（只作 browser defect diagnosis，不預期修改）

### Backend F1

- `prisma/schema.prisma`、新增 additive migration、`generated/prisma`（依既有 Prisma 生成/normalize workflow）
- `src/modules/live-sessions/application/live-session.service.ts`、`domain/live-session-status.ts`、既有 close/cancel e2e tests
- `src/modules/live-sessions/api/dto/*`、`src/modules/participants/api/participants.controller.ts`、既有 result aggregation/projection
- 新增 results/history governance module，沿 `src/modules/<feature>/api/application/domain`
- `src/common/clock/clock.ts`、`src/prisma/transaction.service.ts`、auth/step-up/role guards、Pino redaction
- `docs/frontend-api-reference.md`、OpenAPI e2e tests、`tasks/todo.md`/`tasks/lessons.md`（只在實作與驗證後記錄）

### F1 Frontend（gate 後）

- `smartLearning-ui/lib/api/types.ts`
- `smartLearning-ui/lib/api/query-keys.ts`
- 新增/擴充 `lib/api/live-sessions.ts`、`lib/api/results.ts`
- `app/(teacher)/courses/page.tsx`、`app/(teacher)/courses/[courseId]/page.tsx`
- `features/courses/*`、新增 history/result views、focused tests、browser spec

## Risk, rollback, and operational safeguards

- **Risk level：high** — authentication/authorization、個資去關聯、不可逆刪除、retention job、migration 與 race semantics。
- Migration 採 expand-first/additive；不依賴 production down migration。若 app rollback，保留向後相容的新欄位/表，必要時用 forward-fix；不要還原或復活已刪資料。
- retention/early-delete 在 staging 先 dry-run/count/sample；job 必須 bounded、claimed、retry-safe、idempotent，並提供 failure metrics/alert。
- archive/early-delete endpoints 與 worker 在 contract tests 未通過前不啟用；保留唯一 archive/tombstone ID 供修復，不做 broad cleanup。
- CP5 rollback 只移除本次 CP5 spec/handoff，不能 reset backend dirty source、刪既有 domain rows 或拆原有 volume。
- 監控訊號：archive create duplicate/conflict、close/archive failure、retention due/success/failure、tombstone/no-resurrection、403/404 scope rejection、query latency、敏感欄位 redaction scan。

## Dependencies and environment

- Node.js 24+、PostgreSQL、Prisma 7；backend/UI 是兩個獨立 git repositories。
- CP5：backend `3000`、UI `3001`、isolated fresh DB/Compose、exact `CORS_ORIGIN=http://localhost:3001`、Chromium/Playwright 1.62.1、八個 `F0_*` process variables。
- Backend DB-backed verification：只對明確的 `smartlearning_test` 或新建隔離 DB 做 migration；遵守 `test/setup/db.ts` 的 database guard。
- Secrets 只經 process environment/fixture provisioning 傳遞；不得寫入 source、task log、trace、console 或 chat。
- Backend current worktree 有未提交 F8/Phase-B 變更；每個 checkpoint 都要保留 status/diff scope，避免 source/runtime mismatch。

## Handoff and result records

每個 checkpoint 完成後只記錄 sanitized evidence：scope、變更檔、commands、PASS/FAIL/BLOCKED、最小 status/code/count、fixture/cleanup 結果、風險與 rollback。CP5 結果追加至 UI `tasks/todo.md`；F1 backend 結果追加至 backend `tasks/todo.md` 與必要 `tasks/lessons.md`。本計畫不在 approval 前修改上述檔案。

## Definition of done

- [ ] CP5 real-backend Playwright acceptance 是 `completed`，不是 skipped/static-only；cleanup 與 no-row invariants 有 evidence。
- [ ] F1 backend history/result/governance contract 已凍結、實作、文件化，且有 migration、OpenAPI、unit/integration/e2e、privacy/retention/race evidence。
- [ ] Backend gate 經使用者手動確認後才開始 F1 frontend。
- [ ] F1 frontend 僅依 confirmed backend contract，無 mock/local authority，並完成 static + real-backend acceptance。
