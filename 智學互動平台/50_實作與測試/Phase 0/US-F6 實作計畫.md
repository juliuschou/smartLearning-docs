# US-F6 — 使用者登入、登出與 Web Session（前端）

## Context

US-F6 是智學互動平台前端的第一個身份基礎 story。後端 `/auth/login`、`/auth/session`、`/auth/logout` 早已完整實作（含 cookie session、CSRF、mustChangePassword、session rotation）。前端目前已落地 US-F5（帳號建立）：API client（envelope 解包 + CSRF 自動附帶）、`useSession`、admin protected layout、React Query provider、穩定錯誤碼顯示、元件測試架構都已就位。但登入頁仍是 placeholder，沒有 `useLogout`，也沒有 mustChangePassword gate。

本 story 補齊這塊：讓 active 帳號能以帳密登入、取得安全 session、依 `next` 重導回原目的地；mustChangePassword 使用者登入後被導向改密碼路由（F7 頁面尚未實作，暫時 404——這是 SPEC 排程的已知 gap，會在計畫中標記）；已登入者可登出，登出後清除 query 快取與敏感 UI state、以 replace navigation 回登入頁，確保 browser back 不重顯受保護內容。

**範圍（已確認）**：登入頁表單 + `useLogin` + `useLogout` + 登出鈕（放 admin shell）+ mustChangePassword gate + `next` 重導。不實作 F7 變更密碼頁。

**關鍵不變量**：session authority 永遠是 `GET /auth/session`，不自建 JWT、不把登入資料放 Zustand。login mutation 不送 CSRF（後端刻意豁免），其他 cookie mutation 讀 `__Host-csrf`。錯誤依穩定 `code` 顯示中文訊息，不洩露帳號是否存在（disabled/未知帳號皆回 `AUTH_INVALID_CREDENTIALS` 通用訊息）。

## 後端契約（已驗證，不可偏離）

- `POST /api/v1/auth/login` — body: `{ username: string(1-64), password: string(1-128) }`。**不套 CSRF**（後端刻意豁免，前端 login mutation 不可設 `mutate: true`）。成功回 `SessionDto`（envelope 解包後）：`{ accountId, username, displayName, role, canCreateCourse, mustChangePassword, sessionId, expiresAt }`，並 `Set-Cookie: __Host-session`（HttpOnly）+ `__Host-csrf`（非 HttpOnly，後續 mutation 用）。
- 失敗一律 `AUTH_INVALID_CREDENTIALS`（401）——disabled 帳號、未知帳號、密碼錯誤皆同，不洩露存在性。
- `GET /api/v1/auth/session` — 回 `SessionDto`；`@AllowPasswordChangeRequired()` 所以 mustChangePassword 狀態下**仍可呼叫**（這是 gate 的關鍵）。未登入回 401 `UNAUTHORIZED`。
- `POST /api/v1/auth/logout` — 需 Session + CSRF（`mutate: true`）。回 `data: null`，clear cookies。
- 其他路由在 mustChangePassword=true 時回 `AUTH_PASSWORD_CHANGE_REQUIRED`（前端已有對應中文訊息）。

## 實作步驟

### 1. `lib/api/auth.ts`（新增）— login 與 logout mutations

鏡射 `lib/api/accounts.ts` 的模式。兩個 hook：

- `useLogin()` → `useMutation<SessionDto, ApiRequestError, LoginPayload>`，`mutationFn` 呼叫 `apiRequest('/auth/login', { method: 'POST', body: payload })`。**注意：不傳 `mutate: true`**（login 不送 CSRF/Origin；`apiRequest` 預設 `isMutation = method !== 'GET'` 會附 CSRF——需改為明確 `{ mutate: false }` 或新增一個不附 header 的路徑）。成功後用 `queryClient.setQueryData(queryKeys.session, data)` 把 login 回傳的 `SessionDto` 直接寫進 session 快取，避免登入後立刻又打一次 `/auth/session`。
- `useLogout()` → `useMutation<null, ApiRequestError, void>`，`mutationFn` 呼叫 `apiRequest('/auth/logout', { method: 'POST', mutate: true })`。成功後 `queryClient.clear()`（清除所有快取含 session，避免登出後 back 還看得到受保護資料的殘留）。
- `LoginPayload` 型別加到 `lib/api/types.ts`：`{ username: string; password: string }`。

**`apiRequest` 調整**：目前 `isMutation = opts.mutate ?? method !== 'GET'`，login 是 POST 但不該附 CSRF/Origin。改為 login 呼叫端傳 `mutate: false` 即可（`apiRequest` 已支援 `mutate` 選項，傳 false 就不附 CSRF header、不附 Origin）。確認 `client.ts:62` 邏輯：`isMutation = opts.mutate ?? method !== 'GET'`——傳 `mutate: false` 後 isMutation=false，不附 CSRF/Origin，但 `credentials: 'include'` 仍在（cookie 會送），body 仍序列化。✅ 不需改 `client.ts`。

### 2. `features/auth/LoginForm.tsx`（新增）— 登入表單元件

鏡射 `features/admin/AccountCreateForm.tsx` 的結構（react-hook-form + zod + `ErrorAlert` + `Field` + `inputClass`）：

- zod schema: `username`（1–64）、`password`（1–128）。中文驗證訊息。
- 欄位：帳號（`autoComplete="username"`）、密碼（`type="password"`, `autoComplete="current-password"`）。
- 送出呼叫 `useLogin().mutateAsync`。成功後：
  - `queryClient.setQueryData(queryKeys.session, session)`（已在 hook 內做，這裡不必重複）。
  - 讀 `searchParams.get('next')`，若存在且為同源相對路徑則 `router.replace(next)`，否則依 role 重導：`admin` → `/admin`，其他 → `/`（暫時首頁；學員/老師專屬首頁尚未實作）。
  - `router.replace`（非 push）確保登入頁不留在 history，back 不回到登入頁。
- mustChangePassword=true 時：不重導原 `next`，改 `router.replace('/settings/password')`（F7 頁面暫不存在會 404——這是已知 gap，程式碼註解標記）。
- 錯誤顯示：`login.error instanceof ApiRequestError` → `<ErrorAlert>`。`AUTH_INVALID_CREDENTIALS` 會顯示「帳號或密碼不正確。」（disabled/未知帳號同訊息，符合反列舉要求）。
- `next` 參數驗證：只接受以 `/` 開頭且不以 `//` 開頭的相對路徑（防 open redirect）；否則 fallback 預設。

**`Field`/`inputClass` 重複**：`AccountCreateForm` 內的 `Field` 與 `inputClass` 是 local helper。評估抽出到 `components/ui/Field.tsx` 共用，或先在 `LoginForm` 內重複一份。傾向**抽共用**（兩處已重複，符合同一專案「第二次出現才抽象」原則）：新增 `components/ui/Field.tsx` 匯出 `Field` 與 `inputClass`，`AccountCreateForm` 改為 import（小規模機械調整，不擴大範圍）。若擔心動到 F5，可先在 `LoginForm` 內重複，抽共用列為可選 follow-up——**決定：先抽共用**，因為風險低且計畫要求重用。

### 3. `app/login/page.tsx`（改寫）— 登入頁

把 placeholder 換成實際頁面：server component 外殼 + `<LoginForm />`。保留 `metadata`。若 `useSession` 顯示已登入，可選擇重導首頁（避免已登入者看到登入頁）——這需要 client component 讀 session，傾向在 `LoginForm` 內或一個小 client wrapper 處理；**決定：登入頁本身保持簡單**，已登入偵測留給 protected layout 處理，登入頁只負責表單。

### 4. `app/(admin)/layout.tsx`（改）— 加登出鈕 + mustChangePassword gate

現有 layout 已 gate admin 路由（非 admin 重導 `/login?next=...`）。新增：

- **mustChangePassword gate**：`session.mustChangePassword === true` 時 `redirect('/settings/password')`（在 role 檢查之前）。F7 頁面暫不存在會 404（已知 gap，註解標記）。
- **登出鈕**：在 admin shell 加入一個 client 登出按鈕（呼 `useLogout`，成功後 `router.replace('/login')`）。放一個小 client component `components/auth/LogoutButton.tsx`，layout 本身是 client component 已可直接用，但為了乾淨分離仍抽成元件。登出成功後 `queryClient.clear()`（在 hook 內），並 `router.replace('/login')`。

### 5. 錯誤碼訊息

`lib/api/error-messages.ts` 已涵蓋 `AUTH_INVALID_CREDENTIALS`、`AUTH_SESSION_EXPIRED`、`UNAUTHORIZED`、`AUTH_PASSWORD_CHANGE_REQUIRED`。**不需新增**。確認 `AUTH_ACCOUNT_DISABLED` 之類不存在——後端對 disabled 帳號登入回的是 `AUTH_INVALID_CREDENTIALS`（已驗證 `auth.service.ts` 一律 throw `InvalidCredentialsError`）。✅

## 關鍵檔案

| 檔案 | 動作 |
|---|---|
| `lib/api/types.ts` | 加 `LoginPayload` |
| `lib/api/auth.ts` | 新增 `useLogin` + `useLogout` |
| `features/auth/LoginForm.tsx` | 新增登入表單 |
| `components/ui/Field.tsx` | 新增共用 `Field` + `inputClass` |
| `features/admin/AccountCreateForm.tsx` | 改用共用 `Field`/`inputClass`（小調整） |
| `app/login/page.tsx` | 改寫為實際登入頁 |
| `app/(admin)/layout.tsx` | 加 mustChangePassword gate + 登出鈕 |
| `components/auth/LogoutButton.tsx` | 新增 |
| `test/login-form.test.tsx` | 新增元件測試 |
| `test/logout.test.tsx` | 新增（或合併進 layout 測試） |

**重用（不重複發明）**：`apiRequest`（`lib/api/client.ts`）、`getCsrfToken`/`CSRF_HEADER_NAME`（`lib/api/csrf.ts`）、`errorMessage`（`lib/api/error-messages.ts`）、`ErrorAlert`（`components/ui/ErrorAlert.tsx`）、`useSession`/`sessionQueryOptions`（`lib/auth/session.ts`）、`queryKeys`（`lib/api/query-keys.ts`）、`Field`/`inputClass`（抽自 `AccountCreateForm`）。

## 已知 gap（須在程式碼註解與交付說明標記）

- mustChangePassword=true 重導 `/settings/password` → F7 頁面尚未實作（SPEC 將 F7 列為「阻擋」：backend 尚未完成常見/外洩密碼拒絕與 login rate limit）。本 story 只建 gate 與路由，不建改密碼表單。
- 學員/老師專屬首頁尚未實作；非 admin 登入後暫時重導 `/`。

## 驗證

**元件測試（`test/login-form.test.tsx`，鏡射 `test/account-create-form.test.tsx` 模式）**：
- mock `@/lib/api/client`，stub `__Host-csrf` cookie。
- 欄位驗證（空欄位、過長）。
- happy path：送出 → `apiRequest` 以 `{ method: 'POST', body, mutate: false }`（**驗證不附 CSRF**）被呼叫，路徑 `/auth/login`；成功後 session 寫進 query cache、重導 `next`。
- mustChangePassword=true → 重導 `/settings/password`（不重導 `next`）。
- `AUTH_INVALID_CREDENTIALS` → 顯示「帳號或密碼不正確。」。
- 未知 code → 通用訊息，不洩露 raw `message`。
- `next` open-redirect 防護：`next=//evil.com` 或 `next=https://evil.com` 不被採用，fallback 預設。

**手動 / 瀏覽器流程**：
1. `cd smartLearning-ui && npm run dev`（port 3001）；後端 `cd smartLearning-backend && npm run start:dev`（port 3000），DB 已 migrate + bootstrap admin。
2. 開啟 `http://localhost:3001/admin/accounts/new` → 重導 `/login?next=...`。
3. 以 admin 帳密登入 → 重導回 `/admin/accounts/new`。
4. 登出 → 重導 `/login`，browser back 不重顯受保護頁（query cache 已 clear）。
5. 以 disabled 帳號或錯誤密碼登入 → 通用「帳號或密碼不正確。」訊息。
6. （若已建立 mustChangePassword 帳號）登入 → 重導 `/settings/password`（404 為預期 gap）。

**自動化驗證**：
```bash
cd smartLearning-ui
npx next typegen   # 產生 LayoutProps/PageProps
npm run typecheck
npm run lint:check
npm run build
npm test           # 含新 login/logout 測試
```

## Risk & Rollback

- **風險等級：中**。觸碰 auth 路由與 admin gate（行為變更），但都在前端、可逆、無資料遷移。
- **受影響元件**：`app/login`、`app/(admin)` admin shell、API client 使用方式（login 不附 CSRF）。
- **Rollback**：還原 `app/login/page.tsx` 為 placeholder、還原 `app/(admin)/layout.tsx`、移除新檔案。`apiRequest` 不需改（login 用 `mutate: false` 選項，未改本體）。
- **監控信號**：cookie/token 不出現在 log（前端不 log credentials；`apiRequest` 已不 log body）。