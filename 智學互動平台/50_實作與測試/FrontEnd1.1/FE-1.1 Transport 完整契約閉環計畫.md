# FE-1.1 Transport 完整契約閉環計畫

## Context

權威 WBS 的 FE-1.1.1～FE-1.1.5 仍未勾選，但前端已有 `student` role、Student account creation、`GET /me/courses` hook、query key，以及共用 envelope/error client。這次不重做功能，而是依使用者選定的「完整契約閉環」基準：先確認 BE-1／BE-2 契約，再補齊分頁 transport、型別與 transport-boundary 測試，經人工 checkpoint 驗收後才更新 WBS。

範圍限定在 FE-1.1 Transport；不得混入 FE-1.2 routing/authorization、FE-1.3 UI 或 backend/schema 變更。

## Acceptance criteria

- `AccountRole` 與已凍結的 account/session response role 契約一致，並完整支援 `student`。
- Student account creation 送往 `POST /admin/accounts`，且 student payload 固定為 `canCreateCourse: false`。
- `/me/courses` transport 明確支援 `page`／`pageSize`，預設值與 backend 契約一致。
- 不同分頁參數使用不同 React Query cache key；保留可供 domain-wide invalidation 的 root key。
- Hook 僅在 student session 啟用、forward `AbortSignal`、`retry: false`、保留 inner pagination `data/meta`。
- 所有 API envelope 仍只由 `apiRequest()` unwrap；錯誤依 stable code 轉為 `ApiRequestError`，UI 不顯示 raw backend message。
- Focused tests、typecheck、lint、完整 unit suite、build 與 `git diff --check` 通過。
- 人工逐項核准 FE-1.1.1～FE-1.1.5 後，才更新權威 WBS。

## Checkpoint 0 — BE 契約與依賴人工確認（開始寫 code 前停止）

Checkpoint 0 是實作前的契約閘門。本階段只整理證據與待決議，不把目前的 code presence、focused test 或消費文件誤寫成 BE-1／BE-2 已完成 contract freeze。

### Evidence packet

| 證據來源 | 可確認內容 | 限制／需保留的缺口 |
|---|---|---|
| `docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md` §BE-2.1–BE-2.2、§FE-1.1 | FE-1.1 依賴 BE-1／BE-2 contract freeze；BE-2 要求 role、`/me/courses`、pagination、active/removed/archived 與 negative-path semantics 一致 | BE-1、BE-2 及 FE-1.1.1～FE-1.1.5 checkbox 尚未正式關閉；WBS completion DoD 尚未形成 release acceptance |
| `smartLearning-backend/docs/frontend-api-reference.md` §0、§3.1–3.2 | 統一 envelope、巢狀 `Page<T>`、student `/me/courses`、active-only、`enrolledAt DESC, id DESC`、已知 role/status 語意 | 是前端消費基準，不能反向覆寫 backend runtime；文件本身不等於人工 freeze 或 release sign-off |
| `smartLearning-backend/src/modules/enrollments/api/enrollments.controller.ts` | `GET /api/v1/me/courses`、`page`／`pageSize` query、`SessionGuard + StudentGuard`、`Page<MyCourseDto>` | source route 存在不等於 negative-path、OpenAPI、DB-backed acceptance 已完整通過 |
| `smartLearning-backend/src/modules/enrollments/application/enrollment.service.ts`、`src/common/pagination/pagination.ts` | `page=1`、`pageSize=20`、`MAX_PAGE_SIZE=100` 的 normalize，以及 active-only／穩定排序實作 | 是否將完整 validation boundary 與排序正式視為 FE wire contract，仍需人工 disposition |
| `smartLearning-backend/src/modules/identity/domain/roles.ts`、`src/modules/identity/api/dto/account.dto.ts`、`src/modules/enrollments/api/dto/enrollment.dto.ts` | domain role 是三值 union；公開 `AccountDto.role`、`SessionDto.role`、`MyCourseDto.status` 目前仍宣告 `string` | domain union 與 public DTO declaration 不完全一致；前端不可自行縮窄 response contract |
| `smartLearning-ui/lib/api/types.ts`、`accounts.ts`、`enrollments.ts`、`query-keys.ts`、`client.ts` 及既有測試 | request `AccountRole`、student account UI、`useMyCourses()`、root query key、envelope unwrap/error mapping 已存在 | `/me/courses` 尚未帶 pagination 參數；尚缺 pagination/client boundary/student exact-payload 的 focused evidence |

### 四項書面 disposition

| ID | 必須確認的契約 | 目前事實與衝突 | 可接受的書面決定 | 未決時的 gate 行為 | 狀態 |
|---|---|---|---|---|---|
| C0-1 | 是否接受目前 backend runtime、tests 與 `frontend-api-reference.md` 作為 FE-1.1 的暫定開工基準 | runtime/reference 已有 student、`/me/courses`、`Page<MyCourseDto>` 與 envelope；但 BE-1／BE-2 WBS 尚未完成 formal freeze/DoD | `ACCEPT-PROVISIONAL`：可依現有證據進入 FE-1.1 後續 checkpoint，但 BE/WBS release acceptance 仍 blocked；或 `BLOCKED-UNTIL-BE-FREEZE`：等待 BE formal freeze | 不得修改產品檔案 | `ACCEPT-PROVISIONAL` |
| C0-2 | `AccountDto.role`／`SessionDto.role` 是否封閉為 `"admin" \| "teacher" \| "student"` | backend domain 是三值 union、reference 只列三值，但 public response DTO 仍是 `string`；frontend request `AccountRole` 已是三值 union | `CLOSED-UNION`：後續可將 response DTO 對齊 `AccountRole`；或 `FORWARD-COMPATIBLE-STRING`：response 保留 `string`，不可由 frontend 自行縮窄 | 不得改 response type | `CLOSED-UNION` |
| C0-3 | `MyCourseDto.status` 是否正式等同既有 `CourseStatus` | controller 將 `row.course.status` 投影到 `status`，不是 enrollment status；enrollment 另有 `active \| removed`；public DTO 仍是 `string`，既有 UI fixture 有 `active` 混用疑慮 | `COURSE-LIFECYCLE-STATUS`：只允許 `"draft" \| "archived"`，後續修正錯誤 fixture；或 `KEEP-STRING`：暫不縮窄 response | 不得把 `active \| removed` 當 course status，也不得自行改 type/fixture | `COURSE-LIFECYCLE-STATUS` |
| C0-4 | `/me/courses` pagination、排序與 response shape 是否正式凍結 | runtime 預設 `page=1`、`pageSize=20`，最大 100；reference/runtime 指向 active-only、`enrolledAt DESC, id DESC`；回應是 envelope 內的 `Page<MyCourseDto>`（inner `data/meta`） | `CONFIRMED`：明確確認 defaults、是否送出 explicit query、`(page,pageSize)` cache identity、數值 boundary、active/archived 語意、inner `Page` shape 與排序；或 `BLOCKED`：保留未決 | 不得新增 pagination transport 或 pagination query key | `CONFIRMED` |

### 本次人工確認紀錄

```text
C0-1: ACCEPT-PROVISIONAL
C0-2: CLOSED-UNION
C0-3: COURSE-LIFECYCLE-STATUS
C0-4: CONFIRMED
Authority: 使用者書面確認
Date: 2026-09-02
```

**Checkpoint 0 結果：** `PROVISIONAL GO TO NEXT CHECKPOINT`。允許依目前 backend runtime、tests 與 reference 進入 Checkpoint 1；BE-1／BE-2 formal contract freeze、WBS release acceptance 與 FE-1.1 最終關閉仍未宣稱完成。下一步仍須先取得 Checkpoint 1 的「既有實作＋最小補強」範圍核准，才可開始 implementation diff。

### 人工回覆格式

請以以下格式逐項回覆，避免只有無法稽核的「可以開始」：

```text
C0-1: ACCEPT-PROVISIONAL / BLOCKED-UNTIL-BE-FREEZE
C0-2: CLOSED-UNION / FORWARD-COMPATIBLE-STRING
C0-3: COURSE-LIFECYCLE-STATUS / KEEP-STRING
C0-4: CONFIRMED / BLOCKED
Notes:
Authority/date:
```

若選擇 `ACCEPT-PROVISIONAL`，必須另外確認「允許 FE-1.1 依目前證據繼續」不等於「BE-1／BE-2 已完成 contract freeze」。分頁 validation 的 `MAX_PAGE_SIZE=100`、floor/clamp，`/me/courses` 對 admin／teacher／未登入的 frozen status/code，以及是否需要 real-backend smoke，若未被 C0-4 明確納入，均保留為後續人工確認事項，不在此自行猜定。

### Scope boundary 與出口判定

本階段允許更新本計畫的 CP0 evidence/disposition 紀錄；禁止修改 `smartLearning-ui/lib/**`、`smartLearning-ui/test/**`、backend、schema、env、dependency、WBS checkbox，亦不執行會寫入 DB 的 browser/E2E smoke。FE-1.2 routing/authorization 與 FE-1.3 UI 不在本 checkpoint。

**出口條件：** 四項都有明確書面 disposition，且每項均記錄 authority/date。任何一項未決即為 `BLOCKED — awaiting CP0 dispositions`，不得進入產品修改。四項皆明確但 BE-1／BE-2 仍未 formal close 時，最多標示 `PROVISIONAL GO TO NEXT CHECKPOINT`，不可更新父項 WBS 或宣稱 release acceptance 完成；只有後續 Checkpoint 1 也獲准後，才可開始 implementation diff。

## Checkpoint 1 — 既有實作 disposition 人工確認

CP0 已取得四項書面 disposition，因此本 checkpoint 進入「既有實作＋最小補強」範圍確認；這不是 implementation approval。完成下列書面核准前，CP1 狀態為 `BLOCKED — awaiting CP1 disposition`，不得修改 product files。

### 既有實作與最小補強矩陣

| WBS | 既有實作證據 | 最小補強 | 建議 disposition | 狀態 |
|---|---|---|---|---|
| FE-1.1.1 | `lib/api/types.ts` 已有 `AccountRole = "admin" \| "teacher" \| "student"`；student role 也已在 account form/schema 出現 | 依 C0-2 將 `AccountDto.role`、`SessionDto.role` 對齊 `AccountRole`；依 C0-3 將 `MyCourseDto.status` 對齊 `CourseStatus`；不新增 union、cast 或 `any`。不可改動 account `status` 的既有 `active` 語意 | `ALLOW-MINIMAL-TYPE-NARROWING` | `ALLOW-MINIMAL-TYPE-NARROWING` |
| FE-1.1.2 | account form 已提供 student、student 時強制 `canCreateCourse=false`；`useCreateAccount()` 已送 `POST /admin/accounts`、共用 `apiRequest()`、`mutate: true` | 只修正 `lib/api/accounts.ts` 的 stale comment；在既有 account form suite 增加 exact student submit payload assertion，確認沒有額外 teacher/admin-only 欄位 | `ALLOW-MINIMAL-TEST-DOC-FIX` | `ALLOW-MINIMAL-TEST-DOC-FIX` |
| FE-1.1.3 | `useMyCourses()` 已使用 `/me/courses`，具 student-only gate、signal forwarding、`retry:false`、`staleTime:30_000` 與 inner `Page` projection | 增加 optional `page/pageSize`，預設 `1/20`，以 `URLSearchParams` 明確送出 query；保留既有 projection、student gate 與 no-retry | `ALLOW-MINIMAL-PAGINATION` | `ALLOW-MINIMAL-PAGINATION` |
| FE-1.1.4 | `queryKeys.myCourses.all`、query options 與 hook 已存在；目前唯一 product caller 是 `features/student/MyCoursesView.tsx` | 保留 root key 作 broad invalidation；新增 `list(page,pageSize)`；options factory 與 `useMyCourses(params?)` 共用 normalized defaults，避免分頁 cache collision。不新增 prefetch/infinite query/pagination UI | `ALLOW-MINIMAL-KEY-FACTORY` | `ALLOW-MINIMAL-KEY-FACTORY` |
| FE-1.1.5 | `lib/api/client.ts` 已集中 envelope unwrap、`ApiRequestError`、network/non-JSON/error mapping、credentials、mutation CSRF/Origin；既有 UI tests 已驗證 raw message 不展示 | 新增 `test/api-client.test.ts` direct boundary regression tests；除非測試證明 frozen contract mismatch，否則不改 `client.ts` | `ALLOW-BOUNDARY-TESTS-ONLY` | `ALLOW-BOUNDARY-TESTS-ONLY` |

### 核准後的精確範圍

**允許修改的 production files：**

- `smartLearning-ui/lib/api/types.ts`
- `smartLearning-ui/lib/api/accounts.ts`
- `smartLearning-ui/lib/api/query-keys.ts`
- `smartLearning-ui/lib/api/enrollments.ts`

**允許修改的 test files：**

- `smartLearning-ui/test/account-create-form.test.tsx`
- `smartLearning-ui/test/my-courses-view.test.tsx`（只調整 C0-3 status fixture 與 explicit default query expectation）
- `smartLearning-ui/test/enrollments-api.test.tsx`（新增）
- `smartLearning-ui/test/api-client.test.ts`（新增）

`MyCoursesView.tsx` 與 `AccountCreateForm.tsx` 不改；現有 `useMyCourses()` caller 透過 optional params/defaults 保持相容。`lib/api/client.ts` 不是預先核准的 production modification target，只接受 direct regression coverage。

### Implementation 後必須提供的 focused evidence

- Student account exact payload：`role: "student"`、`canCreateCourse: false`，沒有額外 teacher/admin-only 欄位。
- `/me/courses?page=1&pageSize=20` default request，以及 custom page/pageSize request。
- 不同 `(page,pageSize)` 具有不同 cache key；`queryKeys.myCourses.all` 仍可 broad invalidate。
- student session 會 fetch；admin、teacher、無 session 不會呼叫 endpoint。
- `AbortSignal` forwarding、`retry:false`、inner `Page.data/meta` → `courses/meta` projection、`ApiRequestError` code/status/field/retry metadata/identity 保留。
- `apiRequest()` success unwrap、error/network/non-JSON mapping、GET credentials 與 GET 不附 mutation-only Origin/CSRF。
- 既有 curated error-message/ErrorAlert 行為仍不顯示 raw backend message。

### Non-goals 與 stop rules

- 不修改 routes、layouts、redirect、authorization flow、`MyCoursesView.tsx` pagination UI 或其他 FE-1.2/FE-1.3 行為。
- 不修改 backend、schema、migration、OpenAPI、environment、dependency、lockfile、config 或 WBS checkbox。
- 不新增 mock/fallback data，不執行 browser/E2E 或 database-writing smoke。
- 不改動 account `status: "active"` fixtures；只處理被 C0-3 證明錯誤的 `MyCourseDto.status` fixture。
- 不新增 abort error classification；CP1 只確認 signal forwarding。
- 若 client boundary test 暴露 production client 與凍結契約不一致，立即停止並回報 blast radius，不自行擴大 production scope。

### 人工確認格式

```text
Checkpoint 1 disposition

CP1-FE-1.1.1: ALLOW-MINIMAL-TYPE-NARROWING / BLOCKED
CP1-FE-1.1.2: ALLOW-MINIMAL-TEST-DOC-FIX / BLOCKED
CP1-FE-1.1.3: ALLOW-MINIMAL-PAGINATION / BLOCKED
CP1-FE-1.1.4: ALLOW-MINIMAL-KEY-FACTORY / BLOCKED
CP1-FE-1.1.5: ALLOW-BOUNDARY-TESTS-ONLY / BLOCKED

Scope: existing implementation plus minimum transport/test reinforcement only
Production files approved:
Tests approved:
Non-goals acknowledged:
Authority/date:
```

### 本次人工確認紀錄

```text
CP1-FE-1.1.1: ALLOW-MINIMAL-TYPE-NARROWING
CP1-FE-1.1.2: ALLOW-MINIMAL-TEST-DOC-FIX
CP1-FE-1.1.3: ALLOW-MINIMAL-PAGINATION
CP1-FE-1.1.4: ALLOW-MINIMAL-KEY-FACTORY
CP1-FE-1.1.5: ALLOW-BOUNDARY-TESTS-ONLY

Scope: existing implementation plus minimum transport/test reinforcement only
Production files approved:
- smartLearning-ui/lib/api/types.ts
- smartLearning-ui/lib/api/accounts.ts
- smartLearning-ui/lib/api/query-keys.ts
- smartLearning-ui/lib/api/enrollments.ts
Tests approved:
- smartLearning-ui/test/account-create-form.test.tsx
- smartLearning-ui/test/my-courses-view.test.tsx
- smartLearning-ui/test/enrollments-api.test.tsx
- smartLearning-ui/test/api-client.test.ts
Non-goals acknowledged: routes/layouts/redirect/authorization/UI pagination、backend/schema/OpenAPI/environment/dependency/config、WBS checkbox、mock/fallback data、browser/E2E、database-writing smoke，以及未經額外核准的 client production rewrite
Authority/date: 使用者書面確認 / 2026-09-02
```

**Checkpoint 1 結果：** `GO TO IMPLEMENTATION`。可依上述精確範圍開始最小 implementation；完成後必須停在 Checkpoint 2 先檢查 production diff scope。即使 CP1 通過，也不得宣稱 BE-1／BE-2 formal freeze 或提前勾選 WBS。

**出口條件：** 五項 disposition、scope、allowed files 與 non-goals 都有明確書面核准。五項全數核准後，才可進入 implementation；實作完成仍須停在 Checkpoint 2 先檢查 production diff scope。即使 CP1 通過，也不得宣稱 BE-1／BE-2 formal freeze 或提前勾選 WBS。

## Implementation

### 1. 建立可稽核任務紀錄

更新 `smartLearning-ui/tasks/todo.md`：

- 記錄本計畫 acceptance criteria、依賴/環境、低至中風險、rollback、工作筆記與 Results 區塊。
- 一次僅標示一個 in-progress 項目。
- 不預先勾選 WBS。

### 2. 對齊 transport types

修改 `smartLearning-ui/lib/api/types.ts`：

- 保留 `AccountRole = "admin" | "teacher" | "student"`。
- 若 Checkpoint 0 確認 closed union，將 `AccountDto.role`、`SessionDto.role` 改為 `AccountRole`；否則保留 `string` 並在任務紀錄註明原因。
- 若 status 契約確認為 course lifecycle，將 `MyCourseDto.status` 改為既有 `CourseStatus`，並修正不符合契約的測試 fixture；若未確認則停止該項，不猜測 union。
- 不增加 cast 或 `any` 迴避契約問題。

### 3. 收斂 Student account creation transport 證據

修改：

- `smartLearning-ui/lib/api/accounts.ts`
- `smartLearning-ui/test/account-create-form.test.tsx`

工作：

- 修正「UI 排除 student」的 stale comment。
- 保留共用 `apiRequest`、`POST /admin/accounts`、`mutate: true`。
- 增加/強化 student 實際 submit 測試，斷言 request body 的 `role: "student"`、`canCreateCourse: false` 及既定欄位，沒有額外 teacher/admin-only 欄位。

### 4. 完成 pagination-aware `/me/courses` transport

修改：

- `smartLearning-ui/lib/api/query-keys.ts`
- `smartLearning-ui/lib/api/enrollments.ts`

沿用 accounts list 的既有 pattern：

- 增加 `MyCoursesParams`（`page?`、`pageSize?`），預設 `1`／`20`。
- 保留 `queryKeys.myCourses.all` 作為 root key；增加 `list(page, pageSize)`。
- 將 `myCoursesQueryOptions` 改為參數化 factory，使用 `URLSearchParams` 產生 `/me/courses?page=…&pageSize=…`。
- `useMyCourses(params?)` 使用同一 options factory。
- 保留 student-only `enabled`、`retry: false`、`staleTime: 30_000`、signal forwarding，以及目前 `courses/meta/error/refetch` projection。
- 修改前再次搜尋所有 `myCoursesQueryOptions`、`useMyCourses`、`queryKeys.myCourses` consumers；若發現未預期 caller，回到本 checkpoint 更新範圍。

### 5. 新增 enrollment transport focused tests

新增 `smartLearning-ui/test/enrollments-api.test.tsx`，直接測 hook/options，不 mock 被測 hook：

- student default request 使用 page 1/pageSize 20。
- custom page/pageSize 產生正確 path 與不同 query key。
- request forward `AbortSignal`。
- student success 將 inner `Page<MyCourseDto>.data/meta` 投影為 `courses/meta`。
- admin、teacher、無 session 都不呼叫 endpoint。
- `retry: false`：失敗只呼叫一次。
- `ApiRequestError` 的 code/status/identity 被保留。
- 測試 lifecycle APIs 從 Vitest 顯式 import，避免 runtime pass 但 typecheck failure。

### 6. 新增共用 API client boundary tests

新增 `smartLearning-ui/test/api-client.test.ts`，直接測既有 `apiRequest()`：

- success envelope 只回傳 `data`。
- non-2xx error envelope 轉成 `ApiRequestError`，保留 code/status/field/retryAfterSeconds。
- 2xx 但 envelope 含 `error` 仍拒絕。
- malformed/non-JSON response 轉為 `INTERNAL_ERROR` 並保留 HTTP status。
- fetch/network failure 轉為 `NETWORK_ERROR`、status 0。
- GET 使用 `credentials: "include"`，且不附 mutation-only Origin/CSRF headers。
- 與既有 `error-messages`／`ErrorAlert` 測試共同證明 unknown code 使用 curated fallback，不呈現 raw backend message。

不改寫 `lib/api/client.ts`，除非新 regression test 證明現有行為不符合已凍結契約；若需改 production client，先停止並回報原因與 blast radius。

## Checkpoint 2 — 實作 diff 人工確認

在執行測試前呈交 production diff，人工確認：

- 只涉及 `lib/api/types.ts`、`lib/api/accounts.ts`、`lib/api/query-keys.ts`、`lib/api/enrollments.ts`。
- 測試只涉及 transport/client/account payload 與必要 fixture 調整。
- 沒有 route、layout、login redirect、Student UI、backend、env、dependency 或 config 變更。
- role/status/pagination 完全符合 Checkpoint 0 disposition。

未通過則停止並縮小 diff。

## Verification

測試與 build 依專案規則交由 dedicated test subagent 執行，回傳精簡結構化證據；最小範圍先行。

1. Focused tests：

```bash
npm test -- test/account-create-form.test.tsx test/enrollments-api.test.tsx test/api-client.test.ts test/my-courses-view.test.tsx
```

2. Route types + static gates：

```bash
npx next typegen
npm run typecheck
npm run lint:check
npx prettier --check lib/api/types.ts lib/api/accounts.ts lib/api/query-keys.ts lib/api/enrollments.ts test/account-create-form.test.tsx test/enrollments-api.test.tsx test/api-client.test.ts test/my-courses-view.test.tsx
```

3. Regression/build：

```bash
npm test
npm run build
git diff --check
```

若 focused/static 任一失敗，依 stop-the-line 規則先診斷與更新計畫，不繼續跑 broader gates。

## Checkpoint 3 — Focused evidence 人工確認

focused tests 通過後停止，呈交：

- exact command、pass/fail/skip 數量。
- FE-1.1.1～1.1.5 對應的 assertion 證據。
- request path/query、query key、student gate、signal/no-retry、envelope/error mapping 證據。
- 任何未執行項目及原因。

人工確認這些是 transport-boundary 證據，而非僅 UI rendering evidence，才進入完整驗證。

## Checkpoint 4 — Static/regression/scope 人工確認

完整 gates 通過後停止，人工檢查：

- page/pageSize cache identity 不碰撞。
- GET 有 cookie credentials，但不走 mutation CSRF path。
- raw backend message 不進入 UI fallback。
- 沒有 FE-1.2/FE-1.3 或其他 story scope contamination。
- `git diff --check` 與工作樹狀態符合預期。
- 若有 baseline failure，明確區分並決定是否阻塞 FE-1.1。

## Checkpoint 5 — 可選 real-backend transport smoke（執行前停止）

FE-1.1 不自動執行會寫入 DB 的 browser/E2E 流程；FE-1.3 才明列 real-backend browser smoke。只有在人工確認以下事項後才執行：

- 使用隔離的 local/test backend 與 `smartlearning_test`，不碰 shared/production data。
- 已授權建立 student/enrollment fixture 及 cleanup 方法。
- 明確指定此證據是 FE-1.1 必要驗收或額外信心。

若核准，驗證 student 的 `/api/v1/me/courses?page=1&pageSize=20` 成功，以及 admin/teacher/unauthenticated 的 frozen error status/code；僅驗 transport，不延伸驗收 cards/routing。

若不核准，記錄「未執行；屬 FE-1.3 或 backend acceptance 範圍」，不宣稱已跑。

## Checkpoint 6 — 最終 WBS 人工核准

建立 traceability table，逐項列出：

- production file evidence
- test evidence
- BE dependency disposition
- real-backend evidence（若有）或未執行原因
- 無法關閉的 deferred/blocker

人工逐項核准 FE-1.1.1～FE-1.1.5 後，才修改：

- `/home/user/projects/smartLearning/docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md`
- `smartLearning-ui/tasks/todo.md` 的 Results

若 BE-1/BE-2 仍未正式凍結，保留 checkbox 未勾選，改記「implementation verified, release acceptance blocked」；不得只因 unit tests 綠燈就關閉父項。

## Risk & rollback

- **風險：中低。** 無 DB/schema 變更；主要風險是前端型別比 backend 契約更窄，以及 pagination key 改變 cache identity。
- **Rollback：**
  - role/status 契約不成立時，各欄位恢復 `string`，保留 student creation 支援與 tests。
  - pagination 需撤回時，恢復 no-argument hook/root key，並明確將完整 pagination acceptance 標為 deferred，不誤勾 FE-1.1.4。
  - 不刪除仍有效的 transport regression tests；調整到獲准契約。
- 不新增 dependency、不修改 backend、不需要資料回滾。

## Critical files

- `/home/user/projects/smartLearning/docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md`
- `smartLearning-ui/tasks/todo.md`
- `smartLearning-ui/lib/api/types.ts`
- `smartLearning-ui/lib/api/accounts.ts`
- `smartLearning-ui/lib/api/query-keys.ts`
- `smartLearning-ui/lib/api/enrollments.ts`
- `smartLearning-ui/lib/api/client.ts`（沿用；主要新增 direct tests）
- `smartLearning-ui/test/account-create-form.test.tsx`
- `smartLearning-ui/test/enrollments-api.test.tsx`
- `smartLearning-ui/test/api-client.test.ts`
- `smartLearning-ui/test/my-courses-view.test.tsx`（僅必要 fixture/regression）
