# SPEC F0–F17 前端實作計畫

## Context

目前 `smartLearning-ui` 只有 Next.js 16.3.1／React 19 起始頁（`app/page.tsx`、`app/layout.tsx`、`app/globals.css`），尚無 API client、認證、React Query、Zustand、Socket.IO、表單或測試架構。本計畫以 `docs/智學互動平台/20_系統分析/功能需求規格 SPEC.md` 的 US-F0～US-F17 為功能與驗收基線，以 `smartLearning-backend/docs/frontend-api-reference.md` 及實際 controller/DTO 為目前可串接契約；實作主體限定在 `smartLearning-ui`，後端缺口列為硬性啟動門檻，不使用 mock endpoint、placeholder 畫面或 client-only 規則假裝完成。SPEC 仍採匿名學員基線，較新的 student/enrollment UI 暫不納入，須先同步需求文件後另立故事；M2 已定案移除 `canCreateCourse` 不撤銷 CLI credential，而 account disable 才會撤銷；quiz 正確答案依後續安全設計只在關題後對學員揭露。

## Recommended architecture

- 採 App Router 與 Server Component 預設；只有表單、query provider、dialog、瀏覽器 credential 與 Socket controller 使用小範圍 `"use client"`。每個 route 提供唯一 metadata／`h1`，根頁改為 `lang="zh-Hant"`，並配置 `loading.tsx`、`error.tsx`、`not-found.tsx`。
- 瀏覽器直接呼叫明確的 `NEXT_PUBLIC_API_BASE_URL`，不先引入 BFF/proxy；集中由 `lib/api/client.ts` 設定 `credentials: "include"`、解開 `{data, meta, error}`、處理分頁雙層 `meta`、讀取 `__Host-csrf` 並在 mutation 加 `X-CSRF-Token`。瀏覽器自動送出 `Origin`，不得偽造、停用或以 `*` 繞過 CORS/CSRF。
- 加入 `@tanstack/react-query` 管理全部 server state；Zustand 只管理 toast、dialog、連線提示等 ephemeral UI，不保存 session、Course、snapshot、results 或 Submission。複雜題目表單在 US-F9 才加入 `react-hook-form`；US-F2 才加入 `socket.io-client`；結果長條圖先以語意化 HTML/CSS/SVG 與表格替代內容實作，不先增加 chart dependency。
- 建立代表性共用檔案：`app/providers.tsx`、`lib/api/{client,types,errors,query-keys}.ts`、`lib/auth/{session,csrf}.ts`、`lib/live/{socket-client,participant-credential}.ts`、`components/ui/*`、`components/layout/*`、`features/<story-area>/*`。匿名 participant token 與未決 idempotency key 只存於以 LiveSession／題目為 key 的 `sessionStorage`，不進 React Query、Zustand、console、analytics 或錯誤訊息。
- 第一個可實作故事即建立 Vitest + Testing Library 的純函式／元件測試基礎；關鍵使用流程以 Playwright 對真實 backend 驗收，不建 MSW 或 runtime fixture server。每次只開發一個 User Story；若該 Story 的 backend gate 未通過，先停止前端實作並完成後端契約，而不是跳過驗收。

## Execution order

依系統相依性執行：**F5 → F6 → F7 → F8 → F16 → F0 → F1 → F9 → F10 → F11 → F4 → F2 → F3 → F12 → F13 → F14 → F15 → F17**。F5/F6 建立身份與前端共用基礎，F16 先於開課，F9–F11 先於題目快照與場次，F12–F14 先於競態與結果；任何標示「阻擋」的 Story 都必須先解除後端 gate 才進入下一個 Story。

## User Story plans

### US-F5 系統管理員建立首位管理員與後續帳號

**狀態：可開始。** 一次性 bootstrap 保持部署命令，不建立 Web bootstrap 頁；先確認 `bootstrap-admin.ts` 的 fresh DB 成功一次／再次執行被拒，再以現有 `POST /admin/accounts` 實作 `app/(admin)/admin/accounts/new/page.tsx`、管理員 protected shell、帳號建立表單與 mutation，依本輪 SPEC 僅開放 `admin|teacher`，臨時密碼只作輸入且送出後立即清空，不期待 API 回傳密碼或 hash；本 Story 同時落地 API envelope、CSRF、React Query provider、穩定錯誤碼顯示與基礎測試架構。驗收涵蓋 bootstrap 一次性、管理員建立老師／管理員、首次登入旗標、非管理員 403、回應與 UI 不洩露密碼，以及 typegen/typecheck/lint/build、元件測試與真實 backend 瀏覽器流程。

### US-F6 使用者登入、登出與 Web Session

**狀態：可開始。** 以現有 `/auth/login`、`/auth/session`、`/auth/logout` 實作 `app/(auth)/login/page.tsx`、`useSession`、`useLogout`、protected layout 與 `mustChangePassword` gate；login 不送 CSRF，其他 cookie mutation 讀 `__Host-csrf`，session authority 永遠是 `/auth/session`，不自建 JWT 或把登入資料放進 Zustand。登出時清除 query/敏感 UI state、以 replace navigation 返回登入並確保 browser back 不重顯受保護資料；驗收 active 登入、disabled/未知帳號通用錯誤、30 分鐘 idle、8 小時 absolute expiry、logout CSRF、改密碼後 session rotation、首次登入只能前往改密碼頁，以及 cookie/token 不出現在 log。

### US-F7 使用者設定與變更密碼

**狀態：完整故事阻擋。** 現有 `/auth/change-password`、admin reset 與 step-up 可支援改密碼／臨時密碼流程，但 backend 尚未完成常見或已外洩密碼拒絕，以及帳號＋來源雙重 login rate limit；先由 backend 補齊穩定錯誤碼與整合測試後，再實作 `app/(protected)/settings/password/page.tsx`、目前密碼／新 passphrase／確認欄位、強制改密碼流程與可重用 `StepUpDialog`，管理員 reset UI 則等可定位帳號的查詢契約，不提供任意 UUID 輸入頁。驗收包含 12–128 Unicode passphrase、無組合規則、過短／常見／外洩密碼拒絕、錯誤 current password、reset 後 `mustChangePassword`、大量登入失敗 rate limit 但不永久鎖死且不洩露帳號存在性。

### US-F8 帳號停用與 credential 失效

**狀態：阻擋。** Backend 雖有 disable/restore endpoint，仍缺 admin account list/detail，且既有 teacher Socket 只在 handshake 認證、停用後可能持續收到 teacher-room 資料；先補齊可查詢帳號的管理契約、teacher socket reauthorization／主動 disconnect 與對應 e2e，再新增 `app/(admin)/admin/accounts/[accountId]/page.tsx`、停用／恢復確認流程與 CLI credential metadata/revoke 區塊。停用成功後 invalidate account/session queries 並關閉相關 socket；驗收必須證明 Web Session、CLI credential、未使用 token 與既有 teacher socket 立即失效，Course／LiveSession／Submission／稽核資料保留，restore 後可登入，且 CLI security lock 不影響 Web 登入。

### US-F16 系統管理員以開課授權旗標控管誰能建立課程

**狀態：阻擋。** 現況只允許建立帳號時設定 `canCreateCourse`，沒有 account list/detail/update 或 permission toggle endpoint；先由 backend 定義並完成帳號權限更新契約，再在既有帳號詳情頁加入 accessible switch、`useUpdateAccountPermissions` 與 query invalidation，不建立 local-only toggle 或不存在的 PATCH。驗收啟用後可建課、移除後新建回穩定 403、既有 Course／題目／歷史結果不變、既有 CLI credential 仍有效，並與 account disable 的 credential revoke 行為明確區隔。

### US-F0 老師建立課程

**狀態：可開始（須先完成 F16 gate）。** 以現有 `POST /courses` 實作 `app/(teacher)/courses/new/page.tsx`、`CourseCreateForm` 與 mutation，欄位只包含實際 contract 的 `name`、`description`，成功後導向 Course detail 並顯示 `draft`、owner；`/auth/session` 的 `canCreateCourse` 只控制 UX 可見性，server 403 仍是授權權威，不提供共同授課、所有權移轉或尚不存在的 Course 編輯。驗收有 flag 建立成功且建立者為唯一老師、無 flag 不產生資料、CSRF/Origin、欄位與鍵盤操作、穩定 forbidden error，以及成功後可進入題目流程。

### US-F1 老師管理 Course 生命週期

**狀態：完整故事阻擋。** 現有 Course list/detail/archive 可支援封存，但 SPEC 要求 archived Course 仍可查詢歷史場次與結果，而 backend 尚無 LiveSession list/history、session-wide results 或 ArchivedResult；先補齊歷史查詢契約後，再實作 `app/(teacher)/courses/page.tsx`、`courses/[courseId]/page.tsx`、分頁列表、read-only archived detail 與不可逆 `ArchiveCourseDialog`，不加入 Course delete、restore 或不存在的 name PATCH。驗收無 waiting/active 時 archive 成功、有進行中場次拒絕並保持 draft、archived 後所有寫操作隱藏且 server 仍拒絕、歷史場次／結果仍可由真實 API 查詢，以及 archive race 後正確 refetch。

### US-F9 老師建立符合題型規則的題目

**狀態：可開始。** 以既有 questions CRUD/order 實作 Course 下的題目列表、新增／編輯頁與 `QuestionEditor`，使用 `react-hook-form` 管理 poll single/multiple、open_text、quiz 的動態欄位；前端提供長度、2–10 選項及 required/forbidden 提示，但 server validation 是最終權威，Question ID 不可輸入或修改，archived/locked conflict 顯示可採取的下一步。驗收三題型 happy path、`FIELD_FORBIDDEN`、`CORRECT_OPTION_INVALID`、`TEXT_TOO_LONG`、`OPTION_COUNT_INVALID`、重複選項、完整 reorder、Question ID 不可變、`QUESTION_LOCKED_BY_SESSION` 與 archived 不可寫，且 Web 單題 CRUD 不受批次 50 題限制。

### US-F10 系統以正規化判斷重複選項並一次回報所有錯誤

**狀態：完整故事阻擋。** Batch validate 已能一次回傳 errors 並阻止部分建立，但 backend 尚未產生同 Course 相同題幹的非阻擋 warning；先補齊穩定 warning code/path/message/blocking/nextStep 後，再實作 batch editor、每題唯一 `clientRef`、`BatchIssueList` 與 validate mutation，逐項呈現 server 回傳的全部 errors/warnings，不在 client 私自推導 duplicate-prompt warning。驗收 Unicode 正規化後重複 option、trim/合併空白/casefold、51 題、重複 clientRef、多錯誤一次回報、同題幹 warning 不阻擋，以及 `valid=false` 時 DB 零新增。

### US-F11 老師批次建立題目須預覽並明確確認

**狀態：等待 F10 gate 後可開始。** 以現有 validate/confirm、validation token、payload hash 與 idempotency contract 實作 preview→confirm 兩階段 UI；Course 名稱與 ID 由同一個權威 Course query 顯示，preview 依 server 回傳順序呈現題目、選項、正解與 warnings，payload 任一變更即丟棄記憶體中的 token/hash 並重新 validate，confirm 使用原 payload/hash、`confirmed:true`、`X-Validation-Token` 與同一 UUID idempotency key，token 不進 storage/log。驗收完整預覽、明確確認、修改後必須重驗、token expiry/consumed/hash mismatch、same-key replay、all-or-nothing、依 preview 順序 append、archived Course 拒絕，且不產生隱藏的部分成功。

### US-F4 老師跨場次重用題目且不影響歷史

**狀態：可開始。** 以 Course questions 與 LiveSession create/start API 實作 `courses/[courseId]/sessions/new/page.tsx`、可選子集合與排序的 `QuestionPicker`、建立摘要與 mutation，只送正式 question UUID 並由 start response 的 SessionQuestion snapshot 作權威；UI 不把 QuestionDefinition 複製成自有快照，也不假設有 session list。驗收同題跨兩場獨立使用、下一場從 `not_open` 開始、開始後修改來源題目不影響既有 snapshot、同場 closed 題不可重開、同時最多一題 open，以及順序與 snapshot 分離由 backend integration test 證明。

### US-F2 老師管理單一場次生命週期

**狀態：阻擋。** 現有 create/start/open/close/manual close/cancel/detail 足以示範流程，但 cancel 實作違反 SPEC（允許 active 且未檢查 Submission），8 小時 auto-close scheduler 亦不存在；先由 backend 修正 cancel state guard、Submission 檢查、auto-close 與 submit/close 線性化測試，再實作 teacher live page、session code、waiting→active、逐題 controls、close/cancel confirmations 與此計畫第一個 `socket.io-client` adapter。Socket 事件只作 query invalidation／refetch，REST snapshot/detail 為權威；驗收單 Course 最多一個 waiting/active、start 建不可變 snapshot 且全部 `not_open`、一次只 open 一題、closed 不可重開、active 只能 close、waiting 且無 Submission 才可 cancel、8 小時自動 closed、所有終止狀態不可逆。

### US-F3 學員以 session code 加入場次

**狀態：等待 F2 gate 後可開始。** 實作公開 `app/join/page.tsx`、8 碼 code 輸入與 join mutation，輸入只做 trim/uppercase 的 UX 正規化，直接呼叫既有 `POST /live-sessions/:sessionCode/join`，不建立不存在的 resolve endpoint；code 只用於定位 LiveSession，join response 的 session ID/status 才決定導向。驗收小寫 code 成功、產生的 code 排除混淆字元、invalid/closed/cancelled/滿 8 小時與舊 code 拒絕、舊 code 不指向新場，以及 code 本身不能作 participant identity 或 CLI credential。

### US-F12 學員匿名加入場次並取得場次限定 token

**狀態：可開始（接續 F3）。** 在 join flow 加入 display name 與 `ParticipantCredentialStore`，成功後只將 raw participant token 存於以 LiveSession ID 為 key 的 `sessionStorage` 並導向 `app/live/[liveSessionId]/page.tsx`；token 不進 query cache/Zustand/log，不支援跨場追蹤，display name 只作顯示而非身份。前端可提示 trim、1–40 字與控制／換行／方向字元限制，但 server 是權威；驗收匿名加入、同場同名取得不同 token、不安全／41 字名稱拒絕、token 跨場失效、reload 可重連，以及清除 browser state／換裝置不保證同一 participant。

### US-F13 學員以 participant token 重連恢復狀態

**狀態：可開始（依賴 F2 auto-close）。** 以 participant token 呼叫 snapshot 並連接 `/live`，實作 `useParticipantSnapshot`、`useLiveConnection` 與連線狀態提示；每次 connect/reconnect 先清除該場舊 query，再發出 `snapshot.fetch` 並 refetch REST snapshot，所有 opened/closed/state/result 事件只觸發權威查詢，不合併舊 cache，也不假裝支援尚未存在的 eventSeq/outbox/replay。驗收 reload/reconnect 不建立第二 participant、恢復最新場次／目前題／`hasSubmitted`／可見結果、server snapshot 覆蓋舊瀏覽器狀態、closed/cancelled/expired 後拒絕並清除本地 credential；durable replay 列為後續可靠性工作，不是此 UI 的偽實作。

### US-F14 學員提交答案受 idempotency 與唯一性保護

**狀態：可開始。** 在 learner live page 依 snapshot 題型實作 poll/quiz/open_text answer components 與 submission mutation；每次邏輯提交建立一個 UUID idempotency key，連同 payload fingerprint 暫存於 `sessionStorage`，timeout/retry 必須沿用同一 key，取得權威成功／衝突結果後才清除，不採 optimistic submission 作權威。回應中的 `selectedOptionRefs` 可能已正規化為正式 option UUID，因此 UI 以 option ID map 比對；驗收首次成功、same-key same-payload replay、same-key different-payload 衝突、不同答案不得覆寫、多分頁最多一筆、not_open/closed 拒絕、open_text refs/text 互斥，以及 secret/答案不出現在 log。

### US-F15 問題與提交競態依伺服器權威順序判定

**狀態：完整故事阻擋。** Manual close/submit 已有鎖定基礎，但完整驗收需 F2 auto-close 與真實 race matrix；backend 先補齊 submit-first、close-first、timeout replay、auto-close 同時提交的資料庫整合測試後，前端重用 F2/F14 mutation/query，任何 socket closed 事件都只觸發 REST refresh，不依 client time、事件到達順序或 optimistic state 判定答案。驗收 submission 先 commit 則保留、close 先 commit 則拒絕、未收到 response 用原 key 取回、socket 與 REST 不一致時採 REST、auto-close race 依 commit 順序，並確認畫面不會由晚到的 stale event 覆寫較新的 snapshot。

### US-F17 學員與老師看到符合題型的即時結果呈現

**狀態：等待 F15 後可開始。** 以既有 per-question results 與 teacher/participant-safe realtime projection實作 `ResultPanel`、poll/quiz accessible bars、資料表替代內容與 open_text 匿名純文字列表；不存在 session-wide results endpoint，因此老師端依 SessionQuestion IDs 逐題查詢，不捏造 route，Socket `counts.updated`/`result.updated` 只觸發 refetch。學員 open 時須先 submit 才看 aggregate，關題後全班可見；quiz 可先顯示分布，但正確答案標記僅在 backend 關題已 closed 且回應允許時出現；老師只見匿名 aggregate 與 joined/voted counts，不見身份對答案。驗收 poll/quiz/open_text、vote-to-reveal、未投者隱藏、close 自動公開、quiz correctness reveal gate、匿名性、鍵盤／螢幕閱讀器／直接標籤／表格 fallback／reduced-motion；word cloud/toggle 延後且不阻擋純文字列表完成。

## Risk, rollback, and deferred scope

- **風險等級：高（auth/token/realtime/privacy），中（authoring/forms），低（read-only layout）。** 每個 Story 保持可獨立移除的 route、feature module 與 query key；contract 不符時回滾該 route/link/dependency，不以 fallback 假資料繼續。
- CSRF/CORS 設定不正確時停止驗收；不將 `CORS_ORIGIN` 改為 `*`、不關閉 CSRF。若 realtime 不穩，暫停 subscription 並保留 REST refetch，不允許 stale socket 狀態授權、提交或揭露結果。
- 禁止記錄 password、cookies、CSRF／participant／validation／CLI token、idempotency key、完整 answer payload 或 open_text 回答；任何 teacher projection 廣播到 participant、quiz 正解提早揭露或身份對答案映射皆為 release blocker。
- 本輪延後：student account/enrollment UI、Course name edit、account list/detail/update 未完成前的帳號管理、durable outbox/eventSeq/replay/Redis adapter、ArchivedResult/90-day retention/delete，以及 open_text word cloud/toggle。

## Verification

1. 每個 Story 先以真實 backend health、migration status、相關 endpoint/e2e 確認 gate，再開始 UI；測試執行交由專用 test subagent，回傳 command、scope、PASS/FAIL、最小錯誤證據與 confidence。
2. 前端最小靜態 gate：`npx next typegen` → `npm run typecheck` → `npm run lint:check` → `npm run build` → `git diff --check`；新增測試腳本後再跑目標 Vitest/Testing Library 測試與該 Story 的 Playwright 真實 backend 流程，最後才擴大 regression。
3. 端到端環境：backend `localhost:3000`、UI `localhost:3001`、明確 `CORS_ORIGIN=http://localhost:3001`；先檢查 `http://localhost:3000/health/live`、`http://localhost:3000/health/ready`，再以 Swagger UI `http://localhost:3000/api/docs` 人工核對 endpoint、DTO、header 與狀態碼，並以 `http://localhost:3000/api/docs-json` 作為機器可讀的 OpenAPI 契約來源。Swagger/OpenAPI 顯示的是內層 DTO，前端仍須自行解開 `{ data, meta, error }` envelope；若 Swagger、`smartLearning-backend/docs/frontend-api-reference.md` 與實際 controller/DTO 不一致，停止該 Story 並先同步後端契約。不使用 mock API；每個 Story 的 acceptance matrix 記錄 completed／blocked／not-applicable，不把 partial 當完成。
4. Accessibility/responsive smoke：`lang="zh-Hant"`、每頁唯一 title/h1、label 與 `aria-describedby`、鍵盤可完成所有 dialog/action、focus 回復、狀態不只靠顏色、圖表表格替代、對比與 reduced motion，並在 Chrome/Edge 桌面及手機寬度驗證。

## Critical files

- Existing: `smartLearning-ui/package.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `smartLearning-backend/docs/frontend-api-reference.md`.
- Shared additions: `app/providers.tsx`, `lib/api/client.ts`, `lib/api/types.ts`, `lib/api/query-keys.ts`, `lib/auth/session.ts`, `lib/live/socket-client.ts`, `lib/live/participant-credential.ts`.
- Representative feature areas: `features/auth/`, `features/admin/`, `features/courses/`, `features/questions/`, `features/live-teacher/`, `features/live-learner/`, `features/results/`, plus matching App Router pages and tests.
