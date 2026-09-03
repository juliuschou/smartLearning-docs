# BE-8.0 Contract freeze 與人工授權（Checkpoint 0）

> 生成日期：2026-08-29。
> Scope：本文件為契約凍結與人工授權記錄。**BE-8.0 不含任何 runtime 程式碼或 schema 變更**；所有「實作點」標註的項目延至對應 CP 執行。
> DB 授權邊界見 §7；人工 Checkpoint 0 確認清單見 §8。
> **CP0 verified：2026-08-30，使用者回覆「全照建議」，Q1–Q7 決策已併入 §2–§7。**

## 0. 環境基準

- Repo：`smartLearning-backend`（main）。HEAD：6ddda14（test(realtime): quiesce shared publisher before every destructive truncate）。
- Working tree：乾淨（記錄當下）。
- Redis 狀態：docker container `smartlearning-redis` 存在，但 `REDIS_URL` 於所有 env 檔為註解（wiring 未接）。僅影響 BE-8.5（CP5），不阻塞 CP0–CP4。不得以 in-memory 實作冒充 multi-instance 驗證。
- 依賴：BE-1／BE-2（auth 契約）已由 Phase B 完成。

## 1. `GET /auth/session` 回應契約（凍結）

- `data.expiresAt` 為**真實 UTC ISO 8601 時間戳**（絕對到期 `expiresAt`，來源 `auth.sessionExpiresAt`）。空字串語意已廢除。
- 無 session / 任何未認證狀態 → 401；不回 200 + 空字串。
- Envelope 形狀（`{ data, meta: { schemaVersion, requestId }, error }`）不變；本項凍結僅允許 additive forward-fix。
- 證據：`src/modules/identity/api/auth.controller.ts:111-125`、`src/common/auth/session.guard.ts:54`、`docs/frontend-api-reference.md`（§auth，`expiresAt: ISO string (絕對到期)`）。

## 2. 錯誤契約（凍結；實作點 CP1）

- expired cookie／idle timeout／absolute timeout → 401 `AUTH_SESSION_EXPIRED`。
- 缺 cookie／malformed cookie／其他未認證路徑 → 401 `UNAUTHORIZED`。
- Client 可依 `error.code` 區分情境，但 **HTTP status 一律 401，code 不影響 status**。

**現況 gap（記錄用，非矛盾）：** `SessionGuard` currently 一律丟 `UnauthorizedError`；`sessionValidity()` 已輸出 reason（`expired`/`idle`，`src/modules/identity/domain/session-limits.ts`）但目前被丟棄；`AUTH_SESSION_EXPIRED` 已宣告（`src/common/errors/error-codes.ts:19`）未使用。**本項為「契約已凍結、實作延至 BE-8.1（CP1）」**（狀態經使用者 CP0 確認）。

CP1 實作方向（已凍結）：最小 diff — `loadActiveSession` 依 `sessionValidity` reason 丟 `SessionExpiredError`（新 DomainError 子類，401 + `AUTH_SESSION_EXPIRED`），`SessionGuard` 透明往上丟；idle 與 absolute 歸同一 code，**不拆兩個 code**。

CP1 回歸基準：fresh session、idle-expired、absolute-expired、logged-out、malformed cookie，加上 8 個既有 auth 行為（login/logout/CSRF/step-up）不回歸。

## 3. Account update scope（凍結；實作點 CP2）

可更新欄位 allowlist（admin via `PATCH /accounts/:id` 類路由）：

| 欄位 | 凍結狀態 |
|---|---|
| `displayName` | 可更新；**僅 admin**，self-service 不開放（日後如需另立 `PATCH /me/profile`，不混入 admin route） |
| `role` | 可更新（含 teacher→admin 提權）；**提權至 admin 需 `StepUpGuard`**（10 分鐘內密碼驗證），其他欄位不需 step-up |
| `canCreateCourse` | 可更新（既有 permissions 語意） |
| `mustChangePassword` | 可更新 |

不可更新欄位：

- `username` — **不可修改**（登入識別碼 + 唯一鍵，連動 session/CLI 歸屬；如需改名走後續 additive 版本）。
- `password`／`passwordHash`／`passwordChangedAt` — 僅經 reset-password route。
- `status`／`disabledAt` — 僅經 disable/restore routes。
- `id`／`createdAt`／`createdBy` — 不可變。

交互行為：

- disabled 帳號不接受 update（先 restore 才可改）。
- disable 撤銷 CLI credentials 與 unused validation tokens（M2 red card #8）；`canCreateCourse=false` **不**撤銷 CLI credential。
- 不洩漏不變式：update 回應 DTO、錯誤訊息與 log 皆不得含 password/hash/CLI key/session token。

實作時受全域 `forbidNonWhitelisted` 邊界驗證（未知欄位 400）。

## 4. CLI 憑證模型（凍結；實作點 CP3，高風險）

- **Rotation 語意（使用者已決策 2026-08-29）：立即失效**。Rotate 成功即產生新 key 並啟用；舊 key 立即 401，**無寬限期**。無需 grace 欄位。
- raw key 僅 issuance/rotation 時一次性回傳；DB 僅存 SHA-256 `keyHash`。任何 raw key 不得進 log 或二次回傳（global stop condition）。
- **Expiry（使用者已決策 2026-08-30）：凍結為「無 TTL、直到 revoke」**。現行 schema 無 expiry 欄位（`prisma/schema.prisma:405`，僅 `status: active|revoked`）；本輪不加 TTL 欄位。key 洩漏的應對是 revoke + rotate。TTL 為防禦加分項，日後以 additive migration 補充時不破壞本契約。CP3 不做 expiry 欄位 migration（rotation 為唯一本輪變更）。
- 不可逆邊界：rotation 失敗不得造成新舊 key 同時失效；predecessor row 保留至驗證通過（rollback 策略）。rotation/expiry 不得影響既有 batch idempotency 序列化。
- 既有端點（證據）：admin `POST /accounts/:id/cli-credentials`（issue）、`GET .../cli-credentials`（list）、`POST .../cli-credentials/:credentialId/revoke`（revoke）— `src/modules/identity/api/admin.controller.ts:134-155`。

## 5. Rate limit 契約（凍結；實作點 CP4，Redis 版 CP5）

- 觸發回應：429 `RATE_LIMITED` + `error.retryAfterSeconds`。
- 現行 bucket：per-account + per-source（in-memory，`src/modules/rate-limit/rate-limiter.service.ts`；僅 login 使用）。
- CLI/batch 歸屬（使用者已決策 2026-08-30）：**per-CLI-key**（bucket key = `CliCredential.id`；batch 必經憑證，同樣 per-CLI-key）。web-session bucket（per-account + per-source）完全不動，CLI 流量不污染。
- 沿用 US-F7 invariant：env 提供的 window/limit 值必須 coerce 為 `Number`（否則 `nowMs() + windowMs` 字串串接、bucket 永不過期）；`test/auth-rate-limit.e2e-spec.ts` real-clock tripwire 模式在 CP4 沿用。
- Redis-backed multi-instance 為 BE-8.5（CP5），依賴 BE-7.3／OPS-1.5 實際 wiring；Redis 未接時 CP5 標 `BLOCKED`，不阻塞 CP6 起。

## 6. Observability 目標（凍結；實作點 CP6／CP7）

- Metrics 暴露端點（使用者已決策 2026-08-30）：**`/metrics`，`VERSION_NEUTRAL`、不做 envelope 包裝（比照健康檢查）**。存取控制**不由 application guard 保護**：production topology 中 `/metrics` 不經 Nginx 對外代理（僅內網/localhost 可達）；指標本身脫敏。日後需要雙層防護時再加單一 bearer token（非 session）。
- 指標最低集（CP7）：login rate-limit 命中數、realtime publish 失敗數、scheduler/retention job 指標、request 維度基礎指標；**禁高基數 label 與敏感值**（帳號、token、題目內容）。
- Redaction review 範圍（CP6）：`src/common/observability/pino-redaction.ts`、例外訊息、validation details、OpenAPI schema、Swagger 範例。預列新敏感欄位：`expiresAt` 週邊細節、CLI successor/raw key material、account update 欄位值、rate limit key 組成。新增欄位需附 spec tripwire。

## 7. DB 授權聲明（人工 CP0 確認項）

> DB-backed 驗證僅限 `NODE_ENV=test` 解析至 guard 保護的 `smartlearning_test`。Test setup 內的 migration 與 `truncateAll()` 為既有 idempotent setup 邊界，在授權範圍內。不對 `smartlearning_dev` 或任何開發/production 資料庫操作；不做手動 `prisma migrate reset` 或 destructive down migration；已撤銷憑證不得以資料操作恢復。

（授權狀態：**已授權 — 使用者於 Checkpoint 0 明示確認（2026-08-30，「全照建議」）**。）

## 8. 人工 Checkpoint 0 清單 — **已全部確認（CP0 verified，2026-08-30）**

1. **Account update 細節：** `username` 不可修改；`displayName` 僅 admin（無 self-service）；`role` 可改且提權至 admin 需 step-up → 已凍結於 §3。
2. **CLI expiry：** 無 TTL、直到 revoke → 已凍結於 §4。
3. **CLI/batch rate limit bucket 歸屬：** per-CLI-key → 已凍結於 §5。
4. **`AUTH_SESSION_EXPIRED` 狀態：** 契約已凍結、實作僅在 CP1（最小 diff：`SessionExpiredError` 子類，idle/absolute 同 code）→ 已凍結於 §2。
5. **Metrics 端點：** `/metrics`（VERSION_NEUTRAL、無 envelope）、不做 application guard，靠 network 層隔離 → 已凍結於 §6。
6. **DB 授權：** §7 聲明已明示授權（`smartlearning_test` + setup migrate/truncate 邊界）。
7. **測試 DB target：** `smartlearning_test` 確認；CP1 以 targeted auth/session suite 先行，綠後再擴大至 8 個既有 auth 行為回歸矩陣。

## 9. Stop conditions（本 CP 有效）

- 本文件與 WBS（`00_專案規劃/智學互動平台剩餘工作WBS.md` L425-433）或設計 docs 矛盾。
- DB target／migration 狀態不明。
- Redis 服務存在性不明（影響 CP5 規劃描述）。
- DB-backed suite 可能靜默 skipped。
- 凍結內容與實際程式碼矛盾（例：宣稱 `AUTH_SESSION_EXPIRED` 現已實作）。

## 10. Evidence appendix

（執行後填入；全部為唯讀指令。）

| 指令 | 結果 |
|---|---|
| `git status --short`（backend） | 乾淨，0 個程式碼檔案變更（僅 `M tasks/todo.md` 非程式碼追蹤檔；本文件位於 docs 目錄，非 git repo） |
| `git diff --check` | PASS |
| `npm run typecheck` | PASS |
| `NODE_ENV=test npm run prisma:migrate:status` | PASS — 14 migrations，schema up to date（唯讀核對） |

**CP0 執行核對（2026-08-30）：** 環境基準與 §1–§6 凍結契約之證據位置全部核對一致：

- §1 `GET /auth/session`：`auth.controller.ts:111-125` 回傳 `expiresAt: auth.sessionExpiresAt`（真實 ISO）；`session.guard.ts:54` 由 `session.expiresAt.toISOString()` 提供；`docs/frontend-api-reference.md` §auth 標註 `expiresAt: ISO string (絕對到期)`。✓
- §2 錯誤契約：`error-codes.ts:19` 已宣告 `AUTH_SESSION_EXPIRED` 未使用；`session-limits.ts` 的 `sessionValidity()` 已輸出 `reason: 'expired' | 'idle'` 但目前被丟棄 — 與「契約已凍結、實作延至 CP1」一致。✓
- §4 CLI 憑證：`admin.controller.ts:134-155` 存在 issue/list/revoke 三端點；`schema.prisma:405` 起 `CliCredential` 僅 `status: active|revoked`，無 TTL 欄位 — 與「無 TTL、直到 revoke」一致。✓
- §5 Redis 狀態：`smartlearning-redis` container Up (healthy)，但 `REDIS_URL` 於 `.env.test`/`.env.development`/`.env.example` 皆為註解 — 與「wiring 未接，僅影響 CP5」一致。✓

**Stop conditions 檢查：** 全部未觸發（無矛盾、DB target 明確、Redis 存在性已確認、無靜默 skip、凍結內容與程式碼一致）。**CP0 完成。**

**CP1 執行核對（2026-08-30，BE-8.1）：** §2 錯誤契約已實作並驗證，證據位置更新如下：

- §2 錯誤契約：`domain-error.ts` 新增 `SessionExpiredError`（code `AUTH_SESSION_EXPIRED`、401、泛用 message `'Session expired'`）；`session.service.ts` `loadActiveSession` 改取 `sessionValidity()` 的 `reason`，`!valid` 分支依 `reason === 'expired' | 'idle'` 丟 `SessionExpiredError`（idle/absolute 同 code），防禦性 else 維持 `UnauthorizedError`；`revokedAt`／disabled／缺 hash 維持 `UnauthorizedError`。✓
- §2 回歸基準：`test/auth-session-expiry.e2e-spec.ts` 8 凍結案例全綠（fresh／absolute-expired／idle-expired／logged-out／malformed／missing／`/auth/session` 未登入／idle 邊界）；既有 auth 行為（auth-courses / auth-rate-limit / api-envelope）3 suites / 25 tests 無回歸。✓
- 驗證：unit 31 suites / 184 tests、e2e 27 suites / 187 tests、integration 3 suites / 16 tests、typecheck/lint/format/build/migrate:status 全 PASS。✓

**Stop conditions 檢查（CP1）：** 全部未觸發 — `AUTH_SESSION_EXPIRED` 未誤用於其他未認證情境（缺 cookie／malformed／revoked／disabled 皆維持 `UNAUTHORIZED`）；HTTP status 一律 401，code 不影響 status；不拆 idle/absolute 為兩 code；無 session → `/auth/session` 401（不回 200 + 空字串）；envelope 形狀不變。**CP1 完成。**