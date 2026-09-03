# CP4 — Course detail 與建立成功導向

## Context

使用者已明確要求在 US-F0 老師建立課程流程進入 CP4。CP0 final rerun 已通過真實 backend/F16 gate，CP1 判定 `not-applicable`，CP2 transport 與 CP3-A/B create UX/route shell 均已完成；目前 UI HEAD 為 `6d0b2cb`。CP3 明確未包含 Course detail 或建立成功後導向，因此本次只補上 server-backed detail slice，不跨入 F1 編輯/封存、F9 題目功能或 CP5 真實 Playwright 驗收。

權威規格為 `docs/智學互動平台/50_實作與測試/US-F0 老師建立課程前端實作計畫.md` CP4（約第 92–103 行）及 `SPEC F0-F17 前端實作計畫.md`。已核對後端 `/api/v1/courses/:id`：Course owner/admin 可讀，非 owner 以 404 隱藏存在性；回傳 `CourseDto` 含 `id`、`name`、`description`、`status`、`ownerAccountId`、`createdAt`、`updatedAt`。UI 已有可重用的 `useCourse(courseId)`，不需新增 API、後端、環境變數或依賴。

## Acceptance criteria

- 建立成功後只使用 server response 的 Course ID，以 same-origin `router.replace('/courses/:id')` 導向真實 detail；不使用 client 生成的 Course、假資料或可控 redirect。
- `/courses/[courseId]` 位於既有 `(teacher)` protected route group；dynamic page 使用 Next 16 的 `params: Promise<{ courseId: string }>` 並 `await params`。
- Detail 由既有 `useCourse(courseId)` 取得 server state，呈現 Course 名稱、`draft`/`archived` status、`ownerAccountId` 並明確表達建立者是唯一老師；不加入共同授課、所有權移轉、編輯/封存控制。
- loading、unexpected error、not-found 狀態有 route-local boundaries；client query 的 404 也只顯示不具枚舉性的 generic not-found 文案，不渲染 Course ID、raw backend message 或其他 Course 資訊。
- F9 題目流程尚未有本 CP 可依據的整合入口：detail 只顯示明確的 non-navigating deferred/blocked state（或完全省略），不建立 dead link、假頁面或 placeholder route。
- 補齊 detail render、route/params、404/error boundary 與 create redirect 的 focused regression tests；不修改 backend 或 CP2 transport contract。

## Recommended implementation

### 1. Connect create success to the real detail route

Modify `features/courses/CourseCreateForm.tsx`:

- Reuse `useCreateCourse()` and import `useRouter` from `next/navigation`.
- After `mutateAsync` resolves, call `router.replace(`/courses/${course.id}`)`; keep the existing try/catch so `ErrorAlert` remains the source of stable mutation errors.
- Remove the CP3-only in-place success projection if it is no longer needed; the server-backed detail page becomes the only post-create success surface. Do not add a second request, optimistic state, owner/status payload, or F9 navigation.
- Preserve validation, pending/duplicate-submit behavior, CSRF/Origin behavior from `apiRequest`, and curated error handling.

Update `test/course-create-form.test.tsx` using a hoisted `next/navigation` router mock (following the repository’s Vitest mock lesson): assert the server-returned ID produces exactly `/courses/course-1`, success does not expose a raw response as a substitute for navigation, and failed/invalid submissions never call `replace`.

### 2. Add the detail client view

Add `features/courses/CourseDetailView.tsx` as a small Client Component:

- Call `useCourse(courseId)` and render deterministic loading, error, missing-data, and success states.
- For a typed `ApiRequestError` with HTTP 404, render a generic no-enumeration not-found state; for other errors, use `ErrorAlert` with the typed error or an `INTERNAL_ERROR` fallback, never `error.message`.
- On success, render accessible definition-list/content semantics: course name, exact lifecycle value (`draft` or `archived`), and `ownerAccountId` under a label that states it is the single teacher/owner. Showing the DTO’s owner ID is the only owner identity available in the contract; do not invent a display name or additional teacher list.
- Add a short non-interactive F9-deferred status with no link/button, or omit the entry entirely. Do not add question APIs, route guesses, edit/archive controls, or local authorization checks.

Add `test/course-detail-view.test.tsx` with deterministic React Query/API-boundary mocks covering loading, successful `draft` + owner/single-teacher rendering, 404 generic state with no leaked ID/raw message, stable non-404 error, and no F9 dead link.

### 3. Add the protected dynamic route and boundaries

Add under `app/(teacher)/courses/[courseId]/`:

- `page.tsx`: Server Component with `params: Promise<{ courseId: string }>`; await it, render one metadata/title + `h1`, a fixed back link to `/teacher`, and `CourseDetailView courseId={courseId}`. The page must not fetch with an unauthenticated server-side shortcut or duplicate the teacher/session gate.
- `loading.tsx`: lightweight accessible `role="status"`/`aria-live` loading state.
- `error.tsx`: Client Component with a generic retry action; ignore the supplied error object for display/logging so raw server details cannot leak.
- `not-found.tsx`: generic not-found UI with a fixed `/teacher` return link and no course identifier.

Add `test/course-detail-route.test.tsx` to await the async page, assert metadata/unique heading/back link, verify the resolved `courseId` is passed to the detail view, and cover loading/error/not-found boundary behavior including retry and raw-message suppression. Follow the existing `/courses/new` boundary style and current Next 16 docs (`dynamic-routes`, `loading`, `error`, `not-found`).

## Scope guard and risk/rollback

- **In scope:** one feature view, one existing form redirect, one dynamic route plus three boundaries, and focused tests; `tasks/todo.md` result/handoff update after verification.
- **Out of scope:** `lib/api/*` contract changes, backend/controller/DTO/schema changes, env/dependencies, Course list, F1 edit/archive, F9 questions, live sessions, mock API/MSW/runtime fixtures, and real CP5 browser acceptance.
- **Risk:** medium. The change is authenticated navigation/read state; the main risks are leaking 404 existence/raw errors and accidentally treating `canCreateCourse` as server authorization. Backend remains authoritative and the existing protected layout remains the only route auth gate.
- **Rollback:** revert/remove only the CP4 form redirect, detail feature, dynamic route/boundaries, focused tests, and CP4 task-log section. Preserve commits `843b701`, `3835801`, `6d0b2cb`, existing auth/F16 work, and all backend/runtime data; do not reset the working tree or sibling repository.

## Verification

Run the smallest relevant checks first, then the static gates:

```bash
npm test -- test/course-create-form.test.tsx test/course-detail-view.test.tsx test/course-detail-route.test.tsx
npx next typegen
npm run typecheck
npm run lint:check
npm run build
git diff --check
git status --short
git diff --name-only
```

Expected scope is the listed CP4 product/test files plus the CP4 task-log entry. Record any existing non-blocking React Compiler/Vite warnings without expanding scope. Do not claim CP5: the real backend Playwright flow remains a separate checkpoint requiring the isolated fixture, UI port 3001, exact CORS, CSRF/Origin, owner/unique-teacher and no-leak evidence.

After implementation, update `tasks/todo.md` with CP4 status, changed files, test counts/commands, F9 blocked decision, residual CP5 blocker, and rollback notes. Stop at CP4 PASS (or `blocked` with evidence); do not begin CP5 automatically.
