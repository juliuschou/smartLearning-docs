# US-F16 實作計畫：開課授權旗標

## Context

US-F16 的規格要求管理員能在帳號詳情頁切換 `canCreateCourse`，且由後端權威決定建課權限；切換不得刪除既有課程／題目／歷史結果，也不得等同停用帳號或撤銷既有 CLI credential。目前工作樹只完成建立帳號時設定旗標：backend 沒有權限更新 endpoint，UI 也沒有 F8 所假定的帳號列表／詳情頁。因此不能直接新增前端 switch，否則會違反規格「不得捏造 endpoint／local-only toggle」與安全邊界。

使用者已選擇先補齊 backend 契約，再完成前端與真實端到端驗收。本方案採最小垂直切片：先在既有 AccountService/AdminController 上新增單一欄位的權限 mutation，再補足必要的唯讀帳號列表／詳情承載頁，最後接入 accessible switch；不實作 disable／restore、CLI credential 管理或 F0 建課頁。

## 已確認的現況與不變條件

- `smartLearning-backend/src/modules/identity/api/admin.controller.ts` 已有 admin account list/detail/create/disable/restore/CLI routes，但沒有 permission update route。
- `smartLearning-backend/src/modules/identity/application/account.service.ts` 已有 transaction、row-lock、AccountDto projection；`Account.canCreateCourse` 欄位與 migration 已存在，不需 schema migration。
- `smartLearning-ui/lib/api/accounts.ts` 只有 `useCreateAccount`；`lib/api/query-keys.ts` 已有 `accounts.all/detail` key，但尚無查詢使用者。
- UI 目前只有 `app/(admin)/admin/accounts/new/page.tsx`；F8 所假定的 account detail route 尚不存在，需補最小唯讀承載頁才能讓 F16 可操作。
- CSRF/Origin 由既有 `apiRequest(..., { mutate: true })` 自動附加；前端不直接處理 cookie/session token。
- `canCreateCourse=false` 只阻止新建 Course；不撤銷既有 Course、題目、結果或 CLI credential。學生帳號永遠不可被授予此旗標。
- 依現有 `tasks/todo.md`，StepUpDialog/useStepUp 原本延後至 F8；本切片的 permission route 使用 Session + CSRF + Admin，不把 F16 偷換成 disable/credential 的 step-up 流程。若後續安全契約要求 step-up，需另開契約變更，不在本次默默加入。

## Checkpoint A — 先建立並驗證 backend 契約

### 正式契約（本次採用）

- **Method/path**：`PATCH /api/v1/admin/accounts/:id/permissions`，`:id` 為 UUID。
- **Guards**：`SessionGuard + CsrfGuard + AdminGuard`；不可由 teacher/student 呼叫。
- **Request body**：`{ "canCreateCourse": boolean }`，只允許此欄位；全域 validation 啟用 whitelist/forbid unknown fields。
- **Success**：HTTP `200`，回既有 `AccountDto`，外層仍為 `{ data, meta, error: null }`。
- **Failure**：
  - 未登入 → 現有 401 認證錯誤。
  - CSRF/Origin 不符 → `403 AUTH_CSRF_INVALID`。
  - 非 admin → `403 FORBIDDEN`。
  - 不存在或 malformed UUID → existence-safe `404 NOT_FOUND`／既有 UUID validation error。
  - body 非 boolean 或含未允許欄位 → 既有 `VALIDATION_FAILED` transport error。
  - target 為 student 且要求 `true` → `403 FORBIDDEN`；student 維持 false。
- **Target scope**：admin/teacher 可被切換；既有 account status 不被此 mutation 改動。更新自己或其他帳號均不觸發 disable/restore。
- **Persistence semantics**：在 `TransactionService.run()` 中對 Account `FOR UPDATE`，只更新 `canCreateCourse`；同值更新為安全 no-op/同一 DTO 回應。
- **Side effects**：不得 revoke WebSession、CLI credential、unused token；不得修改 Course、Question、LiveSession、result。後續請求重新讀 Account 時即取得新旗標，`POST /courses` 仍是建課授權的唯一 server authority。

### Backend 實作與測試

1. 新增 `src/modules/identity/api/dto/update-account-permissions.dto.ts`（`@IsBoolean()` + Swagger property）。
2. 在 `admin.controller.ts` 加 `@Patch('accounts/:id/permissions')`，使用 `ParseUUIDPipe`、上述 DTO 與 `toAccountDto`；不得把 Prisma 操作放進 controller。
3. 在 `account.service.ts` 新增 `updateCourseCreationPermission(targetAccountId, canCreateCourse)`：row lock、存在性檢查、student invariant、單欄位更新。
4. 更新 `smartLearning-backend/docs/frontend-api-reference.md` 的 admin account contract，讓 frontend contract 有正式可引用的 path/body/status/error/side-effect 說明。
5. 在 `test/account-admin.e2e-spec.ts`（或同一 bounded context 的新 F16 e2e）加入：
   - admin 可將 teacher true→false→true，response/status/DTO 正確；同一 teacher 的後續 `POST /courses` 在 false 時穩定 403、無新 Course，在 true 時可建課。
   - teacher/student/non-admin、缺 CSRF、invalid body、unknown account 均拒絕且不變更資料。
   - toggle 前後既有 Course/Question/歷史資料與已建立 CLI credential 均保留/有效；不可觸發 disable/revoke。
   - 同時涵蓋 student cannot be granted true，以及重複同值 mutation 的穩定行為。
6. 更新 OpenAPI e2e assertion，確認新 PATCH path 出現在 `/api/docs-json`；不新增 schema migration。

**Checkpoint A exit criteria**：backend typecheck/lint/format/build、targeted unit/e2e 與 contract/OpenAPI tests 通過；真實 `smartlearning_test` migration、health 與 endpoint 可呼叫。任何契約與上述定義不符時停止，不進入 frontend。

## Checkpoint B — 最小前端承載與 mutation

### API/query layer

- `lib/api/types.ts`：新增 `UpdateAccountPermissionsPayload`（必要時以 `AccountDto` 作 response，不用 `any`/空物件）。
- `lib/api/accounts.ts`：新增 `useAccounts(page/pageSize)`、`useAccount(accountId)` GET hooks，以及 `useUpdateAccountPermissions` mutation；mutation 嚴格呼叫 `/admin/accounts/${id}/permissions`、`PATCH`、body `{ canCreateCourse }`、`mutate: true`。
- 成功時以回傳的 `AccountDto` 作 canonical state：更新 `queryKeys.accounts.detail(id)`、invalidate `queryKeys.accounts.all`；若 target 是目前 session，再 invalidate 既有 `queryKeys.session`，避免自身建課入口使用過期旗標。失敗不得留下 optimistic/local-only 成功狀態。
- `lib/api/error-messages.ts` 只補必要的穩定碼顯示（例如 `NOT_FOUND`），不顯示 backend raw message。

### F8 最小唯讀承載（僅為 F16 可用）

- 新增 `features/admin/AccountsListView.tsx`：分頁 `Page<AccountDto>`、loading/error/empty/data 狀態；每列連至詳情。不得加入 disable/restore/CLI controls。
- 新增 `features/admin/AccountDetailView.tsx`：讀取 server AccountDto，顯示 metadata 與權限區塊；錯誤用共用 `ErrorAlert`。
- 新增 routes：
  - `app/(admin)/admin/accounts/page.tsx`
  - `app/(admin)/admin/accounts/[accountId]/page.tsx`
  動態頁遵循 Next.js 16 async `params`／generated route typing；不在 server component 猜測或硬編帳號資料。
- `app/(admin)/admin/page.tsx` 保留「建立帳號」，另加「管理帳號」入口；不改既有 admin gate。

### Accessible switch

- 在 `AccountDetailView` 使用原生 checkbox/switch semantics（`role="switch"`、`aria-checked` 或等效原生控制）、明確 label/description、可鍵盤操作、focus ring、更新中 disabled、成功/失敗以文字與 `aria-live` 告知，不只依賴顏色。
- 初始 checked 永遠來自 `AccountDto.canCreateCourse`；mutation 成功後以 query refetch/server DTO 為準。切換失敗復原並顯示穩定 error，不把 browser input 狀態當權威。
- student 顯示唯讀「學生不可開課」狀態或隱藏控制（依既有 DTO invariant）；admin/teacher 才可操作，且不可用 UI 隱藏取代 server authorization。

## Checkpoint C — 回歸覆蓋與真實流程

### Frontend tests

- `test/account-detail-view.test.tsx`：server 初始值、loading/error、keyboard/ARIA/focus、更新中防重複提交、成功 refetch/invalidation、失敗復原與 stable error、student invariant。
- `test/accounts-list-view.test.tsx`：Page 解包、empty/error、detail links。
- `test/admin-home.test.tsx`：管理帳號入口與既有建立帳號 CTA 不退化。
- 若引入 hook-specific behavior，補最小 `lib/api/accounts` mutation assertion；測試在 `apiRequest` boundary mock，不造假 endpoint response 來宣稱整合完成。

### Real backend/browser acceptance

- 修正現有 Playwright wiring：`playwright.config.ts` 指向的 `test/browser/` 目前不存在，`package.json` 的 `test:browser` 也指向不存在的 runner；補 `@playwright/test`（若 package lock 尚未提供）與可重複的 F16 spec/runner。
- 新增 `test/browser/us-f16-account-permission.spec.ts`，以真實 backend fixture/測試帳號驗證：
  1. admin 登入 → 帳號詳情 switch 初始值與 server 一致；
  2. 啟用 teacher flag → 重新讀取後為 true → teacher 真實 `POST /courses` 成功；
  3. 移除 flag → 重新讀取後為 false → 相同 teacher 的 `POST /courses` HTTP 403 且資料筆數不增加；
  4. toggle 前後既有 Course/Question/result 與 CLI credential 未被刪除/撤銷；
  5. 瀏覽器 keyboard/focus/ARIA smoke，無色彩唯一狀態提示。
- Fixture 必須使用隔離、可清理的帳號／course／credential，不在測試中輸出密碼、raw token、cookie 或完整 payload。

## 驗證順序與命令

1. Backend（先於 UI）：targeted F16 e2e → identity unit → `npm run typecheck` → `npm run lint:check` → `npm run format:check` → `npm run build` → OpenAPI/DB migration status → `git diff --check`。
2. Frontend：`npx next typegen` → targeted Vitest → `npm run typecheck` → `npm run lint:check` → `npm run build` → `git diff --check`。
3. Backend/Frontend 真實整合：backend health/migrations/CORS (`http://localhost:3001`) → `npx playwright test test/browser/us-f16-account-permission.spec.ts`；最後才擴大既有 unit/e2e suites。
4. 交付報告採專案要求的 structured test-subagent summary：command、scope、PASS/FAIL/BLOCKED、最小錯誤證據、diagnosis、verification confidence；驗收矩陣每項標記 `Completed`、`Blocked` 或 `Not applicable`，不得用 `Partial`。

## 風險、回滾與交付

- **風險等級：高**（authorization boundary、跨 backend/frontend、真實資料保留與 credential side effects）。
- **回滾**：先回滾 UI mutation/switch/routes，再回滾 backend PATCH/DTO/service/tests/docs；保留既有 account create、disable/restore/CLI code。無 schema migration，故不需資料回滾。
- **停止條件**：任何 route/body/status/error 不一致、server 403 未穩定、query 未重新取得、Course/Question/result/CLI credential 受影響、或只能靠 mock/placeholder 通過時，維持 `Blocked` 並停止交付。
- 實作開始後需在 `smartLearning-ui/tasks/todo.md` 建立本次 checklist（含 Dependencies、Risk & Rollback、Working Notes、Results）；若發生 correction，依規範補 `tasks/lessons.md`。

## Critical files

**Backend**
- `src/modules/identity/api/admin.controller.ts`
- `src/modules/identity/api/dto/update-account-permissions.dto.ts`（new）
- `src/modules/identity/application/account.service.ts`
- `test/account-admin.e2e-spec.ts` / OpenAPI contract test
- `docs/frontend-api-reference.md`

**Frontend**
- `lib/api/types.ts`
- `lib/api/accounts.ts`
- `lib/api/query-keys.ts`
- `lib/api/error-messages.ts`
- `features/admin/AccountsListView.tsx`（new）
- `features/admin/AccountDetailView.tsx`（new）
- `app/(admin)/admin/accounts/page.tsx`（new）
- `app/(admin)/admin/accounts/[accountId]/page.tsx`（new）
- `app/(admin)/admin/page.tsx`
- `test/account-detail-view.test.tsx` / `test/accounts-list-view.test.tsx` / `test/browser/us-f16-account-permission.spec.ts`（new）
- `package.json`/lockfile only if Playwright test runner wiring requires it
