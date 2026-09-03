# US-F8 — 帳號停用與 credential 失效

## Context

US-F7 已完成登入、登出、強制／自願變更密碼與 session rotation；`tasks/todo.md` 明確把可重用的 `StepUpDialog`／`useStepUp` 留給 F8。US-F8 的目標是讓管理員停用帳號時，帳號所屬的 Web Session、CLI credential、未使用的帳號驗證 token 與既有 teacher/admin Socket 即時失效，同時保留 Course、LiveSession、Submission、結果與稽核資料；恢復後只能重新登入／重新簽發 credential，不能復活舊 credential。

目前 backend 已有 transactional `POST /api/v1/admin/accounts/:id/disable|restore`、session/CLI/validation-token 清理與基本 e2e，但沒有帳號 list/detail 契約，teacher Socket 只在 handshake 授權，且仍有 disabled account 發 CLI key 與 batch/CLI 競態的缺口。UI 只有建立帳號頁，沒有 F8 route、step-up dialog 或 credential metadata/revoke UI。因此本 Story 必須採 **backend gate → realtime hardening → frontend vertical slice → real-backend regression**，不能用 mock endpoint 或 client-only 狀態假裝完成。

## Authority、範圍與決策

- 需求權威：
  - `docs/智學互動平台/10_需求蒐集/P0 核心需求基線.md` §P0-03
  - `docs/智學互動平台/20_系統分析/功能需求規格 SPEC.md` §US-F8（R-F8-1..6）
  - `docs/智學互動平台/10_需求蒐集/功能需求 BDD 場景.md` §US-F8
  - 技術邊界：`docs/智學互動平台/30_系統設計/Web Auth 與安全設計.md`、`smartLearning-backend/docs/frontend-api-reference.md`
- 實際 runtime contract 使用 `POST .../disable` 與 `POST .../restore`；不依照較寬泛 catalog 的 `PATCH /admin/accounts/{id}` 自行發明 API。
- 帳號 list/detail 必須先由 backend 定義並以 `AccountDto`／分頁 envelope 公開，admin-only、metadata-only，不回傳 password/hash/token/raw key；UI 顯示所有目前實際存在的 persisted roles（包含 student），但不藉此擴大 student 專屬功能。
- 停用的 credential 範圍明確化為：所有 active WebSession、active `CliCredential`、該 account 未消費的 `QuestionValidationToken`，以及 account-bound participant 的 HTTP/Socket 授權；獨立的匿名 participant token 沒有 `accountId`，維持 session-scoped、不可因別的 Web account 停用而被撤銷。
- restore 只把 `disabled → active`；舊 session、已 revoked CLI key、已 consumed validation token 不復活。
- **已確認：本期不實作完整 account-level CLI security lock。** 目前 schema／runtime 只有 `active|revoked`，沒有 lock/expiry/rotation/pending/disabled model 或 endpoint；不以 `canCreateCourse=false` 冒充 lock（M2 已定案該旗標不撤銷 CLI）。R-F8-4 的 lock scenario 另立故事，待補齊 schema + API + guard + audit contract 後再驗收；本 Story 只保留 Web account disable 與 CLI credential invalidation 的明確分離。

## 既有可復用資產

- Backend lifecycle：`src/modules/identity/api/admin.controller.ts`、`src/modules/identity/application/account.service.ts`、`src/common/auth/session.service.ts`、`src/common/auth/step-up.guard.ts`、`src/modules/identity/application/cli-credential.service.ts`。
- Backend transaction／lock：`src/prisma/transaction.service.ts`；沿用 account row lock、advisory lock 與 commit 作為線性化點，不在 controller/raw Prisma 另寫鎖。
- Backend DTO／分頁：`src/modules/identity/api/dto/account.dto.ts`、`src/common/pagination` 的 `Page`／`normalizePageRequest`／`toPage`，參照 `courses.controller.ts`／`course.service.ts`。
- Realtime：`src/modules/realtime/live-session-event-bus.ts` 的 post-commit、listener isolation、fire-and-forget 模式；`LiveGateway` 現有 participant reauthorization 可作 account-bound socket 的基礎。
- Frontend：`lib/api/client.ts`（credentials、CSRF、Origin、envelope unwrap）、`lib/api/query-keys.ts`、`lib/api/accounts.ts`、`lib/api/auth.ts`、`lib/auth/session.ts`、`components/ui/Field.tsx`、`components/ui/ErrorAlert.tsx`、`features/auth/ChangePasswordForm.tsx`、`app/(admin)/layout.tsx`。

## 實作 checkpoints

### A — Backend contract 與 lifecycle hardening

1. 在 `AdminController`／identity application／DTO／API reference／OpenAPI assertion 補：
   - `GET /api/v1/admin/accounts`：最小必要的 paginated `Page<AccountDto>`（沿用既有 page/pageSize 規範；若需要搜尋，先把 username/displayName 的 filter 形狀寫入 contract）。
   - `GET /api/v1/admin/accounts/:id`：同一個 safe `AccountDto` projection。
   - list/detail 只允許 admin，未知或格式錯誤 ID 走既有穩定錯誤／不洩漏敏感資料。
2. 強化 `AccountService.disableAccount`／`restoreAccount` 的既有 transaction，不改資料刪除語意：保留 domain rows，並把 cleanup 視為同一 transaction 的原子結果。補 `CliCredentialService.createCredential` 的 active-account check，禁止對 disabled account 簽發可在 restore 後復活的 active key。
3. 對需要寫入的 credential-bound paths 做最小競態修補：在 batch validation token 建立／confirm、CLI authentication／使用與其他 account-owned write 的 transaction 內重新檢查 account status、credential status、token 未消費狀態，讓 disable commit 與使用 commit 有明確先後；不要只依賴 guard 在 transaction 外的一次檢查。保留 idempotency 與現有 error code。
4. 新增／更新 backend integration/e2e：兩個 Web session、CLI key、未消費 validation token、disabled target 發 key、restore 不復活舊 credential、domain rows preservation；並覆蓋 disable 與 batch/CLI 使用的 concurrent race。原本的 `auth-courses.e2e-spec.ts`、`cli-credential.e2e-spec.ts`、`question-batches.e2e-spec.ts`、`student-account.e2e-spec.ts` 維持回歸。

### B — Realtime account revocation

1. 沿用現有 in-process post-commit listener isolation，新增獨立的 account lifecycle signal/bus（建議放在 common auth/event boundary，避免 identity 直接依賴 gateway 或把 account signal 混入 live-session domain）。`disableAccount` 僅在 transaction commit 後 publish `{ type: 'account.disabled', accountId }`；publish 失敗不得 rollback 已完成的 DB mutation。
2. `LiveGateway` 保存非敏感的 session/account principal（不保存 raw cookie/key），訂閱 account-disabled signal：在單 instance 內找出並 disconnect 該 account 的 teacher/admin sockets，以及 account-bound student participant sockets；anonymous participant sockets 不受影響。對 teacher snapshot／事件 projection 再加 server-side active-session/account reauthorization，避免漏掉 signal 時仍用 handshake cache 授權。
3. 在 realtime e2e 建立 teacher socket → disable → 斷線／不再收到 teacher-room `session`、`counts.updated`、`result.updated` 的測試；同時驗證 student account-bound socket 被撤銷、匿名 participant socket 仍維持其獨立 credential 語意。明確記錄目前 in-process bus 的單 instance 保證；不宣稱跨 instance 即時撤銷，Redis/outbox/replay 是後續工作。

### C — Frontend admin vertical slice

1. `lib/api/types.ts` 增加 `AccountStatus`／安全的 `CliCredentialDto`、step-up request/response 與 list/detail page 型別；`lib/api/query-keys.ts` 增加 accounts list/detail 與 per-account CLI metadata key。
2. `lib/api/auth.ts` 新增 `useStepUp`（`POST /auth/step-up`，CSRF/Origin 由 `apiRequest` 統一處理）；`components/auth/StepUpDialog.tsx` 重用 `Field`／`ErrorAlert`，支援 `open/onOpenChange/onSuccess/trigger`，鍵盤 focus、Escape、focus restore 與 password 清除，絕不把 step-up password 寫入 query/cache/storage/log。
3. `lib/api/accounts.ts` 增加：
   - `useAccounts`／`useAccount`（GET list/detail）
   - `useDisableAccount`／`useRestoreAccount`（既有 POST endpoints）
   - `useCliCredentials`／`useRevokeCliCredential`（metadata list + step-up revoke）
   - mutation success 只 invalidate/refetch `accounts.all`、`accounts.detail(id)`、該 account 的 CLI metadata；不 optimistic 偽造 status，也不清除目前 admin 自己的 session（self-target 由 backend 拒絕）。
4. 新增 `app/(admin)/admin/accounts/page.tsx` 與 `app/(admin)/admin/accounts/[accountId]/page.tsx`：
   - list 可進 detail，清楚顯示 loading/empty/error/not-found；detail 顯示 immutable identity、role、status、disabledAt、canCreateCourse、mustChangePassword、createdAt。
   - disable/restore 使用可存取 confirmation flow，明示 sessions/CLI/unused token 會立即失效、資料不刪除、restore 需重新登入且舊 key 不會復活；self-target action 不提供／disabled。
   - CLI 區塊只呈現 name/scope/status/timestamps/lastUsedAt/revokedAt，revoke 明示不可逆；本 Story 不新增 raw key creation/rotation UI。
   - stable error code 覆蓋 `AUTH_STEP_UP_REQUIRED`、`FORBIDDEN`、`NOT_FOUND`、`UNAUTHORIZED`、`AUTH_CSRF_INVALID`、`CONFLICT`、`CLI_CREDENTIAL_REVOKED/INVALID`，不直接渲染未分類 backend message。

### D — Regression、browser acceptance 與文件

1. 新增 Vitest/Testing Library：StepUpDialog（CSRF、success/error、password 清除、鍵盤／focus）、account detail/list（safe projection、loading/error、disable/restore/revoke query invalidation、stable errors、無 raw key cache）。
2. `package.json` 現有 `test:browser` 指向不存在的 `test/browser/run.mjs`；補一個使用既有 `playwright` 套件的 deterministic runner/spec（或等價地補足 runner 後再執行），不把缺少 runner 的命令標成通過。Browser flow 對真實 backend 驗證：admin login → list/detail → step-up → disable → status/refetch；restore → fresh login；CLI metadata/revoke；並以第二個 browser/session 或 backend e2e 驗證舊 session/key 失效。
3. 更新 `smartLearning-backend/docs/frontend-api-reference.md`、必要的 shared design/plan status，明確寫出 list/detail、actual POST lifecycle contract、token scope、single-instance realtime boundary，以及 security-lock／audit／retention 的 deferred status；不新增不存在的 audit timeline 或 ArchivedResult UI。

## Acceptance criteria

- Disabled account cannot login; every pre-existing WebSession returns 401 and cannot perform guarded mutations.
- Disable atomically revokes all active CLI credentials and unconsumed account-owned validation tokens; a disabled target cannot receive a new active CLI key.
- Restore allows a new login but never revives revoked sessions, keys, or consumed tokens.
- Existing Course、LiveSession、Submission（以及目前不存在的 ArchivedResult/AuditEvent 不被假裝建立）資料保留；no hard delete。
- Existing teacher/admin sockets are disconnected in the supported single-instance runtime; account-bound student sockets lose access; independent anonymous participant tokens remain account-independent.
- All high-risk UI mutations run through step-up + CSRF/Origin; raw password/key/token/hash never appears in response projection, URL, React Query cache, browser storage, logs, or tests' diagnostic output.
- UI list/detail uses real backend DTO/envelope and query invalidation rather than optimistic/local-only authority.
- CLI security lock is explicitly deferred to a separate story; `canCreateCourse=false` never serves as its substitute, and Web login remains governed only by the account Web status.

## Risk、rollback、環境

- **風險：高**（authentication、credential invalidation、race、realtime/privacy）。優先以無 migration 的 additive endpoint/service/event/test slices 交付；若必須實作 security lock 才另開高風險 schema migration，先 expand/verify 再切換。
- Rollback：依 A/B/C/D slice revert；保留既有 disable/restore contract，撤回 account list/detail、lifecycle event subscription 與 UI routes/hooks。不要清理或覆寫起始時已存在的 UI `tasks/todo.md` 修改，亦不要碰 backend `scripts/verify-change-password.mjs` 等無關工作樹檔案。
- 依賴：Node 24+、backend PostgreSQL `smartlearning_test`（e2e 會 migrate/truncate 且拒絕其他 DB）、backend :3000、UI :3001、`CORS_ORIGIN` 明確包含 `http://localhost:3001`；Socket 單 instance 才有即時 disconnect 保證。

## Verification

Backend（在 backend repo，先 targeted 再擴大）：

```bash
npm run typecheck
npm run lint:check
npm run format:check
npm run build
NODE_ENV=test npm run prisma:migrate:status
npm test -- --runInBand
npm run test:integration -- --runInBand test/identity.integration-spec.ts
npm run test:e2e -- --runInBand test/auth-courses.e2e-spec.ts test/cli-credential.e2e-spec.ts test/question-batches.e2e-spec.ts test/student-account.e2e-spec.ts test/live-session-realtime.e2e-spec.ts
```

Frontend（在 UI repo）：

```bash
npx next typegen
npm run typecheck
npx vitest run test/step-up-dialog.test.tsx test/account-detail.test.tsx test/account-list.test.tsx
npm run lint:check
npm run build
git diff --check
```

Real browser acceptance requires backend + UI running with explicit CORS and a completed runner; run `npm run test:browser` only after `test/browser/run.mjs` exists. If Playwright/browser or DB is unavailable, record BLOCKED with the exact command and do not claim F8 complete.
