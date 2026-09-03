# BE-8.2 CP2 — Account management update（8.3）實作計畫

> 生成日期：2026-08-30。
> 上游契約：`be-8-contract-freeze.md` §3（CP0 verified，2026-08-30「全照建議」）。
> WBS 對應：`00_專案規劃/智學互動平台剩餘工作WBS.md` L443-448（BE-8.2 CP2）。
> DB 授權：CP0 §7 已明示授權（`smartlearning_test` + setup migrate/truncate 邊界）— 本 CP 可直接執行 DB-backed e2e，不需再確認。
> 前置：BE-8.1 CP1 已落地（commit 6131140，`AUTH_SESSION_EXPIRED` 區分完成）。

## 0. Context 與現況

CP0 已凍結 account update scope（§3），實作點為本 CP。現況：

- **已存在**：`AdminController`（`src/modules/identity/api/admin.controller.ts`，`@Controller({ path: 'admin', version: '1' })` + `SessionGuard + CsrfGuard + AdminGuard`）既有：
  - `PATCH accounts/:id/permissions`（僅 `canCreateCourse`，US-F16 契約）— **保留不動**，前端已消費。
  - `POST accounts/:id/disable|restore`、`reset-password`（step-up 保護）— 生命週期另有專責端點，本 CP 不混入。
  - `toAccountDto` 投影不含 hash/credential（不變式已成立）。
- **未完成（本 CP 實作點）**：凍結 allowlist 中的 `displayName`／`role`／`mustChangePassword` 三欄位目前**沒有任何 update 路徑**。
- **高風險標記**：WBS 前言明示 8.3 屬「憑證／帳號不可逆操作」高風險群組，須獨立人工 Checkpoint（§7）。

**凍結契約（不得偏離，freeze §3）：**

| 欄位 | 規則 |
|---|---|
| `displayName` | 可更新；僅 admin，無 self-service |
| `role` | 可更新（teacher→admin 提權需 `StepUpGuard`，10 分鐘內密碼驗證；其他欄位不需 step-up） |
| `canCreateCourse` | 可更新（沿用既有 permissions 語意；student 恆 false） |
| `mustChangePassword` | 可更新 |

不可更新：`username`、`password`/`passwordHash`/`passwordChangedAt`（僅走 reset-password）、`status`/`disabledAt`（僅走 disable/restore）、`id`/`createdAt`/`createdBy`。

交互行為：disabled 帳號不接受 update（先 restore）；`canCreateCourse=false` 不撤銷 CLI credential、disable 仍撤銷（M2 紅卡 #8）；回應 DTO／錯誤訊息／log 不得含 password/hash/CLI key/session token；全域 `forbidNonWhitelisted` 使未知欄位 400。

## 1. 契約設計（route 與語意決策）

### 1.1 Route：新增 `PATCH /api/v1/admin/accounts/:id`

- DTO allowlist：`displayName?`、`role?`、`canCreateCourse?`，全部 optional、至少一欄（空 body → `VALIDATION_FAILED`）。
- **刻意不納入 `mustChangePassword` 於本 route**：見 1.3 — 改以專屬 route 承接，理由為該欄位與 password lifecycle/step-up 語意耦合，混入一般 profile update 會讓 step-up guard 組合無法表達（提權需 step-up，改 mustChangePassword 不需，但兩者在同 body 中無法分別施加 guard）。
- `PATCH accounts/:id/permissions` 保留原樣（前端消費中）；新 route 同樣支援 `canCreateCourse` 以符合凍結 allowlist，兩者底層共用 service 邏輯。日後若要收斂為單一 route 屬 additive 移除，不在本 CP。
- Guards：類層 `SessionGuard + CsrfGuard + AdminGuard` 已足；method 層 **`StepUpGuard` 不能直接掛**（會對整個 request 生效，把 displayName 更新也擋掉）。提權 step-up 在 **service 層**檢查：`role → 'admin'` 且 `target.role !== 'admin'` 時呼叫 `sessions.assertRecentStepUp(actor.account.id, actor.sessionId)`，否則拋 `AUTH_STEP_UP_REQUIRED`（既有 code，見 `error-codes.ts:23`）。此為凍結語意（「提權至 admin 需 StepUpGuard」）的最小忠實實現。

### 1.2 錯誤對照（沿用既有 DomainError，不新增 code）

| 情境 | 結果 |
|---|---|
| 未登入 | 401 `UNAUTHORIZED`（CP1 後 expired 為 `AUTH_SESSION_EXPIRED`） |
| CSRF/Origin 不符 | 403 `AUTH_CSRF_INVALID` |
| 非 admin（teacher/student/self） | 403 `FORBIDDEN` |
| 未知 id／malformed UUID | 404 `NOT_FOUND`（existence-hiding，`getAccountById` 既有模式；malformed UUID 由 `ParseUUIDPipe` 既有行為） |
| 未知欄位／空 body／型別錯 | 400 `VALIDATION_FAILED`（全域 pipe `forbidNonWhitelisted`） |
| student 帳號 `canCreateCourse=true` | 403 `FORBIDDEN`（沿用 `updateCourseCreationPermission` invariant） |
| disabled 帳號 update | 403 `FORBIDDEN`（凍結：「先 restore 才可改」） |
| 提權至 admin 無近期 step-up | 403 `AUTH_STEP_UP_REQUIRED` |
| `role` 值非法 | 400 `VALIDATION_FAILED`（DTO `@IsIn(ACCOUNT_ROLES)`） |

### 1.3 `mustChangePassword` 承接（建議，需使用者於 Checkpoint 2 確認）

凍結清單明列 `mustChangePassword` 可更新，但未指定端點形狀。建議：**`POST /admin/accounts/:id/require-password-change`（body `{ mustChangePassword: boolean }`，step-up 保護）**，獨立於 general update route。理由：

1. 該旗標直接控制下一次登入的強制導頁，屬準生命週期操作，比照 disable/restore 的 POST action style。
2. admin 將他人設 `mustChangePassword=true` 而**不**重設密碼的語意（要求對方主動換密碼）與 reset-password（admin 設暫密 + 強制換）是不同操作，不應共用。

替代方案（若使用者偏好最小面）：併入 `PATCH accounts/:id` allowlist。差異僅 guard 組合與 DTO 形狀；**Checkpoint 2 前由使用者擇一**，未確認前本項不實作（plan 先以獨立 route 為預設）。

### 1.4 未凍結邊界（記錄為決策點，不默默發明）

- **admin 修改自己的 role**：凍結未涵蓋。建議比照既有 `assertNotSelfTarget` 慣例：self role 變更 → 403 `FORBIDDEN`（防止最後一個 admin 自降權鎖死）。**Checkpoint 2 確認**。
- **admin 修改自己的 displayName**：凍結僅說「僅 admin」，未排除 self → 允許。
- **最後一個 admin 被降權**：凍結未要求保護。建議 MVP 不做 server-side last-admin invariant（與凍結一致，不加契約外規則），僅靠 self-role 403 降低風險。**Checkpoint 2 確認**。

## 2. 變更（最小 diff）

### 2.1 `src/modules/identity/api/dto/update-account.dto.ts`（新增）

- `displayName?: string`（`@IsOptional() @IsString() @Length(1, 100)` — 長度上限照 `CreateAccountDto` 既有約束，實作時對齊）。
- `role?: AccountRole`（`@IsOptional() @IsIn(ACCOUNT_ROLES)`）。
- `canCreateCourse?: boolean`（`@IsOptional() @IsBoolean()`）。
- 類驗證「至少一欄」：`@ValidateIf` 組合或 controller 顯式檢查（偏好 controller 顯式，錯誤訊息穩定）。

### 2.2 `src/modules/identity/application/account.service.ts` — `updateAccount()`

新增方法（`updateCourseCreationPermission` 保留，內部可共用 student invariant）：

```text
updateAccount(targetId, actor: AuthContext-liked, patch):
  1. isUuid(targetId) 否 → NotFoundError（existence-safe）
  2. tx.run:
     a. lockAccountForUpdate（既有 FOR UPDATE，與 disable/permission 變更序列化）
     b. target 不存在 → NotFoundError
     c. target.status === DISABLED → ForbiddenError（凍結：先 restore）
     d. self-role-change（若 1.4 決策通過）→ ForbiddenError
     e. role 提權至 admin → assertRecentStepUp（step-up 判定在鎖內、寫入前）
     f. student + canCreateCourse=true → ForbiddenError（既有 invariant）
     g. 同值 no-op：無實際變更欄位 → 直接回傳 target（比照 updateCourseCreationPermission 慣例）
     h. account.update 只寫 patch 中實際出現且值有變的欄位
  3. 不觸發 session revoke / CLI revoke / token invalidation / lifecycle bus publish（那些屬 disable/restore/reset 專責）
```

明確不做：不新增 migration/ schema 變更；不動 `username`/`status` 寫入路徑。

### 2.3 `src/modules/identity/api/admin.controller.ts` — `PATCH accounts/:id`

- `@Patch('accounts/:id')`（排在既有 static/param 順序正確位置；`ParseUUIDPipe`）。
- 注入 `@CurrentAccount()` 取得 actor（self-role 檢查與 step-up 判定都用）。
- `toAccountDto` 回傳既有 `AccountDto`（形狀不變，無 DTO 變更）。
- Swagger `@ApiBody`/`@ApiOkResponse` 對齊既有風格。

### 2.4 `mustChangePassword` route（依 1.3 預設）

- `POST /admin/accounts/:id/require-password-change`，`@UseGuards(StepUpGuard)`（類級三 guard 之外疊加，比照 disable/restore）、body `{ mustChangePassword: boolean }`。
- Service：row lock、existence、disabled 拒絕（同上）、只寫該欄位；設 `true` 時**不**撤銷 session（登入後 gate 導頁由既有 `mustChangePassword` 流程承接）；設 `false` 僅清旗標。self 目標允許（admin 清自己的旗標屬合理自救，與 reset-password self 禁止的語意不同）。
- 注意：`assertNotSelfTarget` 不套用於本 route。

## 3. 測試矩陣（WBS L445-447 凍結項）

### 3.1 Unit — `src/modules/identity/application/account.service.spec.ts`（新增或擴充）

Mock Prisma/TransactionService/SessionService（模式照 `step-up.spec.ts`）。案例：

- displayName 更新成功；role teacher→student 成功；同值 no-op 不寫 DB。
- 提權至 admin：有近期 step-up → 成功；無 → `AUTH_STEP_UP_REQUIRED`。
- disabled target → `FORBIDDEN`；不存在 → `NOT_FOUND`；malformed UUID → `NOT_FOUND`。
- student + `canCreateCourse=true` → `FORBIDDEN`。
- patch 未含任何允許欄位 → `VALIDATION_FAILED`。
- 不變式：成功路徑**不呼叫** `revokeAllForAccountInTransaction`（sessions/CLI）與 lifecycle bus。

### 3.2 E2E — 擴充 `test/account-admin.e2e-spec.ts`（DB-backed）

| # | 案例 | 期望 |
|---|---|---|
| 1 | admin update displayName／role／canCreateCourse | 200 + `AccountDto` 反映新值；DB row 核對 |
| 2 | teacher/student 呼叫 | 403 `FORBIDDEN` |
| 3 | admin **self** update（displayName 允許；role 變更 403，依 1.4） | 如決策 |
| 4 | 未知 id（不存在 UUID） | 404 `NOT_FOUND`（existence-hiding） |
| 5 | malformed UUID | 既有 UUID validation 錯誤（非 500） |
| 6 | 未知欄位（`username`/`passwordHash`/`status`） | 400 `VALIDATION_FAILED`（forbidNonWhitelisted） |
| 7 | 空 body | 400 `VALIDATION_FAILED` |
| 8 | disabled 帳號 update → 403；restore 後 update → 200 | 凍結交互行為 |
| 9 | mustChangePassword 設 true → 該帳號登入流程 gate 生效；設 false 清除 | 依 1.3 形狀 |
| 10 | 提權至 admin 無 step-up → 403 `AUTH_STEP_UP_REQUIRED`；完成 step-up 後 → 200 | 凍結 step-up |
| 11 | `canCreateCourse=false` 後既有 CLI credential 仍可用（M2 紅卡 #8）；disable 仍撤銷（既有測試已覆蓋 disable，補「permission update 不撤銷」斷言） | 凍結 |
| 12 | update 不撤銷 session：target 帳號既有 session 在 update 後仍可用 | 凍結「生命週期不混入」 |
| 13 | 負向洩漏斷言：response body 與 app log 不含 `password`/`passwordHash`/`keyHash`/session token 值 | WBS 負向斷言 |

### 3.3 契約文件同步

- `docs/frontend-api-reference.md`：admin account 區段新增 `PATCH /admin/accounts/:id`（與 1.3 route）path/body/status/error/side-effect 表；L478 的 limitation 列更新（「只支援 canCreateCourse」改為凍結後 allowlist）。
- OpenAPI e2e（`test/openapi.e2e-spec.ts`）：新 PATCH path 出現於 `/api/docs-json` 斷言；`UpdateAccountDto` schema 無敏感範例值。

## 4. 檔案清單

| 檔案 | 動作 |
|---|---|
| `src/modules/identity/api/dto/update-account.dto.ts` | 新增 |
| `src/modules/identity/api/dto/require-password-change.dto.ts` | 新增（依 1.3） |
| `src/modules/identity/api/admin.controller.ts` | 新增 2 個 route |
| `src/modules/identity/application/account.service.ts` | 新增 `updateAccount()`（+ `setMustChangePassword()`） |
| `src/modules/identity/application/account.service.spec.ts` | 新增/擴充 unit |
| `test/account-admin.e2e-spec.ts` | 擴充 e2e 矩陣 |
| `docs/frontend-api-reference.md` | 同步契約 |
| `tasks/todo.md` | CP2 checklist + verification 紀錄 |

無 schema、無 migration、無既有 DTO/response 形狀變更、不動既有 `permissions` route。

## 5. 風險與回滾

- **風險：高**（帳號權限/role 變更屬憑證與授權面；凍結明示 8.3 高風險、須獨立人工 Checkpoint）。緩解：純 additive（新 route，不動既有行為）、row lock 序列化、step-up 僅提權路徑、所有 revoke 行為留在既有專責端點。
- **Rollback**：revert commit 即可；無 DB/migration 回滾。已寫入的 role/displayName 值屬正常資料，不需補償；**不得**以資料操作「恢復」任何被撤銷的憑證（本 CP 本就不撤銷）。
- **監控信號**：`AUTH_STEP_UP_REQUIRED` 在此 route 的出現應僅限提權嘗試；403 `FORBIDDEN` 量突增可能代表前端誤用 route。
- **全域 stop conditions 適用**：`canCreateCourse=false` 若任何路徑撤銷 CLI credential 即停止；log/response 出現 hash/credential 即停止。

## 6. 驗證計畫

順序（targeted → 回歸 → 全套 quality gates）：

```bash
npm test -- --runInBand src/modules/identity/application/account.service.spec.ts
NODE_ENV=test npm run test:e2e -- --runInBand test/account-admin.e2e-spec.ts
NODE_ENV=test npm run test:e2e -- --runInBand test/auth-courses.e2e-spec.ts   # step-up/CSRF 回歸
npm run prisma:validate
npm run typecheck
npm run format          # 先 prettier 避免 formatting-only 失敗
npm run lint:check
npm run format:check
npm run build
npm test -- --runInBand
NODE_ENV=test npm run test:e2e -- --runInBand
NODE_ENV=test npm run test:integration -- --runInBand
npm run prisma:migrate:status   # 唯讀核對
git diff --check
npm run build && node dist/src/main.js   # 記憶體備忘：build 後需 normalize-prisma-client.mjs（若重跑 prisma generate）
```

DB-backed suite 不得靜默 skipped；任何 skip/blocked 記錄於 `tasks/todo.md`。

## 7. Checkpoint 2（人工）

自動測試全綠不取代人工確認。使用者抽查：

1. update 前後 `Account` DB rows（SQL 檢視）與 response DTO 比對：僅凍結 allowlist 欄位變更，`username`/`status`/hash 未動。
2. disabled 帳號 update 被拒、restore 後可改的實例。
3. 提權 step-up 前後行為實例（403 `AUTH_STEP_UP_REQUIRED` → step-up → 200）。
4. `canCreateCourse=false` 前後 CLI credential 列表（仍 active）；對照 disable 後（revoked）。
5. 1.3／1.4 三個決策點（mustChangePassword 端點形狀、self-role、last-admin）逐項回覆確認。