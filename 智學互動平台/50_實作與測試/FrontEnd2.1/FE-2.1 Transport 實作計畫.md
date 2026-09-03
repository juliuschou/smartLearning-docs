# FE-2.1 Transport 實作計畫

## Context

FE-2.1 要完成 Teacher Enrollment Roster 的五個 transport 項目：名冊分頁、學生搜尋、加選、移除，以及 React Query invalidation。現有前端已在 FE-1.1 建立共用 `apiRequest`、wire types、query-key factory 與 hook/test 模式，應直接延伸，不新增 HTTP client、Next.js Route Handler、mock 或 dependency。

目前 list/add/remove 的 backend runtime contract 已可追溯，但權威 WBS 的 BE-2 尚未正式關閉；更重要的是 FE-2.1.2 尚無 teacher-accessible student-search API。`GET /admin/accounts` 是 admin-only，不能重用。故本計畫先設 **CP0 契約閘門**；搜尋契約未凍結前不修改產品碼，也不將 FE-2.1 標為完成。

## Scope 與成功條件

包含：
- course-scoped enrollment roster list/pagination query。
- teacher/admin 可用的 student search query（待 BE-2 凍結）。
- add/reactivate 與 idempotent remove mutations。
- course-scoped query keys、精準 invalidation 與 transport tests。
- `tasks/todo.md` 的 checklist、風險、驗證與結果紀錄。

不包含：FE-2.2 UI、搜尋 debounce/combobox、確認 dialog、錯誤文案、accessibility、Playwright browser acceptance、backend 實作、mock/placeholder、WBS 勾選（需完整 evidence 與另行授權）。

成功時：五個 transport 項目皆對齊正式 backend contract；active/removed rows 與 server ordering 不被前端改寫；mutations 僅在成功後失效受影響 course caches；所有 focused/static/full gates 通過。

## CP0 — BE-2 契約閘門（阻塞性）

1. 由 backend/OpenAPI/DB-backed evidence 正式確認既有契約：
   - `GET /courses/:courseId/enrollments?page&pageSize` → `Page<EnrollmentDto>`；預設 1/20、上限 100；含 active + removed；排序 `createdAt ASC, id ASC`。
   - `POST /courses/:courseId/enrollments`，body 僅 `{ studentAccountId }`，HTTP 201 → `EnrollmentDto`；active duplicate 回原 row，removed row reactivation；archived add/reactivation → 409 `COURSE_NOT_EDITABLE`。
   - `DELETE /courses/:courseId/enrollments/:studentAccountId`，HTTP 200 → `null`；idempotent status transition，不刪除 roster row；archived removal 允許。
   - owner teacher/admin 可操作；non-owner teacher 隱藏為 404；student 403。
   - DTO 欄位：`id`, `courseId`, `studentAccountId`, `status`, `enrolledAt`, `createdAt`, `updatedAt`, `student { id, username, displayName }`。
2. BE-2 必須新增或正式凍結 dedicated teacher student-search contract；不得使用 `/admin/accounts`。建議 course-scoped：
   - `GET /courses/:courseId/students/search?q=&page=&pageSize=` → `Page<StudentSearchResultDto>`。
   - 最小 projection：`id`, `username`, `displayName`；只回可加選 student，不暴露 admin account fields。
3. 搜尋契約需明確決定：
   - path、`q` 名稱、搜尋 username/displayName 規則、trim/case normalization。
   - 最短 query 與 empty/short query 行為。
   - pagination defaults/max、deterministic ordering/tie-breaker。
   - disabled/non-student 過濾，以及 active/removed/already-enrolled 是否出現。
   - 是否回 course-relative `enrollmentStatus: "active" | "removed" | null`。
   - owner/admin、non-owner 404、student 403、archived read/search 與 stable error semantics。
4. 凍結 mutations 是否會改變 search result membership/projection；這會決定 add/remove 後是否 invalidates student-search cache。
5. 將 disposition 寫入 `tasks/todo.md`。若 CP0 未完成，結果維持 `BLOCKED-CONTRACT`，不進入產品實作、不關閉 FE-2.1。

## CP1 — 建立可稽核 task checklist

更新 `tasks/todo.md`，加入：
- goal、可測 acceptance criteria 與明確 excluded scope。
- CP0–CP6 checklist，一次只標一個 in-progress checkpoint。
- Dependencies & Environment：BE-2 frozen contract、現有 `apiRequest`/React Query、Next.js 16.3.1；無新 dependency。
- Risk & Rollback：低至中風險；rollback 僅 revert 本 slice 的 types/keys/hooks/tests/task notes，無 DB/schema/runtime rollback。
- Working Notes：roster 含 removed rows；DELETE 是 200/null；add 201 不代表一定新建；不得 client-side 阻擋 archived removal。

`tasks/lessons.md` 僅在實作中發生真實錯誤或使用者修正時更新。

## CP2 — 凍結 wire types 與 query keys

### `lib/api/types.ts`

新增並嚴格對齊 backend DTO：
- `EnrollmentStatus = "active" | "removed"`
- `EnrollmentStudentDto`
- `EnrollmentDto`
- `CreateEnrollmentPayload`
- `StudentSearchResultDto`（只在 CP0 凍結後加入；embedded student 與 search projection 維持不同型別）

時間欄位維持 ISO string；不重用含 admin fields 的 `AccountDto`；不新增 client-computed eligibility/enrollment flags。

### `lib/api/query-keys.ts`

新增 collision-free hierarchy：
- `queryKeys.enrollments.all`
- `queryKeys.enrollments.course(courseId)`
- `queryKeys.enrollments.list(courseId, page, pageSize)`
- course-scoped `queryKeys.studentSearch.*`，key 必須包含所有會改變結果的 normalized query/page/pageSize（若 backend 最終採 global endpoint，依凍結契約移除 courseId）。

保留 course parent key，以便 mutation 只 invalidates 該 course 的所有 roster pages。

## CP3 — List 與 Search queries

延伸 `lib/api/enrollments.ts`，保留既有 `myCoursesQueryOptions` / `useMyCourses` 行為。

1. 新增 `CourseEnrollmentsParams`、`courseEnrollmentsQueryOptions()`、`useCourseEnrollments()`：
   - normalize pagination 為 1/20，使用 `URLSearchParams`。
   - `GET /courses/${courseId}/enrollments?...`，回 `Page<EnrollmentDto>`。
   - query key 含 course/page/pageSize；forward `AbortSignal`；`retry: false`；沿用 `staleTime: 30_000`。
   - empty courseId 不 fetch；可依既有 session pattern gate teacher/admin，但 backend auth 仍是 authority。
   - 不 filter removed rows、不重排、不改寫 pagination metadata。
2. 新增 `StudentSearchParams`、`studentSearchQueryOptions()`、`useStudentSearch()`：
   - 僅依 CP0 frozen endpoint/DTO 實作。
   - normalized term 同時用於 URL 與 query key，使用 `URLSearchParams` 正確 encode Unicode/reserved chars。
   - empty courseId 或低於 frozen minimum length 時 disabled。
   - forward signal、`retry: false`、明確 staleTime；保持 server ordering。
   - transport 不實作 debounce，也不把 roster cache join 進 search rows。

## CP4 — Add／Remove mutations 與 invalidation

在 `lib/api/enrollments.ts` 新增：

1. `useAddEnrollment()`：
   - variables：`courseId`, `studentAccountId`。
   - 重建 allowlisted body `{ studentAccountId }`；`POST` + `mutate: true`。
   - 回傳 server-authoritative `EnrollmentDto`；不 optimistic insert，不由 201 推測 create/duplicate/reactivation。
2. `useRemoveEnrollment()`：
   - exact `DELETE` path、`mutate: true`、無 body，回 `null`。
   - 不 optimistic delete；roster 仍應保留 status=`removed` row。
   - 不根據 cached Course status 阻擋 archived removal。
3. 以 module-private helper 統一 success invalidation：
   - 永遠 invalidate `queryKeys.enrollments.course(courseId)`，涵蓋該 course 所有 pages。
   - 只有在 search contract 含 membership-dependent field/filter 時，才 invalidate 該 course 的 `studentSearch` root。
   - 不 broad invalidate unrelated courses、course detail、admin accounts 或 `myCourses`。
   - failure 不更新或 invalidate authoritative cache；保留完整 `ApiRequestError` identity/code/status/field。

## CP5 — Regression coverage

### `test/enrollments-api.test.tsx`

沿用既有 hoisted mocks、isolated QueryClient、role/session mock 與高 default retry 的測試模式，新增：
- roster default/custom pagination、course/page key isolation、empty ID gate、AbortSignal、no retry、exact `ApiRequestError`。
- active + removed rows與 pagination/order 原樣保留。
- search normalization、URL encoding、key identity、minimum-length gate、signal/no retry/error/order。
- add exact path/method/body/mutate；以帶 extra runtime fields 的 payload 驗證 boundary allowlist。
- pending mutation 期間無 optimistic cache change；duplicate/reactivation response 原樣回傳。
- remove exact path/DELETE/no body/null success、repeat success、archived 不 client-block、無 optimistic row deletion。
- add/remove 成功只 invalidates target-course roster（以及契約要求時的 search）；失敗與 unrelated course 不受影響。

### `test/api-client.test.ts`

保持 `lib/api/client.ts` 不變，補 direct mutation boundary evidence：
- POST：JSON serialization、Content-Type、credentials、Origin、CSRF、201 envelope unwrap。
- DELETE：無 body、credentials、Origin、CSRF、200 `data:null` unwrap。

只有測試證明共用 client 不符契約時才修改 `client.ts`。

## CP6 — Verification、結果與 closeout

測試與 verbose gates 依專案規則委派 dedicated test subagent，採 smallest scope first：

1. `npm test -- test/enrollments-api.test.tsx test/api-client.test.ts`
2. `npx next typegen`
3. `npm run typecheck`
4. `npm run lint:check`
5. `npm test`
6. `npm run build`
7. `npx prettier --check lib/api/types.ts lib/api/query-keys.ts lib/api/enrollments.ts test/enrollments-api.test.tsx test/api-client.test.ts tasks/todo.md`
8. `git diff --check`
9. 檢查 `git status --short` 與 final diff，確認無 UI/routes/backend/env/lockfile/dependency/mock scope creep。

在 `tasks/todo.md` Results 記錄 exact commands、pass/fail counts、未執行項目及原因。FE-2.2 Playwright/real-browser acceptance 不納入本 slice。只有五個 FE-2.1 項目全部有契約與 evidence，且取得明確 closeout 授權後，才更新權威 WBS checkbox。

## Critical files

- `lib/api/types.ts` — enrollment/search wire contract。
- `lib/api/query-keys.ts` — course-scoped roster/search identities。
- `lib/api/enrollments.ts` — existing enrollment transport extension。
- `test/enrollments-api.test.tsx` — query/mutation/invalidation contract tests。
- `test/api-client.test.ts` — real shared-client mutation boundary tests。
- `tasks/todo.md` — dependency disposition、checkpoints、verification、results。
- Read-only contract references during implementation：backend enrollment controller/DTO/OpenAPI、`smartLearning-backend/docs/frontend-api-reference.md`、權威 WBS。
