# US-F8 續作指令（resume note）

> 2026-08-21。後端 A、B 已完成並 commit；接下來的 Slice C、D 由此文件開場。

## 目前進度

- **Slice A（backend contract + lifecycle hardening）✅ committed** — `d01e44a`
  - `GET /admin/accounts`（paginated `Page<AccountDto>`）+ `GET /admin/accounts/:id`；`createCredential` 拒絕 disabled account（403）；`validateBatch`/`confirmBatch` 在 transaction 內 re-check account status；`AccountLifecycleBus` 經 global `AuthModule` 注入。
  - 驗證：`account-admin.e2e-spec.ts` 7/7、`openapi.e2e-spec.ts` 3/3。
- **Slice B（realtime account revocation）— committed** — `0fc840e`
  - `SessionService.assertAccountActive()`；`LiveGateway` 訂閱 account-disabled signal，斷開 teacher/admin 與 account-bound student socket；匿名 participant socket 存活；`pruneDisabledTeacherSockets()` 為 miss-signal fallback。
  - 驗證：`live-session-realtime.e2e-spec.ts` **14/14**（含 3 個新 US-F8 測試）。
- **Full regression bundle（commit 前）PASS**：unit 21 suites/121 tests、integration 7/7、e2e 6 suites/40 tests、`typecheck`/`lint:check`/`format:check`/`build`/`git diff --check` 全綠。

backend repo `smartLearning-backend` 分支 `phase-b-student-enrollment`，working tree 乾淨（僅剩未追蹤 `scripts/verify-change-password.mjs`，刻意不碰）。

---

## 下一步：Slice C（frontend admin vertical slice）— UI repo `smartLearning-ui`

**修改：**
- `lib/api/types.ts`：`StepUpPayload {password}`、`StepUpResponse {expiresAt}`、`AccountStatus`、`CliCredentialDto`（metadata only，無 rawKey/hash）。
- `lib/api/query-keys.ts`：`accounts.cliCredentials(id)`。
- `lib/api/auth.ts`：`useStepUp`（`POST /auth/step-up`，`mutate:true`）。
- `lib/api/accounts.ts`：`useAccounts(page)`、`useAccount(id)`、`useDisableAccount`、`useRestoreAccount`、`useCliCredentials(id)`、`useRevokeCliCredential`；mutation `onSuccess` 只 invalidate `accounts.all`/`accounts.detail(id)`/`accounts.cliCredentials(id)`，不 optimistic。
- `lib/api/error-messages.ts`：加 `NOT_FOUND`、`CLI_CREDENTIAL_REVOKED`、`CLI_CREDENTIAL_INVALID`。

**新建：**
- `components/auth/StepUpDialog.tsx` — **手刻 fixed-overlay modal（勿用 `<dialog>.showModal()`，jsdom 不支援）**；`Field`/`ErrorAlert`；Escape/backdrop 關閉、focus 到 password；password 只存 local state、關閉即清空；絕不進 cache/storage/log。
- `features/admin/AccountListView.tsx` — loading/empty/error（`ErrorAlert`）+ 表格列、進 detail。
- `features/admin/AccountDetailView.tsx` — immutable identity + status/disabledAt/canCreateCourse/mustChangePassword/createdAt；disable/restore 走 step-up + confirmation copy；self-target（`session.accountId===id`）隱藏；CLI 區塊 metadata + revoke（step-up、不可逆 copy）；無 raw key creation UI。
- `app/(admin)/admin/accounts/page.tsx`、`app/(admin)/admin/accounts/[accountId]/page.tsx` — Next 16：`params: Promise<{accountId}>`，`const { accountId } = await params`。
- Vitest：`test/step-up-dialog.test.tsx`、`test/account-list.test.tsx`、`test/account-detail.test.tsx`、`test/account-actions.test.tsx`（照 `test/change-password-form.test.tsx` mock 慣例：`vi.mock('@/lib/api/client')` 重做 `ApiRequestError`、`stubCsrfCookie()`、fresh `QueryClient`、assert `apiRequest` call args）。

## 之後再跑 Slice D

- 更新 `smartLearning-backend/docs/frontend-api-reference.md` 第 377 行「admin account list/detail/update 尚無」→ 已提供；§4 表加 list/detail。
- 補 `smartLearning-ui/test/browser/run.mjs`（用已裝 `playwright`，非 `@playwright/test`；環境缺後端/UI → 記 BLOCKED，勿宣稱通過）。
- 更新 `tasks/todo.md`（保留既有 F6/F7 內容）。

## 驗證命令

```bash
# UI（smartLearning-ui）
npx next typegen && npm run typecheck
npx vitest run test/step-up-dialog.test.tsx test/account-list.test.tsx test/account-detail.test.tsx test/account-actions.test.tsx
npm run lint:check && npm run build && git diff --check
```

backend 若有更動，回歸受影響 suites（`test/account-admin.e2e-spec.ts` 等）。

## 此環境的坑（勿重蹈）

- `2>&1 | tail` 緩衝 jest 全部輸出 → 看不到進度；用 `npx jest --verbose > log 2>&1`。
- `.env.test` 含 credentials，勿 `cat`（classifier 擋）；用 `/dev/tcp/localhost/5432` 探 DB。
- `scripts/verify-change-password.mjs` 與 UI `tasks/todo.md` 是既有未 commit 內容，別碰。
- 後端 e2e 用 `smartlearning_test`，`setupTestDb()` 只接受該 DB。
- 新檔先 `prettier --write` 再跑 lint gate。
