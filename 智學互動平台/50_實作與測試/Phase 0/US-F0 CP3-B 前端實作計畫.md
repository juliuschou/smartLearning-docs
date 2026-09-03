# CP3-B：建立課程 route shell 與 boundaries

## Context

CP0 已完成真實 backend/F16 gate，CP1 已判定 `not-applicable`，CP2 已在 `843b701` 完成 Course transport，CP3-A 已在 `3835801` 完成表單與 teacher-home CTA。使用者已明確確認進入 CP3-B。

本 checkpoint 只把既有 `CourseCreateForm` 接到受保護的 `/courses/new` route，並補齊 route-local loading/error/not-found UI。CP4 才處理建立成功後導向與 Course detail，因此本次不得建立 detail route、redirect 或 F1/F9 流程。

## Scope and acceptance criteria

只新增以下五個檔案：

- `app/(teacher)/courses/new/page.tsx`
- `app/(teacher)/courses/new/loading.tsx`
- `app/(teacher)/courses/new/error.tsx`
- `app/(teacher)/courses/new/not-found.tsx`
- `test/course-create-route.test.tsx`

完成後必須滿足：

- `/courses/new` 是 Server Component shell，輸出唯一 `metadata` title、唯一 `h1`、簡短說明，並直接渲染既有 `CourseCreateForm`。
- route 依賴既有 `app/(teacher)/layout.tsx` 的登入、teacher role、`mustChangePassword` gate；不新增 client-only route authorization 或重複 `canCreateCourse` gate。
- `loading.tsx` 保持 Server Component，輸出可讀且具 status/進度語意的 loading state。
- `error.tsx` 為 Client Component，接受 Next 16 route-boundary props（`error` 型別與 `reset` callback），只顯示通用、可操作的錯誤文字與「再試一次」按鈕；不讀取、渲染或 log `error.message`，不洩漏 raw backend/server detail。
- `not-found.tsx` 為 Server Component，提供清楚的 not-found 狀態與明確 `Link href="/teacher"`。
- route 測試覆蓋 metadata、唯一 h1、form delegation，以及 loading/error/not-found 的基本輸出與 retry/link 操作；測試不假設不存在的 detail route。
- 不修改 CP2 transport、teacher layout、backend、env、dependencies、runtime mock 或 E2E fixture；不新增 `app/(teacher)/courses/[courseId]/page.tsx`。

## Implementation approach

1. **Page shell**
   - 參照 `app/(teacher)/teacher/page.tsx` 的 metadata、`main`/`max-w-3xl` 版型與 heading 文案慣例；表單區可沿用 `app/(admin)/admin/accounts/new/page.tsx` 的 `max-w-md` 置中結構。
   - 匯入 `Metadata` 與 `CourseCreateForm`，只傳遞既有表單，不在 page 端讀 session、呼叫 API 或推導 owner/status。
   - 保留單一 h1「建立課程」與說明文字；成功狀態、request 欄位、CSRF/Origin、server 授權全部由既有 form/transport/backend 負責。

2. **Route boundaries**
   - `loading.tsx` 使用輕量 semantic markup（例如 `main` + `role="status"` 的 loading text），不新增 skeleton dependency。
   - `error.tsx` 使用明確 props type；只 destructure/use `reset`，將 error 視為不可呈現的 boundary input。retry button 使用 native button、可鍵盤操作，點擊只呼叫 `reset()`。
   - `not-found.tsx` 使用既有 `next/link`，返回目標固定為 `/teacher`，不連到尚不存在的 course detail。

3. **Regression test**
   - 在 `test/course-create-route.test.tsx` mock `CourseCreateForm` 與 `next/link`，讓 route shell 測試不需要 React Query 或 API runtime。
   - 直接 render page 並斷言 metadata title、唯一 level-1 heading、form marker；render loading 斷言可讀 status；render error 傳入含秘密 message 的 Error，斷言 generic text、retry button、無秘密 message 並驗證 `reset`；render not-found 斷言 link name/href。
   - 沿用現有 Vitest/jsdom、Testing Library 與 `vi.hoisted`/mock 慣例，不新增依賴或 runtime fallback。

4. **Checkpoint handoff**
   - 實作與驗證完成後，才在 `tasks/todo.md` 新增 CP3 Results（scope、變更檔、驗證結果、CP4/CP5 未完成項與 rollback）；不要覆寫 authoritative design plan、不要修改 CP2 commit、不要自行 commit。
   - 驗證通過即停在 CP3 PASS，不自動進入 CP4。

## Verification sequence

依小到大執行：

```bash
npm test -- test/course-create-form.test.tsx test/teacher-home-view.test.tsx test/course-create-route.test.tsx
npx next typegen
npm run typecheck
npm run lint:check
npm run build
git diff --check
git status --short
git diff --name-only
```

Expected evidence：targeted tests、typegen、typecheck、lint、build、diff check 全部 PASS；scope diff 僅包含上述 CP3-B 五個新檔案，及完成驗證後必要的 `tasks/todo.md` 結果紀錄。既有 `features/admin/AccountCreateForm.tsx:68` React Compiler warning 若仍出現，僅記錄，不擴大 scope。CP3-B 不執行真實 backend/Playwright 或 CP4 detail acceptance。

## Risk and rollback

- **Risk：中高（整體 CP3），本 CP3-B 實作風險中等。** Route 本身不改 auth/schema，但位於 authenticated mutation 入口；錯誤邊界若呈現 raw error 會造成資訊洩漏，若重複做 client gate 會與 server authority 不一致。
- **不變 invariant：** `canCreateCourse` 只能控制 teacher-home CTA 可見性；真正建立課程仍由既有 `apiRequest` 的 credentials/CSRF/Origin 與 backend guard 決定。Course owner/status/request shape 不在 route shell 產生。
- **Rollback：** 移除四個 route boundary/page 檔與 route test，並還原本 checkpoint 新增的 task-log 區塊即可；保留 `3835801` CP3-A 與 `843b701` CP2，不 reset working tree、不刪 runtime/domain data、不觸碰 sibling backend dirty tree。

## Dependencies and constraints

- Next.js `16.3.1` 的 App Router file conventions；已讀取本 repo `node_modules/next/dist/docs/` 的 `error.md`、`loading.md`、`not-found.md` 與 metadata guide。
- 既有 `CourseCreateForm`、`TeacherLayout`、`Providers`、Vitest/jsdom setup；不新增 package、env 或 mock server。
- UI working tree 在規劃開始時 clean，baseline `git diff --check` 已通過。
