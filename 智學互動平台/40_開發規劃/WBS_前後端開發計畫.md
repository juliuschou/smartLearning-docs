# 前後端開發 WBS 與先後順序 — 智學互動平台

> 依據：`../20_系統分析/`（M01–M11 需求與驗收規格）、`../30_系統設計/ER模型設計.md`（含 `er_model_postgresql.sql`）、`../80_系統雛形/`（M01–M11 互動雛形，作為 UI 行為基準）。
> 詞彙依 `../20_系統分析/GLOSSARY.md`。資料庫：PostgreSQL。

## 0. 技術基調（定案）

- **技術棧**：Next.js（前端）＋ NestJS（後端）＋ PostgreSQL（資料庫），TypeScript 全棧。
- **後端**：NestJS（REST + Socket.IO/WS 即時通道）；PostgreSQL（`er_model_postgresql.sql`）；Redis 可選（心跳 / Game PIN 世代 / 控制租約），先以 PG partial unique index 起步即可。NestJS 同時服務 OpenAPI（`@nestjs/swagger`）供前端產生 client。
- **前端**：Next.js（App Router），分離兩個 App，共用 API client 套件（由 NestJS OpenAPI 產生，openapi-typescript + SWR/TanStack Query）：
  - 管理端（`index.html` 對應）：系統管理者 + 老師（M01–M07、M09、M10）
  - 學員端（`learner.html` 對應）：無帳號匿名參與者（M08）＋ 投影畫面（projection，唯讀訂閱）
- **即時通道**：NestJS Gateway（Socket.IO）＋ Next.js 前端 socket-client 封裝。學員端心跳/作答開放/公布 → WS 推送；老師控制台 → WS 訂閱人數三指標與反應；「按 L 失聯→安全待機」為前端斷線行為，非後端功能。
- **安全邊界**：所有授權在後端 NestJS Guard 驗 `login_session.permission_snapshot` 與有效權限；前端（含 Next.js server components）選單過濾僅為 UX（雛形已註明）。Next.js 學員端匿名憑證以 httpOnly cookie 管理，不落 localStorage。
- **部署形態**：管理端/學員端各一個 Next.js App（monorepo：pnpm workspace，`apps/admin`、`apps/learner`、`apps/api`、`packages/api-client`、`packages/db`）。

## 1. 里程碑總覽（先後順序）

| 里程碑 | 內容 | 依賴 | 對應模組 |
|---|---|---|---|
| MS0 | 環境、DB schema、CI、API 骨架、共用契約 | 無 | — |
| MS1 | 帳號/角色/權限基礎（含一次性連結） | MS0 | M01/M02/M04、M03（老師維護） |
| MS2 | 題庫管理 | MS1 | M05 |
| MS3 | 教學活動管理（含題目快照、加入資訊） | MS2 | M06 |
| MS4 | 核心互動閉環：學員加入→作答→老師控制→統計公布（競賽版） | MS3 | M07/M08/M09、M11（TEAM 模式） |
| MS5 | 系統設定與監控、批次管理完善、匯出（P1）、組織競賽（P1） | MS4 | M03 批次、M10、P1 |
| MS6 | 整合驗收、滲透/授權檢核、部署 | MS5 | 全部 |

**關鍵排序原則**（依 ER 模型的後續交易鏈）：
先建 Party/Description 目錄（user_account → role → permission → role_permission → system_parameter），再建 Thing 來源（question_set/question），再建交易鏈（teaching_session → response → score → publish_log）。每一層可獨立驗收，前一層 API 即下一層的測試治具。

## 2. 後端 WBS

### MS0 共同基礎（1.0）
1.1 執行 `er_model_postgresql.sql` 建置 schema、驗證 `\d+` 欄位註解；migration 機制（expand-only 起步）
1.2 API 骨架：錯誤格式、一般化訊息（防帳號枚舉）、冪等鍵慣例、分頁/樂觀鎖（version）慣例
1.3 共用契約（NestJS `@nestjs/swagger` 產生 OpenAPI）：以 GLOSSARY 命名；前端由 OpenAPI 產生 `packages/api-client`
1.4 CI：lint + 單元測試 + psql 煙霧測試（全新 DB 一次通過）
5.X 每步驗證：目標測試 → 整合測試（ disposable container 建置，見測試規範）

### MS1 帳號與授權（2.0）
2.1 `one_time_link`：INVITATION / PASSWORD_RESET / EMAIL_VERIFICATION，30 分鐘／7 天有效、重發失效、60 秒寄送限制
2.2 M01：登入（一般化失敗訊息、不限次數）、登入 Session、權限快照（jsonb）、登出/逾時、忘記密碼
2.3 M02/M03：user_account CRUD（邀請制）、停用/啟用即撤銷 Session、第一個帳號建立指引實作
2.4 M02/M04：role / permission 目錄、role_permission 完整集合一次提交（全有全無＋冪等）、P1 權限停用不可指派、「權限變更須重新登入」與帳號停用即刻撤銷的差異測試
2.5 `system_parameter`（M10 前半）：活動預設值、Session 逾時，樂觀鎖批次更新
**驗收證據**：停用帳號登入被拒；權限異動後舊 Session 仍可用新功能被拒；快照欄位內容比對測試。

### MS2 題庫（3.0）
3.1 M05：question_set / question / question_option / tag CRUD、軟刪除→復原、複製（副本命名流水號）、題型規則驗證（選項數、正解數）
3.2 老師擁有權邊界測試（不得跨擁有者存取）
**驗收證據**：軟刪除後不出現在清單、可復原；複製不動原題。

### MS3 教學活動管理（4.0）
4.1 M06：teaching_session 建立（套用 system_parameter 預設、不回溯）、模式相容性驗證、status 機 NOT_STARTED→IN_PROGRESS→ENDED 不可逆
4.2 題目快照：組題→ `session_question` / `session_question_option` 拷貝；快照後來源編輯/軟刪不影響（快照不變規則測試）；快照寫入與活動建立包在 DB transaction 內
4.3 加入資訊：session_join_info Game PIN 世代（char(6)、partial unique）、QR/連結一組、輪替整組失效
4.4 M07 前半：活動狀態／題目狀態／三項公布狀態查詢 API、開始/結束、活動事件寫入 activity_event_log
**驗收證據**：修改題庫後既有活動快照不變（before/after 比對）；舊世代 PIN 失效。

### MS4 核心互動閉環（5.0，最關鍵）
5.1 M08 學員加入：無帳號流程、暱稱選填/系統分配、`participant_credential` 不可猜測憑證、重連、心跳（60 秒→在線判定）
5.2 即時通道：心跳彙整、開放作答/停止推送、公布推送（學員端僅答案分布、不含正確率）
5.3 M07 控制台後端：開放/停止作答、不得跳題返回、**控制租約**（partial unique `released_at IS NULL`）、活動鎖定事件
5.4 M08 作答提交：`response` 冪等（client_submission_id）、開放期間可更新提交、最後成功提交為準、遲到拒收
5.5 M09 統計：`question_eligibility_snapshot`（開放計分題時固定資格名單）、`answer_distribution` 重算與物化、三指標（在線/已加入/已作答）分開統計
5.6 M09 計分與排行榜：personal_score（答對100/其餘0）、競賽排名（1,1,3）vs 密集排名（1,1,2）、資格人數 0→「不適用」、`leaderboard_mode=NONE` 仍提供教師彙總
5.7 M11 整合（個人端可先行、TEAM 模式本段）：session_team、team_membership（同時至多一有效）、TEAM 分組確認即鎖定、`team_score_ledger` 冪等結算（(活動,題,隊)至多一筆、不部分加分）、隊伍排行榜
5.8 M07/M09 公布：四項公布單向寫入、不可撤回、更正版本鏈＋必填原因
**驗收證據**：併發雙控制租約僅一成立；同題雙結算僅一筆生效；公布後不可撤回（HTTP 語意無刪除路徑）；排名演算法表定測試。

### MS5 營運與 P1（6.0）
6.1 M03 批次管理：batch_operation 全有全無＋冪等（重送不重做）
6.2 M10：系統參數批次更新、營運監控、「未知」連線狀態語意
6.3 P1（預設關閉，feature flag）：export_job CSV/XLSX、organization 組織競賽
6.4 觀測性：結構化日誌（含 request id、不落憑證）、心跳/租約逾期清掃 job
**驗收證據**：批次中段失敗即整批回滾（冪等重送結果一致）。

### MS6 驗收與部署（7.0）
7.1 端到端驗收：照 M01–M11 驗收規格逐條跑，以雛形試用流程作 E2E 腳本藍本
7.2 安全檢核：授權矩陣測試（未列入預設拒絕）、憑證熵、PIN 暴力面、日誌洩漏掃描
7.3 部署：migration 展開計畫、rollback 說明、監控訊號

## 3. 前端 WBS

### F0 共同
F0.1 共用 API client（`packages/api-client`，由 NestJS OpenAPI 產生）＋ WS socket-client 封裝（Socket.IO，斷線→自動重試→「安全待機」）與 ORM/DB 套件（`packages/db`，Drizzle 或 TypeORM + `er_model_postgresql.sql` 為基準）
F0.2 週期/錯誤訊息元件（一般化訊息呈現）、版本鎖定對齊後端契約
F0.3 視覺基準：以 `80_系統雛形` 的 style.css 為初稿，僅重構不重設計

### F1 管理端 App（`apps/admin`，Next.js，對應 index.html）
F1.1 登入頁 + 權限過濾選單 shell（M01；UX 層過濾）
F1.2 M02/M03（帳號/老師維護）、M04（角色-功能對應批次表單，全有全無 UI）
F1.3 M05 題庫（軟刪除/復原/複製、逐題編輯表單——雛形未完整實作，實作段）
F1.4 M06 活動建立精靈（組題→快照→產生加入資訊、模式相容性提示）
F1.5 M07 控制台（人數三指標、開放/停止、公布動作、模式鎖定提示）＋ projection.html 投影
F1.6 M09 報表頁（排行榜切換競賽/密集、匯出）
F1.7 M10 系統設定（樂觀鎖批次表單）＋ M03 批次操作 UI

### F2 學員端 App（`apps/learner`，Next.js，對應 learner.html；行動裝置優先）
F2.1 加入流程：PIN/QR → 暱稱（選填）→ 等候畫面
F2.2 作答：開放期間內可更新提交、已公布僅見答案分布
F2.3 重連（憑證保存）、失聯→安全待機、公布推送顯示

### 前端先後依賴
F0 → F1.1/F2.1 平行 → F1.2–F1.4（等 MS1/Ms2 API）與 F2.2–F2.3（等 MS4 5.1–5.4）平行 → F1.5–F1.6/F1.7 收尾於 MS4/MS5。

## 4. 前後端開發對應表（含順序編號）

> 編號即建議實施順序：①先後端完成並交付 API，②前端接上後驗收該段；編號同段內可與其他編號平行。每列一個「垂直切片」：API 交付 → UI 接上 → 該段驗收完成。
> 規格編號對應 `../20_系統分析/Mxx` 各文件的「功能範圍」表（如 M01-01 使用者登入）；P1 之規格（M09-07 匯出、M11-12～15 組織競賽）預設延至順序 8。

| 順序 | 階段 | 後端任務（NestJS） | 前端任務（Next.js） | 對應模組與規格編號 | 工時預估（後端＋前端，人日） | 完成判準 |
|---|---|---|---|---|---|---|
| 1 | MS0 基礎 | 1.1–1.4：DB schema、API 骨架、OpenAPI、CI、monorepo 骨架 | F0.1–F0.3：api-client/WS 封裝、錯誤元件、視覺基準 | —（支撐 M0x-07/M04-07 之檢查基礎） | **5**（後端 3＋前端 2） | psql 煙霧測試通過；admin/learner 殼可啟動 |
| 2 | MS1 帳號授權 | 2.1–2.5：one_time_link、登入＋權限快照、帳號 CRUD、role/permission 目錄、system_parameter | F1.1 登入頁＋權限過濾 shell；F1.2 帳號/角色/對應 UI | **M01**（01 登入/02 登出/03 修改密碼/04 忘記密碼/05 個資/06 驗證/07 安全）、**M02**（01–04 角色目錄、05 指派）、**M03**（03 新增/04 編輯/06 啟用/07 停用/08 重設密碼/09 指派角色）、**M04**（01 功能清單/02 分類/03 查詢/04 授權/05 取消授權/06 批次儲存/07 存取檢查/09 選單過濾）、**M10-01**（system_parameter 基礎） | **15**（後端 9＋前端 6） | 停用帳號登入被拒；快照比對測試通過 |
| 3 | MS2 題庫 | 3.1–3.2：question_set/question/option/tag CRUD、軟刪除/復原/複製 | F1.3 題庫 UI（軟刪除/復原/複製、逐題編輯表單） | **M05**（01 建立題庫/02 維護題目/03 題型管理/04 複製/05 分類/06 查詢） | **10**（後端 5＋前端 5；逐題表單較重） | 軟刪除/復原、擁有權邊界測試通過 |
| 4 | MS3 教學活動 | 4.1–4.4：activity 建立＋模式相容性、題目快照（transaction）、PIN 世代、活動狀態 API | F1.4 活動建立精靈（組題→快照→加入資訊） | **M06**（01 建立/02 選題庫/03 加入資訊/04 活動設定/05 活動清單/06 結束/07 參與模式/08 排名計分設定/09 分組參數/10 模式異動檢查）、**M03-10**（老師活動查詢）、**M07-01**（開始活動——進入 IN_PROGRESS 段） | **12**（後端 7＋前端 5） | 快照不變規則、舊世代 PIN 失效測試通過 |
| 5 | MS4a 加入與作答 | 5.1–5.4：學員加入/憑證/心跳、即時通道、控制租約、作答冪等提交 | F2.1 加入流程、F2.2 作答、F2.3 重連/安全待機 | **M08**（01 加入/02 暱稱/03 等候/04 選擇題作答/07 接收結果/08 重新連線）、**M07**（02 選題/03 開放作答/04 停止作答/07 下一題禁止返回/08 查看人數/09 投影控制）、**M09-01/02/04**（即時人數/答案分布/投影） | **16**（後端 9＋前端 7；含 WS 通道與併發測試） | 冪等重送、遲到拒收、租約唯一性測試通過 |
| 6 | MS4b 統計與計分 | 5.5–5.6：資格快照、答案分布、personal_score、排行榜（競賽/密集） | F1.5 控制台（三指標/開放停止/公布）＋ projection；報表頁雛形 | **M09**（03 正確率/05 活動摘要/06 報表查詢/11 個人得分/12 個人排行榜/13 無排名摘要）、**M07**（05 公布統計/06 公布正解/12 排行榜控制/13 模式提示）、**M08-12**（接收個人結果） | **12**（後端 7＋前端 5） | 排名演算法表定測試、資格 0→「不適用」通過 |
| 7 | MS4c 團隊與公布 | 5.7–5.8：TEAM 模式、team_membership 鎖定、team_score_ledger 冪等結算、四項公布＋版本鏈 | F1.5 公布動作完整化、F1.6 報表頁完成（隊伍榜） | **M11**（01 是否分組/02 隊伍數/03 隨機分組/04 自訂隊名/05 分組結果/06 手動調整/07 鎖定/08 遲到處理/09 自動計分/10 隊伍榜/11 控制公布/16 不分組/17 分組異動限制/18 條件式 API/19 個人榜選項）、**M07-10/11**（隨機分組控制/隊伍調整確認）、**M08**（09 檢視隊伍/10 接收團隊結果）、**M09**（08 團隊得分/09 隊伍排行榜） | **14**（後端 8＋前端 6） | 雙結算僅一筆、公布不可撤回測試通過 |
| 8 | MS5 營運與 P1 | 6.1–6.4：batch_operation、系統參數/監控、P1（feature flag）、觀測性 | F1.7 系統設定＋批次操作 UI | **M10**（01 基本參數/02 活動監控）、**M03**（01 清單/11 資料刪除＋批次操作）、**M08**（05 意見投票/06 文字回饋，本段補齊）、**M09-07**（報表匯出，P1）、**M11**（12 組織設定/13 組織內分組/14 組織間榜/15 競賽摘要，P1） | **12**（後端 7＋前端 5；含 P1，可分批） | 中段失敗整批回滾、冪等重送一致 |
| 9 | MS6 驗收部署 | 7.1–7.3：E2E、安全檢核、部署/rollback | 全端驗收回歸（E2E 腳本） | 全部模組驗收規格（gherkin 逐條） | **8**（端到端共擔） | M01–M11 驗收規格逐條通過 |

**工時合計**：約 **104 人日**（後端 63＋前端 40＋驗收 8 四捨五入）。

**工時假設**：
- 人日：一名合格全端工程師的一個工作天。
1. **人日**：一名合格全端工程師的一個工作天；含該段單元測試與自驗，不含跨段整合驗收（歸順序 9）。
2. **前置**：以雛形 `80_系統雛形` 為 UI 藍本、`er_model_postgresql.sql` 已定稿為前提；若兩者重做，工時另計。
3. **風險加成**：順序 5/7（併發、冪等、公布不可撤回）已內含較高的測試比重；若團隊首次使用 NestJS Gateway/Socket.IO，順序 5 再加 2–3 人日緩衝。
4. **P1 彈性**：順序 8 的 P1 項（M09-07、M11-12～15）約占 5 人日，可整段後移不影響主線。
5. **規模估算非報價**：僅供排程與人力配置參考；建議順序 2 完成後依實際速度重估其餘段。

順序總覽：

```
① MS0 ──→ ② MS1 ──→ ③ MS2 ──→ ④ MS3 ──→ ⑤ MS4a ──→ ⑥ MS4b ──→ ⑦ MS4c ──→ ⑧ MS5 ──→ ⑨ MS6
   後端先行 → 前端隨後接上（同一編號內：API 交付 → UI 接上 → 該段驗收）
```

## 5. 排程原則備註

- **先後端先行**：每個 MS 完成即提供可測 API（NestJS + OpenAPI），前端該段隨後接上；契約變更為唯一可接受的「重大變更」級事件（OpenAPI diff 於 CI 檢查）。
- **Monorepo**：pnpm workspace ＋ Turborepo（`apps/api`、`apps/admin`、`apps/learner`、`packages/api-client`、`packages/db`），MS0 即建立骨架。
- **風險最高**：MS4（租約、快照、冪等結算、公布不可撤回）——建議安排雙人以上檢視與併發壓力測試（timing-sensitive 案一律單一測試驅動，見測試環境規範）。
- **驗收基準**：以 20_系統分析各模組驗收規格 + 80_系統雛形已反映規則清單為逐條清單；雛形可作為對照用示範腳本。