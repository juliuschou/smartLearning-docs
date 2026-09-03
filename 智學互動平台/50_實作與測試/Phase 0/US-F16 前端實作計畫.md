# US-F16 前端實作計畫：開課授權旗標

## Context

本計畫**僅根據** `/home/user/projects/smartLearning/docs/智學互動平台/50_實作與測試/SPEC F0-F17 前端實作計畫.md` 的 US-F16 及其相鄰規則整理。後續程式實作只能以本計畫為依據；不得再自行查閱或引用其他文件補足未定義的 API、角色或 UI 行為。

US-F16 目前為「阻擋」：現況只在建立帳號時設定 `canCreateCourse`，尚無帳號列表／詳情／更新或權限切換能力。目標是在既有管理員帳號詳情頁，加入由正式 backend 契約驅動的可存取 switch，使用 `useUpdateAccountPermissions` 並在成功後執行 query invalidation。開課授權由 server 決定；前端可控制 UX 可見性，但不能取代 server 授權。移除 `canCreateCourse` 不得撤銷既有 CLI credential，也不得被實作成 account disable。

## 成功標準

- 依賴 `F5 → F6 → F7 → F8 → F16 → F0` 已滿足；F8 已提供可承載功能的既有管理員帳號詳情頁。
- backend 的帳號權限更新契約已在本計畫的「契約輸入」欄位完整確認；未完成前不得寫前端 API、型別、hook 或 switch。
- 既有帳號詳情頁的 switch 初始狀態來自 server，具備 label／ARIA／鍵盤操作／焦點與非色彩狀態提示。
- 以共用 API client 實作 `useUpdateAccountPermissions`，不建立 local-only toggle、不捏造不存在的 PATCH 或其他 endpoint。
- mutation 成功後，已確認的帳號詳情 query（以及契約明確要求的其他 query）失效並重新取得 server 狀態。
- 啟用旗標後，後續 F0 真實建課流程可建立課程；移除旗標後，新建課程由 server 穩定回傳 HTTP 403，且不產生新資料。
- 切換前後既有 Course、題目、歷史結果不變；既有 CLI credential 仍有效；不觸發 account disable／restore 或 credential revoke。
- 目標測試、真實 backend 流程與靜態 gate 全部通過；驗收矩陣不得以 `Partial` 代替 `Completed`、`Blocked` 或 `Not applicable`。

## 範圍界線

### 本次包含

- `features/admin/` 中的帳號權限 mutation 與 `useUpdateAccountPermissions`。
- `lib/api/client.ts` 的正式權限更新請求。
- `lib/api/types.ts` 的契約確認後 request／response／error 型別。
- `lib/api/query-keys.ts` 的既有帳號查詢 key 與 mutation invalidation。
- 既有帳號詳情頁的 accessible `canCreateCourse` switch：規格列出的候選路徑為 `app/(admin)/admin/accounts/[accountId]/page.tsx`；若 F8 實際路徑不同，先更新本計畫的契約輸入，不得自行猜測。
- 對應的 Vitest／Testing Library／Playwright 測試與驗收矩陣。

### 明確不包含

- backend 權限契約本身的設計或實作。
- F0 的 `POST /courses`、建課頁或 Course 流程。
- 帳號 list、disable／restore、CLI credential 顯示／管理／撤銷。
- student account／enrollment、Course 編輯、mock endpoint、placeholder 畫面或 client-only 授權。

## 契約輸入（Checkpoint A 前必須填滿）

以下資訊必須在本計畫中取得正式確認；任一欄缺失，US-F16 維持 `Blocked`，不得進入前端實作：

- 權限更新 API 的確切 path 與 HTTP method。
- request body、帳號識別欄位、`canCreateCourse` 欄位及其允許值。
- 成功 HTTP status、response DTO 與 envelope 內資料形狀。
- 失敗 HTTP status、穩定 error code 與 error response shape。
- 可執行更新的角色、可被修改的帳號範圍與授權失敗語義。
- 權限移除與 account disable／restore、credential revoke 的分離行為。
- 更新後帳號詳情的 canonical query key、需 invalidation 的查詢，以及 server 是否回傳最新狀態。
- F8 實際帳號詳情頁 route、已核准的 switch accessible name／label／錯誤與成功文案。
- 真實 backend 測試帳號、旗標狀態、既有資料與 CLI credential fixture。

未定義項目不得由前端自行命名、推導或以通用型別掩蓋；若需要補充，先停止並回到契約 gate。

## Checkpoint A：理解、依賴與啟動 gate

1. 確認 F5、F6、F7、F8 已按順序完成，且 F8 的帳號詳情資料流可讀取 `canCreateCourse`。
2. 確認本計畫的「契約輸入」全部完成；不可假定 method、path、body、response、error code、角色或 query key。
3. 確認 backend 真實環境可用：`localhost:3000`、migration 完成、health 通過、權限更新 endpoint 可實際呼叫；UI 預定為 `localhost:3001`，`CORS_ORIGIN=http://localhost:3001`。
4. 確認 F0 的真實建課流程可供後續驗證「啟用後可建課／移除後 403」，但不在 F16 實作 F0。
5. 任一 gate 失敗時，維持 `Blocked`，不寫假 API、不做 local-only switch、不以隱藏建課入口宣稱授權完成。

## Checkpoint B：最小前端切片

1. **API 型別**：只在 `lib/api/types.ts` 加入契約實際定義的 request／response／error 型別；不使用 `any`、空物件或猜測性的 permission payload。
2. **API client**：在 `lib/api/client.ts` 透過既有共用 client，嚴格使用契約指定的 path、method、body 與 envelope 解析；頁面不得硬編請求。
3. **Mutation**：在 `features/admin/` 實作 `useUpdateAccountPermissions`。成功與否以 server response 或重新查詢結果為準；失敗不得保留看似成功的 local-only 狀態。
4. **Switch**：在已確認的 F8 帳號詳情頁整合 switch。初始值來自 server；更新中避免重複提交；成功後以 server 狀態為準；失敗後回復／重取 server 狀態並顯示契約定義的錯誤。
5. **Query invalidation**：在 `lib/api/query-keys.ts` 使用既有或契約確認的帳號詳情 key；成功後 invalidation 並重新取得。不得自行創造未確認的 account list 或 session key。
6. **責任邊界**：`/auth/session` 的 `canCreateCourse` 只能控制 F0 建課入口 UX；真正授權仍由 `POST /courses` 的 server 回應決定。F16 不新增建課 API 或建課畫面。

## Checkpoint C：回歸與驗收

### 目標測試

- **初始狀態與重新整理**：switch 與真實帳號詳情的 server 狀態一致，重新整理不依賴瀏覽器暫存。
- **Accessibility**：switch 有核准的 accessible name／label／描述，可用鍵盤操作，focus 可辨識，更新中與錯誤不只用顏色傳達。
- **成功切換**：啟用與移除都以正式 endpoint 完成；mutation 後 query invalidation，重新取得後畫面反映 server 狀態。
- **失敗切換**：不顯示假成功；重新取得後仍是 server 原值；錯誤使用契約內容，不自行發明 error code。
- **角色語義**：只測試契約明定的可操作／不可操作角色，不自行放寬權限。
- **建課授權**：啟用後由 F0 真實流程確認可建課；移除後以真實目標帳號重新呼叫建課，確認穩定 HTTP 403，且不產生新 Course。
- **資料保留**：toggle 前後比對既有 Course、題目、歷史結果，確認不變。
- **CLI／停用區隔**：移除 `canCreateCourse` 後既有 CLI credential 仍有效；permission toggle 不觸發 account disable／restore 或 credential revoke。

### 驗收矩陣（規劃初始狀態）

| 項目 | 完成證據 | 初始狀態 |
|---|---|---|
| backend 權限契約 | path、method、body、response、error、角色語義完整 | Blocked |
| F8 詳情頁可承載 switch | route、資料流與 query key 已確認 | Blocked |
| accessible switch | Testing Library + 真實頁面鍵盤／ARIA 檢查 | Blocked |
| `useUpdateAccountPermissions` | 真實 endpoint 成功／失敗流程 | Blocked |
| query invalidation | mutation 後重新取得並反映 server 狀態 | Blocked |
| 啟用後可建課 | F0 真實建課成功 | Blocked |
| 移除後穩定 403 | 真實建課被拒且不產生資料 | Blocked |
| 既有 Course／題目／歷史結果不變 | toggle 前後資料比對 | Blocked |
| CLI credential 仍有效 | 既有有效流程驗證 | Blocked |
| 與 disable／revoke 區隔 | 無停用或 credential 副作用 | Blocked |
| 靜態 gate | 指定命令依序全數通過 | Blocked |
| F16 不在範圍項目 | 不實作 disable、credential 管理、student/enrollment、F0 | Not applicable |

### 靜態與真實環境驗證順序

1. 先確認真實 backend health、migration、權限 endpoint 與 CORS；不可用 mock API 取代。
2. 依序執行：
   ```text
   npx next typegen
   npm run typecheck
   npm run lint:check
   npm run build
   git diff --check
   ```
3. 再執行目標 Vitest／Testing Library 與 Playwright 真實 backend 流程。
4. 使用 Chrome／Edge 桌面與手機寬度做 accessibility/responsive smoke；檢查唯一 title/h1、label／`aria-describedby`、鍵盤 action、focus、非色彩狀態與 reduced motion。
5. 由專用 test subagent 回報 command、scope、PASS/FAIL、最小錯誤證據與 verification confidence；acceptance matrix 逐項記錄 `Completed`、`Blocked` 或 `Not applicable`。

## Checkpoint D：風險、回滾與交付

### 風險控制

- **契約不符**：停止實作／驗收，不自行補 endpoint 或欄位。
- **client/server 狀態分歧**：成功後 invalidation，重新以 server 狀態渲染；不可用 local state 作權威。
- **誤把 UX 當安全邊界**：必須用真實 `POST /courses` 的 server 403 驗證。
- **誤觸發 credential revoke**：將 permission update 與 disable／credential 流程分開驗證。
- **既有資料回歸**：toggle 前後比對 Course、題目、歷史結果與 CLI credential。
- **測試假綠**：任何只能靠 fake endpoint／placeholder 才能通過的結果，不得標完成。

### 回滾觸發條件與步驟

若 path／method／response／error 與契約不符、query 未刷新、server 未更新、真實 e2e 無法穩定取得 403、既有資料或 CLI credential 受影響，則：

1. 將 F16 維持／恢復為 `Blocked`，停止交付。
2. 回滾 F16 新增的 switch、`useUpdateAccountPermissions`、API client、型別與 query-key 變更；若未新增 route，保留 F8 原 route。
3. 不以 mock、placeholder 或 local-only 行為降級。
4. 保留既有帳號建立流程，不擴大回滾至 disable／restore 或 credential 管理。
5. 契約補齊後重新通過 Checkpoint A，才可重做 B～C。

### 交付證據

交付時須附：完整契約輸入確認、靜態 gate 結果、目標元件／整合測試結果、真實 backend Playwright 結果，以及逐項完成的驗收矩陣；任何未滿足項目必須明確標記 `Blocked`，不可宣稱 F16 完成。

## 實作關鍵檔案

- `app/(admin)/admin/accounts/[accountId]/page.tsx`（若 F8 確認的 route 相同）：整合 accessible switch。
- `features/admin/`：帳號權限 mutation 與 `useUpdateAccountPermissions`。
- `lib/api/client.ts`：正式權限更新請求與 envelope/error 解析。
- `lib/api/types.ts`：契約確認後的型別。
- `lib/api/query-keys.ts`：帳號查詢 key 與 invalidation。
- 對應的頁面、Vitest／Testing Library／Playwright 測試檔：只列入已存在或由實作建立的 F16 測試，不在本計畫猜測檔名。

## 未決事項與停止規則

本計畫目前不需要向需求提出額外選擇；因原規格已明確要求「契約未完成即阻擋」。但開始 Checkpoint B 前，必須把「契約輸入」全部填入本計畫。以下任一項未確認，都應停止而非自行決策：API path／method／body／response／error、角色與帳號範圍、F8 route、query key、switch 文案與 accessibility copy、測試 fixture、F0 真實建課流程、以及 permission 與 disable／credential revoke 的可觀測區隔。
