# FE-1.2 Routing／authorization 執行計畫

## Context

`智學互動平台剩餘工作WBS.md` 的 FE-1.2.1～FE-1.2.6 仍未勾選，但目前 UI 已有 Student 登入導向、`(student)` route group、session／role／`mustChangePassword` gates 與 logout。這次不重做既有 routing，而是以現況稽核、缺口補強、真實環境驗收與文件閉環為主。

主要缺口：

- `StudentLayout` 沒有直接 regression suite。
- role-neutral `ProtectedLayout` 沒有直接測試，尚未鎖住 force-change 使用者可進 `/settings/password` 的例外。
- logout request 失敗時仍導向 `/login`，但目前只在成功時清除 React Query cache。
- WBS 與實際程式狀態不同步。

安全邊界：frontend layouts 僅負責 UX／導覽隔離；backend session 與 role guards 仍是 authorization authority。依 Next.js 16 文件，本工作不新增 `proxy.ts` 或 `middleware.ts`。

## Scope

### Included

- 核對 Student 無 `next` 登入後導向 `/student`。
- 核對既有 Student route group/layout。
- 補齊 session、Student role、`mustChangePassword` 與 protected settings layout 測試。
- logout 無論 server 成功或失敗，都清除整個本地 QueryClient cache，再以 replace 導向 `/login`。
- 執行 targeted → full static/unit → real-backend browser 驗收。
- 每一階段停在 Checkpoint，等候使用者手動確認。
- 最後才同步 UI task record 與權威 WBS。

### Explicit non-goals

- FE-1.3「我的課程」UI／pagination 改動。
- Backend、DB、schema、migration 或 API contract 改動。
- 新增 `proxy.ts`／`middleware.ts`。
- 改訂 role-incompatible `next` policy。
- 抽 shared routing helper 或整理無關程式碼。
- 將 frontend layout 描述為安全授權邊界。

## Acceptance criteria

- Student 正常登入、無有效 `next` 時使用 `router.replace("/student")`。
- session loading 期間不 render protected children。
- 無 session 時導向 `/login?next=<encoded pathname>`。
- admin／teacher session 不得 render Student children。
- `mustChangePassword=true` 優先導向 `/settings/password`，早於 role gate。
- `/settings/password` 對已登入的 force-change 使用者保持可用，且不套 role gate。
- logout request 使用既有 CSRF-aware mutation；成功或失敗後整個 QueryClient cache 都被清空，並 replace 到 `/login`。
- StudentLayout、ProtectedLayout 與 logout success/failure 都有 regression coverage。
- targeted tests、完整 tests、typegen、typecheck、lint、build、`git diff --check` 通過。
- 真實 backend browser matrix 經使用者手動確認後，才勾選 FE-1.2 WBS。

## Execution plan

### Checkpoint 0 — Baseline／範圍確認（修改前停止）

1. 閱讀 `tasks/lessons.md`，記錄 branch、HEAD 與 working tree；不吸收既有無關變更。
2. 執行既有 FE-1.2 鄰近 baseline：
   - `npm test -- test/login-form.test.tsx test/change-password-form.test.tsx test/logout.test.tsx test/teacher-layout.test.tsx`
   - `npm run typecheck`
3. 建立六項 WBS audit matrix：既有實作證據、測試證據與剩餘缺口。
4. 將 FE-1.2 checklist、acceptance、Risk & Rollback、Dependencies & Environment、Working Notes 寫入 `smartLearning-ui/tasks/todo.md`。

**STOP：回報 baseline、audit matrix 與預定 changed-file list，等候使用者手動確認後才修改 production/tests。**

### Checkpoint 1 — Focused implementation review（最小修正後停止）

1. 新增 `test/student-layout.test.tsx`，直接沿用 `test/teacher-layout.test.tsx` 的 `vi.hoisted` mock 方式，覆蓋：
   - loading 不 render children；
   - force-change 優先於 role gate；
   - missing session + encoded pathname；
   - admin／teacher wrong-role；
   - null pathname fallback `/student`；
   - valid student shell、password link、logout 與 children。
2. 新增 `test/protected-layout.test.tsx`，覆蓋：
   - loading；
   - missing session + encoded pathname；
   - null pathname fallback `/settings/password`；
   - 任一已登入角色可 render；
   - `mustChangePassword=true` 可留在 password route；
   - settings shell 與 logout。
3. 在 `lib/api/auth.ts` 將 logout cache clear 從 `onSuccess` 移至 `onSettled`，確保 logout attempt 成功或失敗都清除本地 protected cache；保留 `LogoutButton` 的 error UI 與 `router.replace("/login")`。
4. 更新 `components/auth/LogoutButton.tsx` 與 hook 註解，避免繼續描述 success-only 行為。
5. 擴充 `test/logout.test.tsx`：先 seed session 與代表性 protected query，分別證明 success/failure 都清空整個 cache；failure 仍顯示既有錯誤並 replace 到 login。
6. 執行 focused gate：
   - `npm test -- test/student-layout.test.tsx test/protected-layout.test.tsx test/logout.test.tsx test/login-form.test.tsx test/change-password-form.test.tsx test/teacher-layout.test.tsx`
   - `npm run typecheck`
   - `npm run lint:check`
   - `git diff --check`

**STOP：提供 changed files、focused test counts、靜態檢查結果及 logout `onSettled` 行為摘要，等候使用者手動確認後才跑完整驗證。**

### Checkpoint 2 — Full verification／真實瀏覽器驗收（文件收尾前停止）

1. 執行完整 frontend verification；測試與 build 預設交由 dedicated test subagent 執行並回傳精簡報告：
   - `npx next typegen`
   - `npm test`
   - `npm run typecheck`
   - `npm run lint:check`
   - `npm run build`
   - `git diff --check`
2. 確認 build route set 仍包含 `/login`、`/student`、`/settings/password`，且未新增 proxy/middleware 或 FE-1.3/backend 改動。
3. 使用真實 backend 與隔離測試帳號執行 browser matrix：
   - Student 無 `next` 登入 → `/student`。
   - 未登入開 `/student` → `/login?next=%2Fstudent`，登入後還原目的地。
   - admin／teacher 開 `/student` → 不顯示 Student 內容，記錄既有 redirect。
   - force-change Student 登入 → `/settings/password`；改密碼成功 → `/student`。
   - 已登入角色可進 `/settings/password`；未登入者會被 gate。
   - successful logout 後 Back 不重顯 cached protected data。
   - failed／expired logout 若可安全重現，也不得重顯 cache；若環境無法安全重現，明確標記 constrained，採 automated rejection-path test 作證據。
4. 回報 browser matrix 的 PASS／FAIL／CONSTRAINED、環境與最小 console/network evidence。

**STOP：不可更新 WBS checkbox。等候使用者親自確認真實瀏覽器行為並明確接受 Checkpoint 2。**

### Checkpoint 3 — Documentation／WBS closeout（最終停止）

僅在 Checkpoint 2 確認後：

1. 更新 `smartLearning-ui/tasks/todo.md` Results：變更、路徑、驗證 commands/results、browser matrix、限制、backend-authority 聲明。
2. 更新權威文件 `docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md`，將 FE-1.2.1～FE-1.2.6 勾選完成；不得提前勾選或把 constrained 項宣稱為 PASS。
3. 執行 final `git diff --check`、兩個 repository 的 status／diff stat，確認文件與程式 repo 的變更邊界。
4. 提供最終 diff-oriented summary、完整 verification story、未解限制與 rollback 說明。

**STOP：等候使用者最終 sign-off；未取得確認前不宣告 FE-1.2 完成。**

## Critical files

### Expected modifications

- `smartLearning-ui/lib/api/auth.ts`
- `smartLearning-ui/components/auth/LogoutButton.tsx`
- `smartLearning-ui/test/logout.test.tsx`
- `smartLearning-ui/test/student-layout.test.tsx`（new）
- `smartLearning-ui/test/protected-layout.test.tsx`（new）
- `smartLearning-ui/tasks/todo.md`
- `docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md`（Checkpoint 2 核准後）

### Existing sources to preserve/reuse

- `smartLearning-ui/app/(student)/layout.tsx`
- `smartLearning-ui/app/(protected)/layout.tsx`
- `smartLearning-ui/test/teacher-layout.test.tsx`
- `smartLearning-ui/features/auth/LoginForm.tsx`
- `smartLearning-ui/features/auth/ChangePasswordForm.tsx`
- `smartLearning-ui/lib/auth/session.ts`
- `smartLearning-ui/lib/api/enrollments.ts`

## Risk & rollback

- **Risk：medium**。Auth-adjacent redirect、cache lifecycle 與 protected-route UX，但無 backend/schema/data migration。
- `onSettled` 會在 logout failure 時清除所有 query data；這是刻意的 fail-closed 本地安全行為，因 UI 同時已決定返回 login。透過 success/failure mounted tests 防止 lifecycle regression。
- Gate ordering 可能造成 redirect loop 或 protected content flash；以 direct layout tests 鎖住 loading → must-change → session/role → render 順序。
- Rollback 可分離進行：還原 logout callback／comments；移除兩個新 test suites；最後獨立還原 WBS/task record。無 DB/API rollback。

## Dependencies & environment

- UI：Node 24+、Next.js 16.3.1、React 19、React Query 5、Vitest/jsdom。
- typecheck 前先執行 `npx next typegen`。
- Browser checkpoint 需要真實 backend、migrated DB、明確 CORS origin、隔離的 student/admin/teacher fixtures；不可用 mock/placeholder 取代。
- 若真實環境被阻塞，保留程式與 static/unit evidence，但 WBS 不提前標示完整通過。
