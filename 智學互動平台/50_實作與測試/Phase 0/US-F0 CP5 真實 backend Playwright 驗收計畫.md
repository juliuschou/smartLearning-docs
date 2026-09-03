# US-F0 CP5 真實 backend／Playwright 驗收計畫

## Context

CP4 已完成並通過靜態與 focused Vitest 驗證：老師建立課程成功後以 server 回傳的 Course ID 導向 `/courses/:id`，detail 讀取真實 Course state，顯示 `draft`、`ownerAccountId` 與「唯一老師」語意。CP5 仍未執行；現有 `smartLearning-ui/test/browser/us-f16-account-permission.spec.ts` 只驗證 F16 權限 API 流程，沒有驅動 F0 的 `/courses/new` 表單、server-ID 導向或 Course detail。

本次只完成權威計畫定義的 CP5：真實 backend + Playwright、隔離 fixture、資料清理、release/static gates 與 acceptance matrix；不新增 F0/F1/F9 product behavior，不使用 MSW、runtime fixture server、mock API、BFF、假資料或 client-only 授權。風險為中高（跨 auth/CSRF、授權撤銷、真實資料清理），但不涉及 schema migration。

## 可驗證的完成條件

- 真實 UI `http://localhost:3001` 連到真實 backend `http://localhost:3000`，runtime `CORS_ORIGIN` 精確為 `http://localhost:3001`，資料庫已 migrate，且 backend source/runtime parity 已重新確認。
- 具 `canCreateCourse=true` 的隔離 teacher 透過真實 UI 建立 Course；POST 回應為 201，request body 僅有 `name` 與 defined `description`，導向 URL 使用 response 的 server UUID。
- 重新載入 detail 以取得真實 GET response，證明名稱、`draft`、`ownerAccountId` 與唯一老師語意來自 server；不出現 Course ID/raw backend detail，且沒有 F9 dead link。
- 對同一個已登入 teacher 撤銷 `canCreateCourse` 後，透過 UI 再次提交取得穩定 403/curated forbidden error，URL 留在 create route，Course list 的 ID 集合/count 不增加。
- 真實 browser mutation 使用 session cookie、`__Host-csrf`、matching `X-CSRF-Token` 與 exact Origin；缺 CSRF 或錯 Origin 的負向請求均為 403 且不新增資料。
- 以可見 label/role、Tab/Enter 或 Space、focus/ARIA、手機 viewport 與 reduced-motion smoke 證明表單與 detail flow 可操作；不以顏色作唯一狀態訊息。
- 只 archive/清理本次 fixture 建立的 Course，還原 permission，登出所有測試 session；不刪除或修改既有 Course、Question、result、credential 或既有 CP0/original volume。
- `next typegen`、targeted Vitest、typecheck、lint、build、diff check、full Vitest 與 real Playwright 均有可追溯 PASS evidence；缺 fixture、服務、CORS、migration 或任一 gate 失敗時，CP5 保留 `blocked`，不以 skipped test 宣稱完成。

## Checkpoint A — 重新驗證 runtime 與隔離 fixture

1. 只讀檢查 UI/backend git status，確認 backend 的 dirty F16 source 不被 reset、staged 或混入 UI diff。
2. 依 CP0 protocol 重新 probe `/health/live`、`/health/ready`、`/api/docs`、`/api/docs-json`；核對 live OpenAPI、`smartLearning-backend/docs/frontend-api-reference.md` 與實際 Course controller/DTO：`POST /api/v1/courses` 201、`GET /api/v1/courses/:id` 200、CourseDto 欄位與 `draft` status、permission PATCH。
3. 確認 isolated DB migration 完成、backend 由目前 F16 source 建置，且 runtime 的 `CORS_ORIGIN=http://localhost:3001`。不可直接拿 backend `.env.test`（其 CORS 是 supertest 的 `localhost:3000`）當 browser runtime 設定。若 runtime/source、CORS、DB 或 service 不一致，停止並記錄 `blocked`；不以 mock 或臨時 fallback 繞過。
4. 建立一次性、隔離且可清理的 CP5 Compose project 與 fresh database volume：admin 與唯一 teacher。teacher 必須完成 forced-password-change，並取得其 account ID；以 process environment 傳入 `F0_API_BASE`、`F0_UI_ORIGIN`、`F0_ADMIN_USERNAME`、`F0_ADMIN_PASSWORD`、`F0_TEACHER_ACCOUNT_ID`、`F0_TEACHER_USERNAME`、`F0_TEACHER_PASSWORD`、`F0_COURSE_NAME_PREFIX`。帳密、cookie、CSRF、raw token 僅留在 provisioning process／Playwright context，不寫入 source、task log、trace、console 或 chat。
5. 為 teacher 建立 Course ID baseline；測試使用唯一 prefix，確保 cleanup 只針對本次產生的 UUID。缺少任一 fixture variable 時，browser run 必須明確標為 `blocked`（不是接受 `test.skip` 作為 PASS）。

## Checkpoint B — 新增 F0 real-browser spec

新增 `smartLearning-ui/test/browser/us-f0-course-flow.spec.ts`，沿用 `playwright/test` 與既有 `run.mjs`；不新增 API client、fixture server、dependency、Playwright config 或 runner 修改。使用兩個獨立的 `browser.newContext()`：一個保持 admin session，一個保持 teacher UI session；CSRF 由各自 context 的 cookie/storage 取得，不假設 standalone `request` fixture 與 UI login 共用 cookie。跨 spec 執行時使用 `--workers=1`，避免與既有 F16 permission/course writes 競態。

測試流程：

1. 以手機 viewport（約 390×844）及 `reducedMotion: "reduce"` 啟動，從 `/login?next=/courses/new` 以 `getByLabel("帳號")`、`getByLabel("密碼")` 登入 teacher，確認受保護的 `/teacher` 與現有 `建立課程` CTA；以鍵盤 focus/Tab/Enter 完成導向，避免只用滑鼠點擊。確認沒有水平溢出，desktop viewport 再做必要 detail smoke。
2. 開啟 `/courses/new`，以 `getByLabel("課程名稱")`、`getByLabel("課程說明")` 填入唯一 name/description；在 submit 前確認 labels、`aria-describedby`、button role/disabled 狀態。捕捉實際 POST `/api/v1/courses` request/response，不記錄 token；assert status 201、Origin 為 UI origin、`x-csrf-token` 非空，body keys 精確為 `name`/`description`，且沒有 `ownerAccountId`、`status`、teacher 或其他欄位。
3. 從 response envelope 的 `data.id` 取得 server Course ID，assert page URL 精確為 `/courses/<server id>`；assert detail heading/name、`draft`、owner label/target teacher ID、`唯一老師` 文案與無 F9 link/button。比較登入 teacher 的 session `accountId` 與 `ownerAccountId`。重新 `page.reload()` 並捕捉 GET `/courses/<id>` 200，避免只把 mutation cache seed 當作 detail evidence；assert GET DTO 的 id/name/status/ownerAccountId 與建立 response 一致。
4. 以同一 teacher browser context 發出兩個真實負向 mutation：matching Origin 但省略 CSRF header，以及 matching CSRF cookie 但使用未允許 Origin；兩者均應 403 `AUTH_CSRF_INVALID`，raw backend message 不出現在 UI/report，並以 GET `/courses` 前後完整 ID 集合確認沒有新增 Course。
5. 以 admin context 進入既有 account detail UI，確認 target 是 active teacher 且 permission 初值，使用 focus/Space/`aria-checked` 操作正式 permission switch 將 teacher `canCreateCourse` 設為 false，並 assert PATCH 200、exact Origin/CSRF。保留已登入的 teacher browser session，回到 `/courses/new` 以相同 accessible keyboard flow 提交另一個唯一 name。assert response 為 403 `FORBIDDEN`、curated `ErrorAlert` 可見、raw server message 不可見、URL 不導向 detail，並再次以 Course list baseline 證明無新 row。這個 stale-session assertion 依賴 backend 每 request 重查 Account；不把 session DTO 的 `canCreateCourse` 當授權權威。
6. 在 `finally` 中只 archive 本次成功建立的 Course（目前 contract 沒有 delete endpoint）；依 fixture 原值透過 admin UI 還原 `canCreateCourse`，登出 teacher/admin。確認 cleanup 只針對本次產生的 UUID；若 setup 或 cleanup 途中失敗，將 CP5 標為 `blocked`。

## Checkpoint C — 靜態、瀏覽器與回歸驗證

依權威順序執行並保存最小證據：

```bash
npx next typegen
npm test -- test/course-create-form.test.tsx test/course-detail-view.test.tsx test/course-detail-route.test.tsx
npm run typecheck
npm run lint:check
npm run build
git diff --check
npm test
node test/browser/run.mjs --list
node test/browser/run.mjs --workers=1 test/browser/us-f0-course-flow.spec.ts
```

- 先確認 `--list` 顯示 F0 spec；若 fixture 缺失造成 skip，記錄 `blocked`，不得把 skipped/僅 component tests 當 real E2E。
- Browser command 之前確認 backend/UI/DB、exact CORS、fixture 與 source parity；command 之後記錄 Chromium passed/failed/skipped、server URL/response status、cleanup 結果、無 secrets 的 report/trace 路徑。
- 既有 F16 browser spec 僅在完整且獨立的 `F16_*` fixture 存在時另行執行；不得將 skipped F16 或既有 F16 1-pass 報告冒充 F0 CP5 evidence。
- 靜態 gate 的既有 React Compiler/Vite 非阻塞 warning 只記錄，不擴大 scope；任何 error 或真實 flow failure 停止發布並回到 diagnosis。

## CP5 handoff 與 acceptance matrix

驗證後只在 `smartLearning-ui/tasks/todo.md` 追加 CP5 section，記錄日期、scope、變更檔、每條命令與最小結果、fixture/cleanup（不含秘密）、Playwright report、git status/diff scope、風險與 rollback。Acceptance matrix 僅使用 `completed`、`blocked`、`not-applicable`：

- **completed**：F0 create→server detail、draft/owner/unique teacher、forbidden 403/no-new-row、CSRF/Origin、keyboard/a11y/responsive/reduced-motion、static gates 與 cleanup 均有 real evidence。
- **blocked**：任一 runtime、fixture、CORS/source parity、migration、cleanup、E2E 或 static gate 缺失/失敗；保留具體 command/status/下一步。
- **not-applicable**：共同授課、所有權移轉、Course 編輯/刪除、額外 owner/status creation fields。
- **F9：blocked**：權威 question route/API 與 integration point 尚未確認；維持 detail 的 non-navigating deferred state，不建立 dead link 或 placeholder。

## Risk & rollback

- 風險：真實 mutation 可能留下資料、permission restore 可能失敗、跨 spec fixture 可能競態、cleanup masking failure、CSRF/CORS 設定可能與 `.env.test` 混淆。
- 防護：fresh/isolated CP5 Compose project + volume、baseline ID set、`finally` archive/restore/logout、Playwright `--workers=1`、不輸出 secrets、先 health/migration/OpenAPI 再 mutating browser。
- 驗證完成並保存 sanitized evidence 後，tear down **只由 CP5 建立的** Compose project/volume；不得使用 broad `down -v`、truncate、刪除 arbitrary rows，亦不得觸碰原有 CP0/original stack/volume。若 cleanup 或 teardown 失敗，CP5 為 `blocked`，先依唯一 recorded UUID/project 恢復，再決定是否重開。
- 回滾只移除 `test/browser/us-f0-course-flow.spec.ts` 與 CP5 `smartLearning-ui/tasks/todo.md` section；不 reset working tree、不回滾 backend dirty source、不刪既有 domain data。
- 監控訊號：POST 201/GET 200、403 `AUTH_CSRF_INVALID`/`FORBIDDEN`、Course ID 集合不變、archive/permission restore/logout 成功、無 token/raw backend detail 出現在 UI/report/log。

## Dependencies & open assumptions

- Node 24+、Next 16.3.1、Playwright 1.62.1、backend 3000、UI 3001、explicit CORS origin、isolated migrated DB。
- Existing UI transport/form/detail implementations are authoritative and should be reused; no product source change is planned unless a real browser reproduction proves a CP4 defect. Any such defect stops CP5 and requires a new review before editing product code.
- F9 remains **blocked** until an authoritative question route/API and integration point are supplied。
