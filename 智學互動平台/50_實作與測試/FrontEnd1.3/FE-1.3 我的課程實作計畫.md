# FE-1.3「我的課程」實作計畫

## Context

FE-1.1 已完成 `/me/courses` transport、分頁 query key、student-only query gate 與 envelope/error normalization；FE-1.2 已完成 `/student` routing、session/role/password gates 與 logout cache lifecycle。FE-1.3 的基本頁面與 `MyCoursesView` 已存在，但 WBS 的 Course list、loading、empty、error、responsive 與 real-backend browser smoke 尚未形成完整驗收閉環。

本計畫採使用者核准的 **`ACCEPT-PROVISIONAL`**：按目前 backend runtime、DTO、frontend API reference 與既有測試契約推進，但此決議不等於 BE-1／BE-2 release acceptance；若實作期間發現契約漂移則停止並重新 disposition。FE-1.3 WBS 只在完整 real-backend browser PASS、cleanup PASS 與人工接受後更新。

## Goal and acceptance criteria

完成 `/student` 的真實「我的課程」列表，且：

- 僅使用 `GET /api/v1/me/courses?page&pageSize`，不使用 mock、placeholder 或 fallback data。
- 顯示課程名稱、nullable description、Course lifecycle status、加選時間。
- loading、empty、error、data 四態互斥且具正確可及性語意。
- 使用 backend `Page.meta` 提供上一頁／下一頁，避免只顯示前 20 門課。
- 保留 server ordering；不在 client 重新排序或過濾 archived Course。
- archived Course 的 active enrollment 仍顯示；removed enrollment 消失。
- mobile 與 desktop 不產生水平溢出，長名稱／描述可完整換行。
- 不新增 Course detail、active session、join CTA、學生自行加選或 enrollment mutation。
- 真實 backend/browser 流程在隔離 fixture 下零 skip 通過，且 cleanup fail-closed。

## Contract and presentation dispositions

- `MyCourseDto.status` 為 `draft | archived`，不是 enrollment status。
- 狀態採窮舉中文 mapping：`draft → 草稿`、`archived → 已封存`；不使用會擴張語意的「進行中」。
- `enrolledAt` 以 `<time dateTime={ISO}>` 呈現，顯示固定 `Asia/Taipei`、`zh-TW` 格式，避免執行環境時區造成不一致；invalid date 安全顯示 `—`。
- 固定 `pageSize=20`，使用既有上一頁／下一頁模式；不加入 page-size selector、infinite scroll 或 URL query synchronization。
- 空狀態只適用於有效第一頁的 `data=[] / total=0 / totalPages=0`；錯誤或越界頁不得誤顯全域 empty。
- 無 Student Course detail API 或 active-session 欄位，因此 card 不可加入連結、join button 或 session badge。

## Checkpoint plan

### CP0 — Baseline and provisional contract record

1. 將核准後的本計畫保存為 `docs/智學互動平台/50_實作與測試/FrontEnd1.3/FE-1.3 我的課程實作計畫.md`，作為 FE-1.3 的權威執行與驗收文件。
2. 在 `smartLearning-ui/tasks/todo.md` 建立 FE-1.3 checklist，記錄：
   - `ACCEPT-PROVISIONAL` dependency disposition；
   - acceptance matrix；
   - Risk & Rollback；
   - Dependencies & Environment；
   - Working Notes；
   - browser fixture 與 cleanup policy。
3. 確認 working tree 無重疊修改，並保存既有 FE-1.1／FE-1.2 baseline。
4. 透過測試 subagent 執行：
   - `npm test -- test/my-courses-view.test.tsx test/enrollments-api.test.tsx test/student-layout.test.tsx`
   - `npm run typecheck`
   - `npm run test:browser -- --list`
5. 若 runtime/reference/DTO 與以下契約不一致則停止：active enrollments only、archived visible、removed absent、`enrolledAt DESC, id DESC`、one-based pagination、empty `totalPages=0`。

### CP1 — Minimal UI completion

主要修改 `features/student/MyCoursesView.tsx`：

1. 保留 Server page → Client view → `useMyCourses` 邊界，不修改 FE-1.1 API/client/query architecture。
2. 加入 local `page` state 與固定 `PAGE_SIZE=20`，呼叫 `useMyCourses({ page, pageSize })`。
3. 使用回傳 `meta` 呈現：
   - `第 n / totalPages 頁，共 total 門課程`；
   - `nav aria-label="我的課程分頁"`；
   - 第一頁停用上一頁、末頁停用下一頁；empty 不顯示 controls。
4. 加入 page contraction guard：當成功回應顯示目前 requested page 已超出有效頁數時，回到 `max(1, totalPages)` 並重新查詢，不誤顯全域 empty。
5. loading 改用既有 `CourseDetailView` pattern：`role="status"`、`aria-live="polite"` 與「載入我的課程中…」。
6. 保留 `ErrorAlert error={error} id="my-courses-error"`；不顯示 raw backend message，不另建 error layer。
7. 以窮舉 `Record<CourseStatus, string>` 顯示中文狀態。
8. 使用 module-level `Intl.DateTimeFormat` 與 semantic `<time>` 顯示加選時間。
9. Card responsive hardening：
   - mobile header 垂直、`sm` 起水平排列；
   - `min-w-0`、`break-words`、必要時 `[overflow-wrap:anywhere]`；
   - description 保留完整內容與換行；
   - status 不縮排；無固定寬度與 line clamp。
10. 只有 browser 證據顯示必要時，才最小調整 `app/(student)/student/page.tsx` 的 mobile padding；不改 Student auth layout。

### CP2 — Focused regression coverage

擴充 `test/my-courses-view.test.tsx`：

- pending promise 驗證 loading status、`aria-live`，且不顯示 list／empty／error。
- 修正 empty fixture 為 `total=0 / totalPages=0`，驗證無 pagination 與無自助加選 CTA。
- data state 驗證 accessible list、nullable description、中文 status、semantic `<time>`、無 raw status。
- archived Course 仍呈現「已封存」，且沒有 detail/join controls。
- error state 透過 `#my-courses-error` 驗證 curated message、raw backend detail 不外洩，且不誤顯 empty/list。
- 分頁 interaction：page 1 → next → page 2 → previous，驗證 URL、metadata 與 disabled boundaries。
- page contraction：後端回傳已越界 metadata 時改查有效頁，不先顯示全域 empty。
- 元件測試只驗證語意與完整文字；真實 overflow 交由 Playwright。

保留並回歸 `test/enrollments-api.test.tsx`；除非發現 FE-1.1 hook contract 缺陷，否則不修改 transport tests。

### CP3 — Full frontend verification

由測試 subagent 依序執行並回報結構化結果：

```bash
npx next typegen
npm test
npm run typecheck
npm run lint:check
npm run build
npm run test:browser -- --list
npx prettier --check <實際變更的 source/test files>
git diff --check
```

同時進行 scope audit，預期無修改：

- `lib/api/client.ts`
- `lib/api/types.ts`
- `lib/api/query-keys.ts`
- `lib/api/enrollments.ts`
- `app/(student)/layout.tsx`
- auth/logout files
- backend、schema、migration、dependencies、environment files

### CP4 — Dedicated real-backend browser acceptance

新增 `test/browser/fe-1-3-my-courses.spec.ts`，沿用現有 Playwright runner，不修改 runner/config，且不得 intercept `/me/courses`。

#### Fail-closed preflight

- 使用 feature-specific env，明確指定 UI origin、API base、隔離 admin credential 與 fixture prefix。
- URL 不得含 credentials；UI/API 使用相容且一致的 hostname（優先 `localhost`）。
- 確認 CORS、Secure `__Host-session`／`__Host-csrf`、backend live/ready 與 migrated isolated DB。
- 缺少條件時明確 FAIL/BLOCKED，不以 skip 或 mock 取代 PASS。
- 單 worker 執行，fixture 名稱包含 run UUID。

#### Real flow

1. 透過真實 API 在隔離 DB 建立 unique Student、Course 與 active Enrollment，保存並驗證 server-returned UUID/owner/name。
2. 完成 Student 必要改密碼流程後，透過真實 login form 導向 `/student`。
3. Mobile `390×844` 驗證真實課程 name、description、status、time、reload persistence，以及沒有 detail/join CTA。
4. 使用長名稱、長且含無斷點內容的 description，驗證 `document.documentElement.scrollWidth <= viewport width`。
5. 封存 Course 後 reload：課程仍存在且顯示「已封存」。
6. 移除 Enrollment 後 reload：課程消失；若為唯一課程則顯示 empty guidance，且無 stale card。
7. 建立最低 21 筆隔離 Course/Enrollment 驗證 server ordering、第一頁／第二頁與按鈕 boundaries；全程不 route-mock。
8. Desktop `1280×800` 再驗證無水平溢出、pagination 可見且可鍵盤操作。
9. Loading/error 的決定性 acceptance 由 focused tests 提供；不以人工延遲或破壞 backend 製造 browser 狀態。

#### Cleanup

- `finally` 中只使用本次建立且已驗證的 UUID 清理；不得以名稱模糊比對、truncate、刪除 shared rows 或清空 volume。
- active enrollment 先移除；本次 courses 逐筆確認 owner/name 後 archive。
- account 無刪除 API 時，只允許殘留於 disposable isolated DB，由環境 teardown 負責。
- aggregate cleanup failures 並使測試失敗；cleanup 未通過不可宣稱 FE-1.3.6 PASS。

執行：

```bash
npm run test:browser -- --workers=1 test/browser/fe-1-3-my-courses.spec.ts
```

### CP5 — Documentation and WBS closeout

1. 在 `tasks/todo.md` 補 Results：實際變更檔案、所有 command/result、browser fixture/cleanup outcome、warnings/blockers、no-mock 聲明與 rollback。
2. 逐項建立 FE-1.3.1～FE-1.3.6 evidence mapping。
3. 僅在 real-browser 零 skip PASS、cleanup PASS 且使用者接受後，更新權威 WBS checkbox；若 browser 為 BLOCKED／CONSTRAINED，保留未勾選並記錄原因。

## Critical files

### Expected modifications

- `smartLearning-ui/features/student/MyCoursesView.tsx` — loading、pagination、status/time presentation、responsive cards。
- `smartLearning-ui/test/my-courses-view.test.tsx` — 四態、status/time、archive、pagination、page contraction regressions。
- `smartLearning-ui/tasks/todo.md` — checkpoint、acceptance、risk、results traceability。

### Expected additions

- `docs/智學互動平台/50_實作與測試/FrontEnd1.3/FE-1.3 我的課程實作計畫.md` — 核准後保存的權威 FE-1.3 計畫文件。
- `smartLearning-ui/test/browser/fe-1-3-my-courses.spec.ts` — isolated real-backend browser acceptance。

### Conditional modification

- `smartLearning-ui/app/(student)/student/page.tsx` — 僅在 browser 證明 mobile padding 必須調整時。

### Closeout-only modification

- `docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md` — browser evidence 經接受後才勾選。

## Risks and rollback

- **Risk: provisional contract drift.** 每個 checkpoint 比對 runtime、DTO、reference；漂移即停線，不在 UI 猜測修補。
- **Risk: zero-page／page contraction edge cases.** Empty 與越界頁分流，使用 server metadata 回到有效頁。
- **Risk: archived/removed 語意混淆.** 不 client-filter；status 使用 literal lifecycle label。
- **Risk: timezone nondeterminism.** 固定 `Asia/Taipei` 並保留 ISO `dateTime`。
- **Risk: cookie host／Secure cookie mismatch.** preflight 使用一致 hostname 並以受保護 GET 驗證 session 成立。
- **Risk: browser fixture 污染資料.** disposable DB、exact UUID tracking、owner/name validation、fail-closed cleanup。
- **Risk: 21-row pagination smoke 較重.** API provisioning、單 worker、最小 21 筆；不以 mock 犧牲 acceptance。

Rollback 無 schema/backend 影響：可分別 revert `MyCoursesView`、component tests、browser spec、task/WBS docs；不得 reset 整個 working tree、回退 FE-1.1/FE-1.2，或刪除共享資料。
