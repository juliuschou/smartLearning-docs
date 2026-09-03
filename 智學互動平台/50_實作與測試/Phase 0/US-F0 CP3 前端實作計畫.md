# US-F0 CP3 — Course create UX

## Context

CP0 已完成真實 backend/F16 gate，CP1 已判定 `not-applicable`，CP2 已在 `843b701` 完成並驗證 Course transport。使用者已明確授權進入 CP3，要求在 checkpoint 停下來手動確認。

本次只完成 **CP3 Course create UX slice**：讓受保護的 teacher route 提供建立課程表單與入口，並保留 server 授權為唯一權威。CP4 才處理 Course detail 與建立成功後導向，因此 CP3 不建立 `[courseId]`、detail UI 或 F1/F9 入口。

## Success criteria

- `CourseCreateForm` 只呈現 `name` 與 optional `description`，沿用既有 `Field`、`ErrorAlert`、React Hook Form、Zod 與 `useCreateCourse()`。
- request 只經 CP2 hook 送出 `name`/defined `description`；不新增 owner、status、teacher、ownership、idempotency 或其他欄位。
- name/description 的 client validation 對齊已確認 backend bounds：name 1–200、description 最多 2,000；不自行發明 duplicate-name 語意或 fallback。
- pending 時 submit control disabled，快速重複點擊不會產生第二次 mutation；server error 保留穩定 code 顯示，不渲染 raw backend message。
- stale session 或直接進入 `/courses/new` 不使用 client-only authorization gate；backend `403` 可觀察，且不出現成功狀態。
- teacher home 僅在 `session.canCreateCourse === true` 顯示 `/courses/new` CTA；false 時顯示明確、非只靠顏色的不可開課狀態。
- `/courses/new` 使用 Server Component shell、唯一 metadata/h1，並提供 route-local `loading.tsx`、`error.tsx`、`not-found.tsx`；error boundary 不記錄或顯示 raw error。
- CP3 完成後不含 Course detail、success redirect、F1 編輯/封存、F9 題目流程、backend/env/dependency/mock/E2E 變更。

## Checkpoint sequence

### CP3-A — Form and teacher entry

在 plan approval 後，先實作 `CourseCreateForm` 與 teacher-home CTA/disabled state，新增/更新 component tests。執行 targeted Vitest 與 scope review；若通過，**停止並等待使用者手動確認**，不自動進入 route shell。

### CP3-B — Create route shell and boundaries

取得手動確認後，新增 `/courses/new` Server Component page 與三個 route boundaries，補 route/metadata/boundary tests。執行 `next typegen`、typecheck、lint、build、diff/scope gate；若通過，**停止在 CP3 PASS**，不跨入 CP4。

任何 targeted test、typecheck、lint 或 build 失敗時停止加碼，保留證據並回到診斷；不以 mock、fallback 或 placeholder 繞過失敗。

## Implementation plan

1. **Create form** — 新增 `features/courses/CourseCreateForm.tsx`。
   - 使用 `"use client"`、`zodResolver`、`useForm`、`Field`、`inputClass`、`ErrorAlert`、`ApiRequestError`。
   - `name` 與 `description` 各自具備 label、hint/error id、`aria-describedby`、keyboard-native control；form 使用 `noValidate`。
   - submit 以 `mutateAsync` 呼叫 `useCreateCourse()`，只傳 `{ name, description? }`；optional 空值轉為未定義，不 trim 或推導未確認的 server 規則。
   - `isSubmitting || mutation.isPending` 時停用 submit；每次新提交先清除舊 success state，避免後續 403 與舊成功訊息並存。
   - 成功只顯示 server response 驅動的 `role="status"`（例如建立成功與 server 回傳的課程名稱/status），不導航到尚不存在的 detail route；不顯示任何假 detail/F9 入口。CP4 再接上 success redirect。
   - 失敗使用既有穩定 error mapping；403/其他 failure 不設定 success，輸入值保留以便修正後重試，不記錄 credentials/cookies/CSRF/raw message。

2. **Teacher entry state** — 修改 `features/teacher/TeacherHomeView.tsx`。
   - 保留既有 session identity 與 `可以開課`/`目前無法開課` 資訊。
   - flag true 時加入既有 inline CTA convention 的 `Link href="/courses/new"`，使用可讀名稱與鍵盤可達 focus style。
   - flag false 時不 render create link，顯示明確文字說明目前無開課權限；不可只依賴顏色或 disabled-looking styling。
   - 不把 flag 當成 route/server authorization，不修改 `(teacher)` layout 或 session transport。

3. **Route shell and boundaries** — 新增：
   - `app/(teacher)/courses/new/page.tsx`：Server Component，export unique `metadata`，單一 h1，渲染 `CourseCreateForm`；依賴既有 `(teacher)/layout.tsx` 的登入、role、must-change-password gate。
   - `app/(teacher)/courses/new/loading.tsx`：輕量、可讀的 loading state，維持 server default。
   - `app/(teacher)/courses/new/error.tsx`：`"use client"` error boundary，使用 Next 16 的 reset/retry callback；只顯示通用、可操作錯誤與重試按鈕，不讀取或 log error.message。
   - `app/(teacher)/courses/new/not-found.tsx`：route-local not-found state 與返回 `/teacher` 的明確 Link；不建立 Course detail 或 F9 dead link。

4. **Regression coverage** — 新增/更新：
   - `test/course-create-form.test.tsx`：required/max-bound validation 不呼叫 API；exact mutation payload；success status；pending duplicate click 只有一次 mutation；403/typed error 顯示穩定訊息、不顯示 raw detail、無 success state；labels/aria-describedby/keyboard path。
   - `test/teacher-home-view.test.tsx`：flag true 的 CTA href/accessible name；flag false 無 CTA 且有非色彩唯一的 unavailable text；既有 identity assertions 保持通過。
   - `test/course-create-route.test.tsx`：page metadata/h1/form delegation，以及 loading/error/not-found boundary 的輸出/基本可操作元素；不測試不存在的 detail route。
   - 測試沿用既有 fresh `QueryClientProvider`、mutation retry false、Vitest hoisted mocks 與 API boundary mock pattern；不新增 runtime mock 或依賴。

5. **Task log and handoff** — CP3 驗證完成後才更新 `tasks/todo.md`：記錄 CP3 scope、checkpoints、變更檔、驗證結果、未完成的 CP4/CP5 blocker 與 rollback；不覆寫 authoritative design plan，不修改 CP2 commit，不 commit 未經明確授權的變更。

## Critical files

**新增**

- `features/courses/CourseCreateForm.tsx`
- `app/(teacher)/courses/new/page.tsx`
- `app/(teacher)/courses/new/loading.tsx`
- `app/(teacher)/courses/new/error.tsx`
- `app/(teacher)/courses/new/not-found.tsx`
- `test/course-create-form.test.tsx`
- `test/course-create-route.test.tsx`

**修改**

- `features/teacher/TeacherHomeView.tsx`
- `test/teacher-home-view.test.tsx`
- `tasks/todo.md`（僅完成 CP3 後記錄結果）

**保持不變**

- CP2 transport files：`lib/api/types.ts`、`lib/api/query-keys.ts`、`lib/api/courses.ts`。
- `app/(teacher)/layout.tsx`、backend、schema、env、dependencies、public root、student flow。
- 不新增 `app/(teacher)/courses/[courseId]/page.tsx`。

## Risk and rollback

- 風險：中高；涉及 authenticated mutation、CSRF/Origin transport boundary 與 stale permission UX，但不改 backend/schema。
- server authority invariant：`canCreateCourse` 只能影響 CTA 可見性；真正 POST 仍由既有 `apiRequest` 的 credentials/CSRF/Origin 與 backend guard 決定。
- rollback：只移除/還原 CP3 listed files and `TeacherHomeView`/tests/task log；保留 CP2 commit、既有 auth/F16/student/teacher work，不 reset working tree、不刪 runtime/domain data。

## Verification

依 CP3 scope 由小到大執行：

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

Expected evidence：targeted component/route tests PASS；typegen 產生/更新 route types；typecheck、lint、build、diff check PASS；diff 僅包含 CP3 listed files 加 `tasks/todo.md`。已知既有 `features/admin/AccountCreateForm.tsx:68` React Compiler warning 可保留並記錄。CP3 不執行真實 Playwright 或 CP4 detail acceptance；那些留到後續 checkpoint，不能以 component mock 取代。
