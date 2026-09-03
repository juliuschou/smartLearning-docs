# US-F5 系統管理員建立首位管理員與後續帳號 — 實作計畫

> 來源：`docs/智學互動平台/50_實作與測試/SPEC F0-F17 前端實作計畫.md`（US-F5 段）、`10_需求蒐集/功能需求 BDD 場景.md` §US-F5（R-F5-1..6）、`smartLearning-backend/docs/frontend-api-reference.md` §admin。

## 目標與驗收 criteria

建立「首位管理員」的一次性 bootstrap 確認流程（**部署命令、非 Web 頁**），以及「管理員建立後續 admin/teacher 帳號」的 Web UI；同時落地本輪第一組共享前端基礎建設（API envelope 解封、CSRF 讀取、React Query provider、穩定錯誤碼顯示、基礎測試架構）。

**驗收（Acceptance）：**
1. **bootstrap 一次性**：在 fresh DB 上 `npm run bootstrap:admin` 成功建立首位管理員；再次執行被拒（`isPermitted=false` → exit 1）。不建立 Web bootstrap 頁。
2. **管理員建立老師／管理員**：以有效管理員 session 透過 `POST /admin/accounts` 建立帳號，本輪只開放 `admin|teacher`（DTO 雖含 student，UI 不提供 student 選項）。
3. **首次登入旗標**：回應 `mustChangePassword=true`（後端 `createAccount` 一律設 true；bootstrap admin 為 false）— UI 顯示但不處理改密碼流程（屬 F7）。
4. **非管理員 403**：teacher/未登入呼叫 `POST /admin/accounts` 回 403（`AdminGuard`）；UI 顯示穩定錯誤碼。
5. **不洩露密碼**：臨時密碼只作輸入欄位，送出成功後立即清空；不期待 API 回傳密碼/hash；`AccountDto` 本就不含 `passwordHash`。
6. **靜態 gate**：`npx next typegen` → `npm run typecheck` → `npm run lint:check` → `npm run build` → `git diff --check` 全綠。
7. **測試**：元件測試（form 送出、role 選項、密碼清空、錯誤碼顯示）+ 真實 backend 瀏覽器流程（bootstrap admin → 以 API 登入取 cookie → 建帳號 → 斷言 `mustChangePassword`、再次 bootstrap 被拒）。
8. **a11y**：`lang="zh-Hant"`、唯一 title/h1、label + `aria-describedby`、鍵盤可完成、狀態不只靠顏色、對比/reduced-motion；桌面 + 手機寬度 smoke。

## 後端 gate（先驗證後再寫 UI，不可用 mock）

本 Story 為前端，後端端點已交付，但仍須先以真實 backend 確認 gate：
- `curl http://localhost:3000/health/live`、`/health/ready` 綠。
- `npm run prisma:migrate:status`（在 backend 專案）乾淨。
- `npm run bootstrap:admin`（backend，fresh DB）成功；再跑一次被拒（exit 1）。
- 以 Swagger UI `http://localhost:3000/api/docs` 人工核對 `POST /admin/accounts` body/DTO/header/狀態碼；以 `http://localhost:3000/api/docs-json` 為機器可讀契約來源。
- 若 Swagger、`frontend-api-reference.md` 與實際 controller/DTO 不一致 → 停止，先同步後端契約。

關鍵後端事實（已驗證）：
- `POST /api/v1/admin/accounts`：class guard = `Session + CSRF + Admin`；body `{ username, displayName, role, canCreateCourse, tempPassword }`；回 `AccountDto { id, username, displayName, role, status, canCreateCourse, mustChangePassword, disabledAt, createdAt }`（無密碼欄位）。student 的 `canCreateCourse` 後端恆為 false。
- 回應一律 envelope：`{ data, meta:{schemaVersion,requestId}, error }` → client 取 `body.data`。Health probes 為 raw（本 Story 不碰）。
- CSRF：無獨立 `/csrf` 端點。token 來自 login 回應的 `Set-Cookie: __Host-csrf`（non-HttpOnly）；之後每個 authenticated mutation 需 `X-CSRF-Token`（讀自該 cookie）+ `Origin`。
- `CORS_ORIGIN` 必須明確設 `http://localhost:3001`，不可為 `*`（否則 CSRF Origin fail-closed → 所有 mutation 403 `AUTH_CSRF_INVALID`）。
- bootstrap：`BOOTSTRAP_ADMIN_USERNAME/PASSWORD/DISPLAY_NAME` 環境變數；`bootstrap.service.ts` 以 transaction-scoped advisory lock + 雙重 guard 確保 only-one-wins；成功後 `system_setting.bootstrap_completed=true`。

## 關鍵依賴排序決策（推薦預設）

US-F5 需要一個**已登入的管理員 session** 才能驗收「管理員建帳號 / 非管理員 403」。登入 UI 是 US-F6（亦為「可開始」）。

**推薦做法（讓 F5 自足、不擴及 F6）：**
- F5 落地共享 session 基礎建設：`lib/auth/session.ts`（讀 `GET /auth/session`，權威，不自建 JWT）、protected admin layout（非 admin/未登入 → 重導）。
- **不**建登入表單（屬 F6）。
- 真實 backend 瀏覽器流程驗收：以 Playwright script 先 `POST /auth/login` 取得 session+CSRF cookie，`context.addCookies` 注入瀏覽器，再操作建帳號 UI — 使用真實 backend、真實登入 API，僅省略登入「表單」（非 mock API）。
- 替代方案：先做 F6 登入頁再回 F5（規模較大，會擴大本 Story 範圍）。

## 實作 Checkpoints

### Checkpoint A — 理解 + 後端 gate 重現（done 部分）
- [x] 已讀 bootstrap / admin controller / account.service / DTOs / schema / BDD / SPEC / API reference。
- [ ] 在 backend 啟動 Compose stack、migrate、fresh DB。
- [ ] 跑 `npm run bootstrap:admin`（成功）+ 再跑一次（被拒 exit 1）→ 記錄證據。
- [ ] Swagger 核對 `POST /admin/accounts`；記錄 envelope、CSRF header、錯誤碼。

### Checkpoint B — 共享基礎建設（最小可運作 slice）
- [ ] `app/providers.tsx`：React Query `QueryClientProvider`（server-safe，`QueryClient` 在 component 內建立以避免 SSR 共用）。安裝 `@tanstack/react-query`。
- [ ] `lib/api/client.ts`：fetch wrapper — 同基底 URL（`NEXT_PUBLIC_API_BASE`，預設 `http://localhost:3000/api/v1`）、`credentials:'include'`、自動帶 `X-CSRF-Token`（讀自 `__Host-csrf` cookie）、`Origin: <UI origin>`。成功解 envelope `body.data`；失敗且回 `{ code, message, field }` 的 stable error。Health 不走此 client。
- [ ] `lib/api/types.ts`：`ApiResponse<T>` envelope、`ApiError`、`AccountDto`、`CreateAccountPayload`。
- [ ] `lib/api/query-keys.ts`：query key 工廠（`account` 相關）。
- [ ] `lib/auth/session.ts`：`getSession()` → `GET /auth/session`（envelope 解封為 `SessionDto`）；`useSession` hook（React Query query；envelope 為權威，不存 Zustand）。`expiresAt:""` 不用來判 expiry（依 401）。
- [ ] cookie 讀取：因 `__Host-csrf` non-HttpOnly，client 端可用 `document.cookie` 解析；提供 `getCsrfToken()` helper。
- [ ] 穩定錯誤碼顯示：`<ErrorAlert code=...>` 元件，依 `error.code` 對應中文訊息；未知名碼顯示通用訊息（不洩露內部細節）。
- [ ] 測試架構：安裝 Vitest + Testing Library + `@vitest/browser`/Playwright（擇一，依現行慣例）。`vitest.config` + `jsdom` env。`package.json` scripts: `test`、`test:browser`。
- [ ] `app/layout.tsx`：包入 `<Providers>`、`<html lang="zh-Hant">`、唯一 title。
- [ ] protected admin shell：`app/(admin)/layout.tsx` — `useSession`；未登入/非 admin → `redirect('/login')`（登入頁 F6 尚未做，先導向佔位 `/login`，但**不**實作登入表單）。

### Checkpoint C — US-F5 功能
- [ ] `app/(admin)/admin/accounts/new/page.tsx`：建帳號頁。
- [ ] `features/admin/AccountCreateForm.tsx`（react-hook-form + zod 或 class-validator 對齊後端）：
  - 欄位：`username`(1–64)、`displayName`(1–100)、`role`（本輪只 `admin|teacher`，不提供 `student`）、`canCreateCourse`（boolean；role=teacher 時可見且可勾選；role=admin 時後端忽略但仍需送值，UI 預設 true 或依語意）、`tempPassword`(12–128)。
  - 臨時密碼：type=password 欄位；送出成功後**立即清空**（`reset()`）；不顯示回傳值。
  - 提示：「此密碼為一次性臨時密碼，首次登入需自行變更」。
- [ ] `useCreateAccount` mutation（React Query）：送 `POST /admin/accounts`；成功後 invalidate `accounts` query key、顯示成功狀態 + 新帳號 `mustChangePassword=true` 提示；失敗顯示穩定錯誤碼（403 `AUTH_FORBIDDEN`/`AUTH_UNAUTHORIZED`、409 username 衝突、422 驗證錯誤含 field）。
- [ ] role=student 不在 UI 提供選項（即使後端 DTO 允許），符合 SPEC 本輪範圍。
- [ ] 不建帳號列表/詳情/停用/復原/重設密碼 UI（分屬 F8/F16/F7；backend 尚無 list/detail/update — E-5 未做）。

### Checkpoint D — 驗證
- [ ] 靜態 gate：`npx next typegen`（Next 16：route types 需先產生，否則 `tsc` 找不到 `LayoutProps`）→ `npm run typecheck` → `npm run lint:check` → `npm run build` → `git diff --check`。
- [ ] 元件測試（Vitest + Testing Library）：表單送出 happy path、role 只含 admin/teacher、tempPassword 送出後清空、403/409/422 錯誤碼顯示、未填欄位驗證訊息。
- [ ] 真實 backend 瀏覽器流程（Playwright，backend `:3000`、UI `:3001`、`CORS_ORIGIN=http://localhost:3001`）：
  1. fresh DB → bootstrap admin（CLI）。
  2. Playwright `request.post('/api/v1/auth/login')` 取 session+CSRF cookie → `context.addCookies`。
  3. 造訪 `admin/accounts/new` → 填表送出建一位 teacher → 斷言成功、`mustChangePassword` 顯示、密碼欄清空。
  4. 再跑一次 bootstrap（CLI）→ 斷言被拒。
  5. 用 teacher session 嘗試建帳號 → 斷言 403 穩定錯誤碼。
  6. 確認 UI / network log 不含密碼明文。
- [ ] a11y smoke：鍵盤完成、label/`aria-describedby`、唯一 title/h1、對比、reduced-motion、桌面+手機寬度。
- [ ] 測試執行交由專用 test subagent，回傳 structured report（command/scope/PASS-FAIL/最小證據/confidence）。

## Risk & Rollback
- **風險等級：中**（auth/CSRF/表單；非高風險的 token/realtime/privacy）。
- **影響元件**：`app/(admin)/`、`lib/api/`、`lib/auth/`、`app/providers.tsx`、測試架構（新增依賴）。
- **Rollback**：每個共享檔案與 route 獨立移除即可回滾；契約不符時回滾該 route/依賴，**不以 fallback 假資料繼續**。React Query/Zustand 為新依賴，回滾即移除 `@tanstack/react-query` 與相關 provider。
- **不可做**：不把 `CORS_ORIGIN` 改為 `*`、不關 CSRF、不記錄密碼/cookie/CSRF token、不建登入表單（F6）、不建帳號列表/詳情/停用/復原/重設（F8/F16/F7）、不提供 student 選項、不 mock API。

## Dependencies & Environment
- **Node 24+**（後端 Prisma 7 要求）；前端 Next 16.3.1 + React 19.2.8 + Tailwind v4。
- backend：`localhost:3000`（Compose stack，Postgres host port 5433）；需 `CORS_ORIGIN=http://localhost:3001`。
- UI：`localhost:3001`（`npm run dev`）。
- 新依賴（前端）：`@tanstack/react-query`、`react-hook-form`、測試用 Vitest + Testing Library + Playwright（+ jsdom）。**加依賴前確認既有 stack 無法替代** — React Query 為 tech-stack doc 指定，符合；其餘為測試必要。
- env：UI 需 `NEXT_PUBLIC_API_BASE=http://localhost:3000/api/v1`（預設值即可）。後端 `.env.development` 填 `CORS_ORIGIN`、`COOKIE_SECRET`、bootstrap 變數。
- Next 16 注意：寫碼前查 `node_modules/next/dist/docs/`（App Router）；route types 需 `next typegen` 先產生。

## Acceptance Matrix（完成時記錄 completed/blocked/n.a.）
| AC | 狀態 |
|---|---|
| bootstrap 一次性（成功 + 再跑被拒） | |
| 管理員建立 teacher/admin | |
| 首次登入旗標顯示 | |
| 非管理員 403 穩定錯誤碼 | |
| UI/回應不洩露密碼 | |
| typegen/typecheck/lint/build | |
| 元件測試 | |
| 真實 backend 瀏覽器流程 | |
| a11y smoke | |

## Results
（完成時填：what changed / where / how verified）