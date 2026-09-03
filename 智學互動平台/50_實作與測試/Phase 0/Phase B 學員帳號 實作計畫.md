# Phase B 前端切片：學員帳號 + 我的課程

> 本計畫獨立於 `SPEC F0-F17 前端實作計畫.md`。該 SPEC 基線仍採匿名學員（student/enrollment UI 明列延後，見該檔第 5、98 行）。Phase B 後端已完成（commit `506543c`）後，此為 student/enrollment UI 的另立故事，先做最小起點切片：學員帳號能上線 + 學生登入後看「我的課程」。課堂加入/作答/即時、老師加選名冊 UI 留待後續切片。

## Context

Phase B 後端已完成並提交（commit `506543c`，分支 `phase-b-student-enrollment`）：`student` role、`CourseEnrollment` model、`/me/courses`、`/courses/:courseId/enrollments`、account-bound `Participant`、student cookie join/submit、realtime student handshake 全部就緒，且 `smartLearning-backend/docs/frontend-api-reference.md` 已記錄完整契約。

依 **Option B 策略**（後端先、再做前端，無 mock），現在輪到前端。本計畫只做使用者確認的**最小起點切片**：學員帳號能上線 + 學生登入後看「我的課程」。課堂加入/作答/即時、老師加選名冊 UI 留待後續切片（本計畫不涵蓋）。

### 為什麼這個切片
- 目前前端只有 `(admin)` 路由組（`session.role === 'admin'` 才能進），學生登入後無落腳頁（`LoginForm` 的 `resolveNext` 把非 admin 一律導向 `/`，首頁仍是 starter 標語）。
- `AccountCreateForm` 只提供 `admin|teacher` role，無法建立學生帳號 — 但後端 DTO 早允許 `student`。
- 需求升級（MVP 原列「無學員帳號」），前端要讓學生帳號真正可用。

### 風險等級：中
- 涉及 auth/role gate（學生專屬路由保護），但不觸碰 realtime/cookie-bind-participant handshake（最高風險部分已延後）。
- 變更多為**新增**路由 + 小改既有表單；既有 admin 路由與匿名路徑不受影響。

---

## 既有可復用資產（不要重造）

- API client：`lib/api/client.ts` — `apiRequest<T>(path, { method, body, mutate, signal })`，自動帶 cookie/CSRF/Origin、unwrap envelope 到 `body.data`。
- Session：`lib/auth/session.ts` — `useSession()` 回 `{ session, isLoading, isAuthenticated }`，session 為 `SessionDto | null`。
- Query keys：`lib/api/query-keys.ts` — 集中式 factory，新 domain 加這裡。
- Form pattern：`features/auth/LoginForm.tsx`、`features/admin/AccountCreateForm.tsx` — `react-hook-form` + `zod` + `ErrorAlert` + `Field`；`ApiRequestError` 分類錯誤。
- UI primitives：`components/ui/Field.tsx`（`Field` + `inputClass`）、`components/ui/ErrorAlert.tsx`、`components/auth/LogoutButton.tsx`。
- Admin layout gate pattern：`app/(admin)/layout.tsx` — `useSession()` → loading / mustChangePassword / role check / redirect to `/login?next=`。
- 登入後 redirect：`LoginForm.resolveNext` — 已對 `next` 做 same-origin 防開放重導，role-based fallback（admin→`/admin`，其他→`/`）。
- 後端契約（envelope-unwrapped 後）：`MyCourseDto = { enrollmentId, courseId, name, description, status, ownerAccountId, enrolledAt, createdAt, updatedAt }`；`GET /me/courses?page&pageSize` 回 `Page<MyCourseDto> = { data: [...], meta: { page, pageSize, total, totalPages } }`。守護：Session + StudentGuard。
- 後端 `POST /admin/accounts` body：`{ username, displayName, role, canCreateCourse, tempPassword }`；`student` 的 `canCreateCourse` 後端恆強制 false。守護：Session + CSRF + Admin。

---

## 實作步驟

### 1. 開放 `AccountCreateForm` 的 student role 選項
`features/admin/AccountCreateForm.tsx`：
- `ROLES` 加 `{ value: 'student', label: '學生' }`。
- `schema.role` 改 `z.enum(['admin', 'teacher', 'student'])`。
- `defaultValues.role` 維持 `'teacher'`（避免誤建學生）。
- role `onChange` 分支：`admin`→`canCreateCourse=true`（既有）；**`student`→強制 `canCreateCourse=false` 且不顯示該欄位**（student 不可建課）；`teacher`→顯示勾選（既有）。
- `canCreateCourse` 欄位顯示條件：`role === 'teacher'` 才顯示（`admin`/`student` 都不顯示）。送出時 `student` 仍帶 `canCreateCourse: false`（後端亦會強制）。
- 更新表單說明文字（`form-instructions`）與成功訊息，涵蓋學生（學生帳號同樣 `mustChangePassword=true` 首登改密）。
- `setValue('role', ...)` 的 cast 型別擴充為 `'admin' | 'teacher' | 'student'`。
- `lib/api/types.ts` 的 `CreateAccountPayload.role` 已是 `AccountRole`（含 `student`）— 無需改型別。

### 2. 新增「我的課程」API hook + 型別
- `lib/api/types.ts`：加 `MyCourseDto`、`Page<T>` 通用型別（`{ data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }`）。
- `lib/api/query-keys.ts`：加 `myCourses: { all: ['my-courses'] as const }`。
- 新檔 `lib/api/enrollments.ts`：`useMyCourses()` — `useQuery` 呼 `apiRequest<Page<MyCourseDto>>('/me/courses')`，`enabled` 取決於 `useSession().session?.role === 'student'`（避免非學生觸發 403）。沿用 `queryFn: ({ signal }) => apiRequest(...)`、`retry: false`、`staleTime` 依既有 session 慣例（30s）。

### 3. 學生專屬路由組 + layout
- 新增 `app/(student)/layout.tsx`：仿 `app/(admin)/layout.tsx` gate：
  - loading → placeholder「載入中…」。
  - `mustChangePassword` → redirect `/settings/password`（與 admin 一致，F7 未實作為已知 gap）。
  - 未登入或 `role !== 'student'` → redirect `/login?next=<pathname>`。
  - 渲染學生殼 header（「學員專區」+ `LogoutButton`）。
- 新增 `app/(student)/student/page.tsx`（route group `(student)` 不影響 URL，需選一明確路徑如 `/student`）：用 `useMyCourses()` 渲染「我的課程」列表（卡片/列：name、description、status、enrolledAt）；空狀態、載入中、錯誤（`ErrorAlert`）三態。
  - 路由結構：`app/(student)/student/page.tsx` → URL `/student`。route group `(student)` 僅供 layout 隔離，不改 URL。

### 4. 登入後 redirect 改為支援學生
`features/auth/LoginForm.tsx` 的 `resolveNext`：
- role-based fallback 由 `admin → /admin`、其他 → `/`，改為 `admin → /admin`、`student → /student`、其他（teacher）→ `/`（teacher home 未實作，暫留 `/`，日後 P2 老師端再接）。
- `next` 同源檢查邏輯不變。
- 更新 `resolveNext` 註解說明。

### 5. 首頁微調（可選，低風險）
`app/page.tsx` 目前是 starter 標語。登入使用者看到 `/` 仍顯示標語無害；**本切片不改**，避免擴大範圍。學生登入直接被 `resolveNext` 導向 `/student`，不會停在 `/`。

---

## 關鍵檔案

| 動作 | 檔案 |
|---|---|
| 改 | `features/admin/AccountCreateForm.tsx`（student role + canCreateCourse 隱藏） |
| 改 | `features/auth/LoginForm.tsx`（`resolveNext` 加 student→`/student`） |
| 改 | `lib/api/types.ts`（`MyCourseDto`、`Page<T>`） |
| 改 | `lib/api/query-keys.ts`（`myCourses`） |
| 新 | `lib/api/enrollments.ts`（`useMyCourses`） |
| 新 | `app/(student)/layout.tsx`（學生 gate 殼） |
| 新 | `app/(student)/student/page.tsx`（我的課程頁） |

---

## 不在本切片（後續切片）

- 老師加選/移除/名冊 UI（`POST/DELETE/GET /courses/:courseId/enrollments`）— 學生目前無法自行加選，需先有 teacher roster UI 才能讓學生有課可看；**過渡期以手動/CLI 加選或後端 seed 產生資料驗證**（見驗證段）。
- 學生課堂參與（cookie join / snapshot / submit / results / Socket.IO）。
- F7 變更密碼頁（既有 gap，非本切片）。

---

## 驗證

### 前端靜態 gate
```bash
cd smartLearning-ui
npm run typecheck   # 需先 npx next typegen（Next 16 全域 LayoutProps/PageProps helper）
npm run lint:check
npm run format:check
npm run build
```
新檔先 `npx prettier --write` 再 lint（lessons.md：format 先於 lint，避免格式誤差遮蔽行為驗證）。

### 端到端手動 repro（需後端 running）
1. 後端：`cd smartLearning-backend && npm run start:dev`（port 3000）+ 已 migrate 的 dev DB。
2. admin 登入 `/login` → `/admin/admin/accounts/new` → 建一個 **student** 帳號（驗證 role 選項出現、canCreateCourse 欄位隱藏、成功訊息正確）。
3. 該 student 登入 → 驗證 redirect 到 `/student`（非 `/`）；`mustChangePassword` 路徑已知 404（gap）。
4. `/student` 頁面：
   - **空狀態**：新學生無加選 → 顯示「尚未加選任何課程」。
   - **有資料**：用後端手動加選（例如 `curl` admin cookie `POST /courses/:courseId/enrollments` 或 DB seed 一筆 `course_enrollment` status=active）→ 重新整理 → 列表顯示課程 name/description/status/enrolledAt。
   - **權限**：teacher/admin 帳號直接訪 `/student` → 被 layout redirect 到 `/login?next=/student`（不洩漏學生頁）；未登入訪 `/student` → redirect `/login?next=/student`。
5. 登出按鈕（殼 header）→ 清 cache → 回 `/login`。

### 後端 contract 對照（不跑後端測試，僅確認契約）
- `GET /me/courses` 403 給非 student（StudentGuard）— 前端 `useMyCourses` 以 `enabled: role==='student'` 避免觸發。
- 回應 unwrap：外層 envelope `data` 內才是 `Page<MyCourseDto>`（兩層 meta 差異已記於 API ref line 80）。

### 信心範圍
- 靜態 gate：module-level（typecheck/lint/build）。
- 行為：手動 repro（受限於需手動加選產生資料；自動化 e2e 待 teacher roster UI 切片再做）。

---

## 風險與 rollback

- **風險：中**。auth gate 變更（新增 student gate），但不觸 realtime/cookie-bind。
- **Rollback**：本切片皆為新增檔案 + 兩處小改（form role、login redirect）。回滾 = revert 本切片 commit；既有 admin/匿名路徑不受影響。
- **已知 gap 保留**：`mustChangePassword` redirect 仍落 `/settings/password` 404（F7 未實作），與 admin 路由一致，非本切片引入。
- **過渡資料依賴**：學生「我的課程」要有資料需先加選，但 teacher roster UI 在下一切片 — 驗證時以手動加選/seed 替代，並在 PR 註明。