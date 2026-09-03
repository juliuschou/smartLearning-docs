# BE-8.1 CP1 — Session expiry 契約（8.1、8.2）實作計畫

> 生成日期：2026-08-30。
> 上游契約：`be-8-contract-freeze.md` §1–§2（CP0 verified，2026-08-30「全照建議」）。
> WBS 對應：`00_專案規劃/智學互動平台剩餘工作WBS.md` L435-442（BE-8.1 CP1）。
> DB 授權：CP0 §7 已明示授權（`smartlearning_test` + setup migrate/truncate 邊界）— 本 CP 可直接執行 DB-backed e2e，不需再確認。

## 0. Context 與現況 gap

CP0 已凍結 session expiry 契約，實作明確延至本 CP。現況：

- **已完成（§1）**：`GET /auth/session` 已回真實 `expiresAt`（`src/modules/identity/api/auth.controller.ts:111-125`，來自 `authContext.sessionExpiresAt`，由 `session.guard.ts:54` 以 `session.expiresAt.toISOString()` 提供）— 本 CP 僅驗證不回歸，不改 code。
- **未完成（§2 實作點）**：
  - `SessionGuard`（`src/common/auth/session.guard.ts`）對一切失敗丟 `UnauthorizedError`（`UNAUTHORIZED`）。
  - `SessionService.loadActiveSession`（`src/common/auth/session.service.ts:201-238`）內 `sessionValidity()` 已輸出 `reason: 'expired' | 'idle'`（`src/modules/identity/domain/session-limits.ts`）但目前只解構 `valid`、reason 被丟棄。
  - `AUTH_SESSION_EXPIRED` 已宣告（`src/common/errors/error-codes.ts:19`）未使用。

**凍結契約（不得偏離）：**

- expired cookie／idle timeout／absolute timeout → 401 `AUTH_SESSION_EXPIRED`；缺 cookie／malformed cookie／其他未認證 → 401 `UNAUTHORIZED`。
- HTTP status 一律 401，code 不影響 status；**不拆 idle / absolute 為兩個 code**。
- 無 session → `/auth/session` 401，不回 200 + 空字串；envelope 形狀 `{ data, meta, error }` 不變，僅 additive forward-fix。
- 全域 stop condition：`AUTH_SESSION_EXPIRED` 誤用於其他未認證情境（或反之）即停止。

## 1. 變更（最小 diff）

### 1.1 `src/common/errors/domain-error.ts`

新增 `SessionExpiredError extends DomainError`：

- code `AUTH_SESSION_EXPIRED`、`HttpStatus.UNAUTHORIZED`（401）。
- message 固定泛用（如 `'Session expired'`），不洩漏內部細節。

同步 `src/common/errors/index.ts` export。

### 1.2 `src/common/auth/session.service.ts` — `loadActiveSession`（L201-238）

唯二改動：

1. 改取 `sessionValidity()` 的 `reason`（目前只解構 `valid`）。
2. `!valid` 分支改為丟 `SessionExpiredError`（依凍結：idle 與 absolute 同 code）。`sessionValidity` 只會回 `'expired' | 'idle' | null`；`null` 不可能出現在 `!valid` 分支，防禦性 else 維持 `UnauthorizedError`。

**明確不動的分類（stop condition 防護）：**

- `revokedAt` 分支維持 `UnauthorizedError`（logged-out ≠ expired；WBS 回歸案例明列）。
- 帳號 disabled 維持 `UnauthorizedError`；不存在 hash 維持 `UnauthorizedError`。
- 缺 cookie／malformed cookie 在 `SessionGuard` L31-33，已丟 `UnauthorizedError`，不動。

### 1.3 `SessionGuard` — 不需改

`loadActiveSession` 丟的 `SessionExpiredError` 透明往上拋，由既有 `GlobalExceptionFilter` 的 DomainError 映射輸出 401 + `error.code: 'AUTH_SESSION_EXPIRED'` envelope。Guard 不攔、不改寫。

### 1.4 Realtime gateway — 檢查即可（預期 0 diff）

`src/modules/realtime/live-gateway.ts:306`（`authenticateCookie`）呼叫同一 `loadActiveSession`。過期時現在丟 `SessionExpiredError`（仍屬 `DomainError`），handshake 錯誤路徑既有 catch-all 投影應已涵蓋；確認 socket error event 不洩漏內部訊息，不額外變更。

## 2. 測試（凍結的回歸矩陣）

### 2.1 Unit — 新增 `src/common/auth/session.service.spec.ts`（FakeClock）

Mock PrismaService/TransactionService（模式照 `src/common/auth/step-up.spec.ts`）。案例：

- valid session → 觸碰 `lastSeenAt`、回傳 session+account。
- absolute-expired（`expiresAt` 過去）→ `SessionExpiredError`。
- idle-expired（`lastSeenAt` + idleMs 過去、`expiresAt` 未來）→ `SessionExpiredError`（同 code，驗證不拆）。
- revoked → `UnauthorizedError`；disabled account → `UnauthorizedError`；不存在 hash → `UnauthorizedError`。

### 2.2 E2E — 新增 `test/auth-session-expiry.e2e-spec.ts`（DB-backed，`smartlearning_test`）

真實 clock；用既有 setup 直接將該 `web_session` row 的 `lastSeenAt`／`expiresAt` UPDATE 至過去（比改 config 或假 clock 更貼近 runtime）。8 個凍結案例：

| # | 案例 | 期望 |
|---|---|---|
| 1 | fresh session | `GET /auth/session` 200；`data.expiresAt` 為可解析的 UTC ISO 8601 且 > now |
| 2 | absolute-expired | 401 `AUTH_SESSION_EXPIRED` |
| 3 | idle-expired | 401 `AUTH_SESSION_EXPIRED`（同 code） |
| 4 | logged-out（logout 後帶舊 cookie） | 401 `UNAUTHORIZED`（≠ expired） |
| 5 | malformed cookie | 401 `UNAUTHORIZED` |
| 6 | missing cookie | 401 `UNAUTHORIZED` |
| 7 | `/auth/session` 未登入 | 401 `UNAUTHORIZED`（不回 200 + 空字串） |
| 8 | idle 邊界 | 過期前一刻 `lastSeenAt` 仍 valid → 200 |

### 2.3 既有回歸（8 個 auth 行為）

`test/auth-courses.e2e-spec.ts`（login/logout/CSRF/step-up）、`test/auth-rate-limit.e2e-spec.ts`（real-clock tripwire 不動）、`test/api-envelope.e2e-spec.ts`（L39 未認證斷言 `UNAUTHORIZED` — 走缺 cookie 路徑，不受影響）。其他 401 斷言（live-session-*、cp3-terminal-state）皆走缺 cookie／壞 token，不會出現 expired code。

## 3. 契約文件同步

- `docs/frontend-api-reference.md`：§auth 已標 `expiresAt: ISO string (絕對到期)`（L356）；補充 `AUTH_SESSION_EXPIRED`（需重登）vs `UNAUTHORIZED`（未認證/撤銷）語意說明列 — FE-8.3／FE-8.4 由此消費。
- OpenAPI（`test/openapi.e2e-spec.ts`）：如對 `/auth/session` schema 有斷言則一併更新；`SessionDto` 形狀未變（`src/modules/identity/api/dto/account.dto.ts:59` `expiresAt!: string`），預期不需。

## 4. 檔案清單

| 檔案 | 動作 |
|---|---|
| `src/common/errors/domain-error.ts` | 新增 `SessionExpiredError` |
| `src/common/errors/index.ts` | export |
| `src/common/auth/session.service.ts` | `loadActiveSession` 依 reason 丟對應 error |
| `src/common/auth/session.service.spec.ts` | 新增（unit + FakeClock） |
| `test/auth-session-expiry.e2e-spec.ts` | 新增（DB-backed 8 案例） |
| `docs/frontend-api-reference.md` | 補 error-code 語意 |
| `tasks/todo.md` | BE-8.1 CP1 checklist + verification 紀錄 |

無 schema、無 migration、無 DTO 變更。

## 5. 風險與回滾

- **風險：中高**（改變所有 SessionGuard 路徑的錯誤分類、觸及 auth 層）；但凍結契約限定改動面僅 `loadActiveSession` 的 `!valid` 分支。
- **Rollback**：revert commit 即可；無 DB/migration 回滾需求。
- **監控信號**：`AUTH_SESSION_EXPIRED` 出現量應僅限 genuinely expired cookie 場景。
- **不變量**：envelope/auth/CSRF 行為不變；`revokedAt`／disabled／缺 cookie 維持 `UNAUTHORIZED`；realtime handshake 錯誤投影不變。

## 6. 驗證計畫

順序（targeted → 回歸 → 全套 quality gates）：

```bash
npm test -- --runInBand src/common/auth/session.service.spec.ts
NODE_ENV=test npm run test:e2e -- --runInBand test/auth-session-expiry.e2e-spec.ts
NODE_ENV=test npm run test:e2e -- --runInBand test/auth-courses.e2e-spec.ts test/auth-rate-limit.e2e-spec.ts test/api-envelope.e2e-spec.ts
npm run prisma:validate
npm run typecheck
npm run lint:check          # 先 npm run format（prettier）避免 formatting-only 失敗
npm run format:check
npm run build
npm test -- --runInBand
NODE_ENV=test npm run test:integration -- --runInBand
NODE_ENV=test npm run test:e2e -- --runInBand
NODE_ENV=test npm run prisma:migrate:status   # 唯讀核對
git diff --check
```

DB-backed suite 不得靜默 skipped；任何 skip/blocked 記錄於 `tasks/todo.md`。

## 7. Checkpoint 1（人工）

自動測試全綠不取代人工確認。使用者抽查：

1. 各案例（fresh／absolute-expired／idle-expired／logged-out／malformed／missing）的 response status／`error.code` 實例。
2. `expiresAt` 值可解析且語意正確（絕對到期）。
3. 區分語意是由後端 `error.code` 提供，非前端字串判斷。

完成後更新：`be-8-contract-freeze.md` §10 evidence（唯讀指令）、`tasks/todo.md` Results、本文件執行結果區。

## 8. 執行結果

**2026-08-30 執行完成。** 全部變更與驗證如下：

- **變更（最小 diff，無 schema/migration/DTO）**：
  - `src/common/errors/domain-error.ts` 新增 `SessionExpiredError`（code `AUTH_SESSION_EXPIRED`、401、message `'Session expired'`）；`index.ts` 已 `export * from './domain-error'` 自動匯出。
  - `src/common/auth/session.service.ts` `loadActiveSession` 改取 `sessionValidity()` 的 `reason`；`!valid` 分支依 `reason === 'expired' | 'idle'` 丟 `SessionExpiredError`（idle/absolute 同 code），防禦性 else 維持 `UnauthorizedError`。`revokedAt`／disabled／缺 hash 維持 `UnauthorizedError`。
  - `SessionGuard` 不需改（`SessionExpiredError` 透明上拋，由 `GlobalExceptionFilter` 映射 401 + `AUTH_SESSION_EXPIRED` envelope）。Realtime gateway `authenticateCookie` 呼叫同一 `loadActiveSession`，handshake catch-all 投影涵蓋 — 0 diff。
  - 新增 `src/common/auth/session.service.spec.ts`（FakeClock，6 tests）與 `test/auth-session-expiry.e2e-spec.ts`（DB-backed，8 凍結案例）。
  - `docs/frontend-api-reference.md` §auth 補 `AUTH_SESSION_EXPIRED` vs `UNAUTHORIZED` 語意說明列。

- **驗證（targeted → 回歸 → 全套 quality gates）**：
  - `npm test -- --runInBand src/common/auth/session.service.spec.ts` → PASS（1 suite / 6 tests）。
  - `NODE_ENV=test npm run test:e2e -- --runInBand test/auth-session-expiry.e2e-spec.ts` → PASS（1 suite / 9 tests，8 凍結案例 + skip-guard）。
  - 既有回歸（auth-courses / auth-rate-limit / api-envelope）→ PASS（3 suites / 25 tests，無回歸）。
  - `prisma:validate`、`typecheck`、`lint:check`、`format:check`、`build` → 全 PASS。
  - `npm test -- --runInBand` → PASS（31 suites / 184 tests）。
  - `NODE_ENV=test npm run test:integration -- --runInBand` → PASS（3 suites / 16 tests）。
  - `NODE_ENV=test npm run test:e2e -- --runInBand` → PASS（27 suites / 187 tests）。
  - `NODE_ENV=test npm run prisma:migrate:status` → PASS（14 migrations，schema up to date，唯讀）。
  - `git diff --check` → PASS。

- **凍結契約符合**：expired cookie／idle timeout／absolute timeout → 401 `AUTH_SESSION_EXPIRED`；缺 cookie／malformed／revoked／disabled → 401 `UNAUTHORIZED`；HTTP status 一律 401，code 不影響 status，不拆 idle/absolute 為兩 code；無 session → `/auth/session` 401（不回 200 + 空字串）；envelope 形狀不變。全域 stop condition 未觸發。

- **人工 Checkpoint 1 — verified（2026-08-30，使用者確認）**：各案例（fresh／absolute-expired／idle-expired／logged-out／malformed／missing）的 response status／`error.code` 實例符合凍結契約；`expiresAt` 值可解析且語意正確（絕對到期）；區分語意由後端 `error.code` 提供（`AUTH_SESSION_EXPIRED` → 重登、`UNAUTHORIZED` → 未認證/撤銷）。`be-8-contract-freeze.md` §10 evidence 已同步更新。**CP1 完成。**