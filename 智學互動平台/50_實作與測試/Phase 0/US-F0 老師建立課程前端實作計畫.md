# US-F0 老師建立課程：前端實作計畫

## Context

本計畫回應 US-F0「老師建立課程」的實作規劃需求。唯一規格來源是：

`/home/user/projects/smartLearning/docs/智學互動平台/50_實作與測試/SPEC F0-F17 前端實作計畫.md`

本計畫未引用該文件以外的程式碼、文件、API 實作或外部資料；未定義的項目不得以推測補足。目標是讓具備 `canCreateCourse` 權限的老師，以 `name`、`description` 建立 Course，成功後進入 Course detail，看到 `draft` 與 `owner`，且建立者是唯一老師並能繼續進入題目流程。

**風險等級：高。** 本 Story 涉及 server 授權、CSRF／Origin 與資料不產生保證。F0 目前只能完成規劃，不能在 gate 與契約未解鎖前直接實作或宣稱完成。

## 規格邊界與硬性範圍

- F0 的直接規範位於指定文件 `US-F0 老師建立課程`（第 41–43 行）；補充規範來自文件的 Context、Recommended architecture、Execution order、US-F16、US-F1、US-F9、Risk/rollback/deferred scope、Verification 與 Critical files 章節。
- 執行順序遵守文件：`F5 → F6 → F7 → F8 → F16 → F0 → F1 → F9`。
- 請求只送出實際 contract 定義的 `name`、`description`；不得加入 `owner`、`status`、共同授課者、所有權或其他建立欄位。
- 不做共同授課、所有權移轉、文件尚不存在的 Course 編輯功能。
- 不使用 mock endpoint、MSW、runtime fixture server、假資料 fallback、placeholder、client-only 授權、BFF/proxy 或 JWT。
- Course、session 等 server state 使用 React Query，不放進 Zustand。
- 若文件、OpenAPI、實際 DTO 或 endpoint 不一致，立即停止 F0，先同步契約；不得以 workaround 繼續驗收。

## 目前阻擋點（解鎖前不可實作）

1. **F16 gate 為阻擋狀態。** 必須先完成 F16 backend 權限更新契約，並能證明：啟用 `canCreateCourse` 可建立；移除後新建穩定回傳 `403`；既有 Course、題目、歷史結果不變；既有 CLI credential 不因移除開課權限而撤銷。
2. **Session 契約未完整定義。** `/auth/session` 的 HTTP method、完整 DTO 與 `canCreateCourse` 傳輸型別未定義。
3. **Course 建立契約未完整定義。** `POST /courses` 的完整 request/response、成功 status、Course ID／owner／status 欄位名稱、detail route、idempotency／重複送出行為未定義。
4. **下游入口未定義。** Course detail 與題目流程的實際 route、navigation 方法，以及 F1/F9 是否必須在 F0 驗收前完成未定義。
5. **表單與錯誤細節未定義。** `name`／`description` 的型別、必填性、長度、空白規則、錯誤 code/message/UI 文案、loading、retry、duplicate 行為均不可自行推測。

## 高層 gate 與模組化 checkpoints

原規劃 A–D 改為產品治理層的高層 gate，並映射到 CP0–CP5：A→CP0/CP1、B→CP2、C→CP3、D→CP4/CP5。實際執行以 CP0–CP5 作為可獨立完成、驗證、交接與回滾的工作單元。每個工作單元只允許修改列出的 scope，完成條件未滿足時只能標記 `blocked`，不得把未驗證內容帶入下一個 Session。

### CP0：真實環境與 F16 gate（不改產品程式）

**Scope：** 只做 preflight、契約比對與證據整理；不得修改 backend/UI 功能檔。

1. 依序取得 F5、F6、F7、F8、F16 的完成證據；F16 未完成前，F0 維持 `blocked`。
2. 在真實服務環境確認 backend `localhost:3000`、UI `localhost:3001`，並使用明確的 `CORS_ORIGIN=http://localhost:3001`。
3. 檢查 `health/live`、`health/ready`、`/api/docs`、`/api/docs-json`、migration、`/auth/session`、`POST /courses` 與相關 E2E。
4. 對齊 session／Course DTO、success status、owner/status/ID 欄位、detail route、錯誤 envelope、CSRF／Origin 行為。
5. 證明啟用 `canCreateCourse` 可建立、移除後新建穩定回傳 `403` 且不產生資料；既有 Course、題目、歷史結果與 CLI credential 不變。

**Exit criteria：** 所有契約與 F16 真實驗收證據均為 `PASS`；任何服務、fixture、CORS 或契約缺口均為 `BLOCKED`。

**Handoff：** `tasks/handoffs/US-F0-CP0-preflight.md`（或等價的受版本控制紀錄）及 `tasks/todo.md`，包含命令、最小輸出、阻擋原因與下一步。CP0 blocked 時停止，不建立後續產品變更。

### CP1：Backend contract slice（條件式）

**Scope：** 僅在 CP0 證明 backend 有實際缺口時修改 backend controller/DTO/service/e2e；若契約已存在，標記 `not-applicable`，不得為形式建立空 commit。

1. 以單一 backend repository 的最小檔案集合完成 Course request/response、授權重查與「403 不落資料」測試。
2. 先跑 targeted unit/integration/e2e、format、typecheck、lint，再整理 OpenAPI 證據。
3. backend 若已有未提交的 Phase B/F16 工作，先記錄基線，禁止 `git add -A` 或混入無關變更。
4. 只有在使用者明確授權 commit 時，才以精確檔案建立單一可回滾 commit；commit message、檔案清單與驗證命令寫入 handoff。

**Exit criteria：** backend contract、OpenAPI、targeted tests 與資料不變性證據一致；否則 `blocked`。

**Handoff：** backend commit hash（若有）、`git diff --name-only`、測試報告與下一個 CP2 的輸入契約。

### CP2：Frontend transport slice

**Scope：** 只處理 UI API boundary，不建立可操作頁面。

1. 在既有 API 分層中加入 Course create/detail 的 request/response type、query key 與 React Query hook：
   - `smartLearning-ui/lib/api/types.ts`
   - `smartLearning-ui/lib/api/query-keys.ts`
   - `smartLearning-ui/lib/api/courses.ts`
2. 沿用 repository 實際使用的 API base 設定、`credentials: "include"` 與 `{data, meta, error}` envelope；不得引入第二個環境變數、臨時 response、BFF、JWT 或 mock transport。
3. mutation request 僅含 `name`、`description`；不得送 owner/status/teacher/ownership 欄位；不得 optimistic-create。
4. detail query 使用已確認的 Course ID route，`retry` 與錯誤型別遵守既有 API hook pattern。

**Exit criteria：** transport tests 能證明 HTTP path/method/body/query key 與 DTO 對齊，typecheck 通過；不包含表單、route CTA 或 E2E。

**Handoff：** 變更檔案、targeted test 命令/結果、公開型別與 hook 使用方式、未解決 route/fixture blocker。

### CP3：Course create UX slice

**Scope：** 建立表單與 create route，不實作 Course detail 或 F1/F9。

1. `CourseCreateForm` 只呈現 `name`、`description`，沿用既有 Field、ErrorAlert、React Hook Form、Zod 與 React Query pattern。
2. `/courses/new` route 使用 Server Component shell、唯一 metadata/h1、`loading.tsx`、`error.tsx`、`not-found.tsx`；互動只放在 client form。
3. `canCreateCourse` 只控制 UX 可見性；direct route 與 stale session 仍由 backend server guard 決定，403 必須保留為可觀察錯誤。
4. 每欄提供 label、`aria-describedby`、keyboard path、pending/duplicate/error 行為；不得記錄 credentials、cookies、CSRF 或 raw server error。
5. teacher home 只在授權旗標為 true 時顯示建立 CTA；false 時顯示明確但非色彩唯一的不可開課狀態。

**Exit criteria：** form/component/route tests 通過，request keys 精確，403 不出現成功狀態；不依賴真實 E2E 才能判定基本 UI 行為。

**Handoff：** UI scope diff、targeted test report、已確認的 mutation 入口與 CP4 detail route contract。

### CP4：Course detail slice

**Scope：** 只建立 server-backed Course detail 與成功導向，不實作 F1 編輯/封存或 F9 題目功能。

1. 建立已確認的 detail route 與 `GET /courses/:id` query；Next.js 16 dynamic `params` 必須以 Promise 處理。
2. detail 顯示 `draft`、owner 與建立者為唯一老師；不得提供共同授課、所有權移轉或未定義編輯控制。
3. loading/error/not-found 使用 route boundary；non-owner/404 不洩漏其他 Course 資訊。
4. F9 題目流程入口只有在 route 與整合時點獲權威確認後才能使用；未確認時標記 `blocked`，不得建立 dead link、假頁面或 placeholder。

**Exit criteria：** create success 能以 server 回應的 Course ID 導向真實 detail，detail query/render tests 通過；下游未確認項保持 `blocked`。

**Handoff：** detail route/DTO evidence、render/route test report、F9 entry decision 與仍存在的 blocker。

### CP5：Real acceptance 與 release gates

**Scope：** 只做真實 backend Playwright、資料清理、靜態 gate 與 acceptance matrix，不再擴張功能 scope。

1. 使用隔離 fixture 執行授權建立、撤銷權限後 403/無新資料、detail draft/owner/唯一老師、CSRF/Origin 與 keyboard/a11y flow。
2. 清理本 checkpoint 建立的資料；不得刪除或修改既有 Course、題目、結果或 credential。
3. 依序執行 `npx next typegen`、targeted Vitest、`npm run typecheck`、`npm run lint:check`、`npm run build`、`git diff --check`，再執行完整 regression。
4. acceptance matrix 只使用 `completed`、`blocked`、`not-applicable`；任何 fixture、環境或契約問題都保留 `blocked`。

**Exit criteria：** 真實 E2E 與所有必要靜態 gate 通過，且 acceptance matrix 有可追溯 evidence；否則停止發布。

**Handoff：** Playwright report、命令與最小證據、資料清理結果、acceptance matrix、rollback 指示。

### Session / handoff protocol

每個 CP 可在獨立 Session 執行。Session 結束前必須：

1. `git status --short`、`git diff --name-only`、`git diff --check`，確認沒有未說明的變更。
2. 將「狀態、變更檔、命令/結果、未解 blocker、下一步、不需重做的調查」寫入 handoff。
3. 原始長 log 不放入 handoff；只保留可定位的錯誤行、HTTP status、測試數量與 evidence path。
4. 下一個 Session 只讀取本 CP handoff、計畫文件與明確列出的 source-of-truth，不重新掃描整個歷史 transcript。
5. 任何 `BLOCKED` 都必須由下一個 Session 先處理 blocker；不可直接跳到下一個產品 CP。

Git commit 是交付邊界，不是自動完成條件。未獲明確授權不得 commit；獲授權時每個 repository 只提交本 CP 的精確檔案，並把 commit hash 與驗證結果寫入 handoff。

## 關鍵驗收矩陣

每一列必須指向一個 checkpoint 與可保存的 evidence；只有該 checkpoint 的 exit criteria 通過後，狀態才可由 `blocked` 變更為 `completed`。`blocked` 不代表未執行，必須在 handoff 記錄具體 blocker。

| 項目 | 完成條件 | Checkpoint | 必要 evidence | 目前狀態 |
|---|---|---|---|---|
| F16 權限 gate | 啟用可建、移除後新建穩定 `403`、既有資料不變、CLI credential 不撤銷 | CP0 | F16 real e2e + DB/data invariance report | blocked |
| `canCreateCourse` | 只控制 UX 可見性，server 才是授權權威 | CP0/CP3 | session contract + stale-permission 403 test | blocked |
| request 欄位 | 實際 request 只有 `name`、`description` | CP2/CP3 | transport test + captured request shape | blocked |
| 成功流程 | 導向 detail，顯示 `draft`、`owner`，建立者為唯一老師 | CP4/CP5 | detail render test + real browser URL/response | blocked |
| 題目流程 | 由已確認入口進入後續題目流程 | CP4/CP5 | F9 route decision + real navigation evidence | blocked |
| forbidden 行為 | 無權限時穩定 `403`／forbidden，且不產生資料 | CP0/CP3/CP5 | backend e2e + no-new-row/count evidence | blocked |
| envelope | 正確解讀 `{data, meta, error}` | CP1/CP2 | OpenAPI/API client contract test | blocked |
| CSRF／Origin | 真實 backend 驗證 `credentials`、`__Host-csrf`、`X-CSRF-Token` 與 Origin，不繞過 | CP0/CP3/CP5 | preflight + browser mutation/negative request evidence | blocked |
| 可及性 | label、`aria-describedby`、鍵盤操作、非色彩狀態傳達通過 | CP3/CP4/CP5 | Testing Library + desktop/mobile smoke notes | blocked |
| responsive/a11y smoke | 桌面／手機、contrast、reduced-motion 通過 | CP5 | browser/a11y checklist | blocked |
| 單元測試 | Vitest + Testing Library 覆蓋表單與關鍵互動 | CP2/CP3/CP4 | targeted test reports | blocked |
| 真實 E2E | Playwright 連真實 backend；不使用 MSW、runtime fixture、mock API | CP5 | Playwright report + fixture/cleanup record | blocked |
| 靜態 gate | typegen、typecheck、lint、build、diff check 全通過 | CP5 | command/result record | blocked |
| 共同授課／所有權移轉／Course 編輯 | F0 明確不做 | — | scope review | not-applicable |
| owner/status 等額外建立欄位 | F0 明確不做 | CP2/CP3 | request-shape assertion | not-applicable |

## 安全、資料與範圍不變性

- 前端 UX 隱藏或顯示不得改變 server 授權結果。
- 未授權請求不能留下 Course 資料。
- F16 移除 `canCreateCourse` 不得改寫既有 Course、題目、歷史結果，也不得撤銷 CLI credential。
- F0 不送 owner/status/共同授課者/所有權等由 server 決定或範圍外欄位。
- 不在 log 中暴露 cookies、CSRF token、credentials 或其他認證秘密。

## 驗證命令與環境

完成契約與功能後，依文件執行：

```text
npx next typegen
npm run typecheck
npm run lint:check
npm run build
git diff --check
```

驗證必須按 CP 順序執行，不把後續 E2E 當成前面 transport/UI slice 的唯一證據：

1. **CP0**：backend `localhost:3000`、UI `localhost:3001`、明確 `CORS_ORIGIN=http://localhost:3001`；依序確認 `health/live`、`health/ready`、`/api/docs`、`/api/docs-json`、migration、session、Course endpoint、F16 permission/no-row 與 CSRF/Origin。
2. **CP1**（若適用）：在 backend repository 跑 targeted unit/integration/e2e、format、typecheck、lint，並保存 OpenAPI/資料不變性證據。
3. **CP2–CP4**：每個 slice 只跑其 scope 的 targeted Vitest/Testing Library 與 typecheck；測試輸出由專用 test subagent 執行時，只將結構化摘要寫入 handoff，不貼原始長 log。
4. **CP5**：先執行 `npx next typegen`、targeted Vitest、`npm run typecheck`、`npm run lint:check`、`npm run build`、`git diff --check`，再執行真實 Playwright 與完整 regression。

F0 最終測試至少覆蓋：權限啟用可建、唯一老師、權限移除不產生資料、穩定 forbidden/403、CSRF/Origin、兩欄位限制、鍵盤操作、detail 的 `draft`/`owner` 與題目流程入口。缺少 fixture、UI service 或實際資料證據時，保留 `blocked`，不可用 component test 或 mock 取代真實 E2E。

## 阻擋與停止規則

遇到以下任一情形，停止 F0，不加入 workaround：

- F16 尚未完成或權限移除行為不符合規範。
- `/auth/session` 或 `POST /courses` 必要契約仍需猜測。
- 文件、OpenAPI、實際 DTO 不一致。
- detail route、`draft`／`owner` 語意或題目流程入口未確認。
- server 無法穩定回傳 `403`，或拒絕後仍可能產生資料。
- CSRF／Origin 無法由真實 backend 驗證。
- 必須加入額外欄位、client-only 授權、BFF/proxy、mock、fallback 或 placeholder 才能繼續。
- health、migration、endpoint、E2E 或任一靜態 gate 失敗。

## Risk & Rollback

- 保持 F0 頁面、表單、mutation 與 contract wiring 為可識別的單一變更集；任一 gate 失敗即停止發布。
- 回滾只移除 F0 前端變更，不刪除或改寫既有 Course、題目、歷史結果，不撤銷 CLI credential。
- 回滾前後維持 server 授權與穩定 `403` 邊界；不得以假資料或 fallback 維持表面可用。
- F16 backend 的實際回滾與 migration 回滾程序在指定文件未定義，必須另由權威契約提供，不能自行推測。
- 回滾後重新執行 health、契約一致性與權限驗證，再決定是否重開 F0。
- CP2–CP4 可各自回滾，不得因 CP5 E2E 失敗而 reset 或刪除其他 checkpoint 的 handoff。
- backend 與 UI 是獨立 repository；回滾或提交前分別檢查各自 `git status`，不得跨 repository 使用廣泛 reset、`git add -A` 或刪除既有未相關變更。
- 若某 CP 只有部分測試通過，保留該 CP 為 `blocked`，回退到上一個 PASS handoff，不建立「部分完成」的假 checkpoint。

## 文件未定義、實作前必須取得的資訊

- `/auth/session` method、完整 DTO、`canCreateCourse` 型別。
- `POST /courses` 完整 request/response、success status、Course ID/owner/status 欄位。
- `name`／`description` 型別、必填性、長度、空白與驗證責任。
- forbidden、CSRF／Origin 與欄位錯誤的 code/message/envelope/UI 行為。
- loading、retry、duplicate、錯誤後保留輸入等互動。
- Course detail 與題目流程實際 route、navigation 方法、F1/F9 整合時點。
- `CourseCreateForm` 與 mutation 實際檔案名、測試檔名、fixtures、資料清理與「不產生資料」的查驗方法。

以上資訊未取得前，只能完成規格、依賴排序、測試設計與 gate 準備；不得直接實作 F0。

## Results

- 已完成 US-F0 的規格來源限定、阻擋分析、單一路線、驗收矩陣、驗證與回滾計畫。
- 2026-08-22 更新：新增 CP0–CP5 模組化工作單元、每個 checkpoint 的 scope/exit criteria/handoff、Session 結束與新 Session 啟動協議、backend/UI repository 邊界及精確 commit/rollback 規則。
- 驗收矩陣已增加 checkpoint 與 evidence 對應，避免把 component test、靜態 gate 或 backend code evidence 誤當成真實 F16/Playwright 完成證據。
- 目前仍只完成規劃更新；未新增 F0 前端程式碼。F16 real browser gate、fixture 與 runtime UI/CORS 條件未解鎖前，CP0 維持 `blocked`，CP1–CP5 不得開始。
