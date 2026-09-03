---
title: 智學互動平台 - Prototype 實作結果
type: output
status: active
created: 2026-08-14
updated: 2026-08-14
tags:
  - project
  - prototype
  - frontend
  - 測試
  - 智學互動平台
project: 智學互動平台
---

# 智學互動平台 - Prototype 實作結果

> [!success] 實作結果
> 已完成一份可直接開啟的 standalone HTML，整合學員端與老師端的主要互動流程、狀態轉移、拒絕邊界與 fixture 情境。此檔是規格的互動展示層，不是正式 API、WebSocket 或 PostgreSQL 實作。

## 交付檔案

- [[prototype/智學互動平台-prototype.html|智學互動平台 standalone prototype]]
- 需求依據：[[功能需求規格 SPEC]]
- 資料模型依據：[[PostgreSQL 資料庫綱要設計]]

唯一 HTML source 位於 `50_實作與測試/prototype/`，CSS、JavaScript、fixture、圖表與 favicon 均 inline，沒有另外維護第二份 HTML、外部 CSS、外部 JavaScript 或圖片資產。

## 視覺與版面方向

Prototype 採「回聲標記」方向，將課堂逐題開放與回應逐步亮起轉成介面語彙：

- 頁首固定顯示 `COURSE → ROOM → QUESTION → RESPONSE → REVEAL` 狀態尺。
- 桌面版使用 context rail、中央操作 stage、右側 signal ledger；手機版改為上下流程。
- 提供紙張模式與投影模式；狀態同時使用文字、圖示與形狀，不依賴顏色單獨傳達語意。
- Poll／Quiz 長條圖採直接數字標籤、表格替代檢視與 hover/focus tooltip。
- 使用本機字型 fallback，不依賴遠端 font CDN。

## 學員端功能

- 以 session code + 顯示名稱匿名加入，不建立平台帳號。
- Session code：8 碼、輸入不分大小寫、排除 `I/O/1/0` 混淆字元；closed/cancelled code 拒絕加入。
- 顯示名稱：trim 後 1–40 個安全 Unicode 字元；拒絕空白、超長、換行、控制字元與方向控制字元；同場允許重複名稱。
- 顯示場次限定的 opaque participant token fixture，不顯示真實秘密。
- 涵蓋 `waiting`、`active`、`closed`、`cancelled` 狀態；waiting 可加入但不可作答。
- 涵蓋 `poll`、`quiz`、`open_text` 三種題型。
- 僅在 LiveSession `active` 且 SessionQuestion `open` 時可提交。
- 提交後答案鎖定；同一 idempotency key 可安全重送，不同答案重送顯示衝突；多分頁只允許一筆有效答案。
- 題目 open 期間採 vote-to-reveal；提交前隱藏受限彙總，提交後顯示結果；close 後自動對全班公布。
- Poll 使用長條圖；Quiz 使用長條圖並標示正確答案；Open text 目前使用匿名文字列表。
- 可模擬斷線、以原 token fixture 重連、恢復最新場次狀態；終止後重連拒絕。

## 老師端功能

### Course 與題庫

- Course 使用 `draft`／`archived`，不將 Course 誤標成 `active`／`closed`。
- 以 `can_create_course` fixture 展示授權與拒絕；建立者自動成為唯一 owner。
- draft Course 可新增題目、建立場次；有 waiting/active 場次時封存被拒。
- archived Course 只讀；新增、修改、刪除題目與建立新場次均被拒絕；歷史仍可查詢。
- 題庫以 `QuestionDefinition + QuestionOption` 呈現，不創造獨立 `question_bank` entity。
- 題型欄位契約：
  - `poll`：`selection_mode` + 2–10 個 options；禁止正確答案欄位。
  - `open_text`：只有題幹；禁止 `selection_mode`、options、correct refs。
  - `quiz`：2–10 個 options + 至少一個正解；由正解數量推導單選／複選。
- 驗證題幹／選項長度、選項數量、正解存在性與 Unicode 正規化後的選項重複。

### 批次建題

- 一次回報所有可辨識的 error／warning。
- 任一 blocking error 都不建立部分題目，符合 all-or-nothing。
- Preview 顯示 Course 名稱、Course ID、題目順序、題幹、題型、正確答案與 warning。
- 必須明確 Confirm 才建立；payload 修改後舊 preview 失效，需重新 validation／preview。
- 題目依 preview 順序附加到 Course 末端。

### LiveSession 與課堂控制

- 建立場次時選擇題目子集合與順序。
- `waiting → active` 時建立不可變 SessionQuestion snapshot；來源 QuestionDefinition 後續修改不影響現場快照。
- SessionQuestion 使用 `not_open → open → closed`。
- 同一場最多一題 open；closed 題目不可重開；active 後不能新增題目。
- 同一 Course 同時最多一個 waiting/active LiveSession。
- waiting 且無 Submission 可取消；active 場次只能 close。
- 顯示 session code、題目序列、joined count、voted count 與匿名 aggregate。
- 老師端使用 aggregate-only projection，不渲染學員姓名、token 或個別答案。
- 提供手動 close、模擬 +8 小時 auto-close、歷史結果與 retention/tombstone metadata。

## Fixture 情境

右側 Fixture Shelf 可快速載入 17 個展示狀態：

| 情境 ID | 用途 |
|---|---|
| `student-join` | 學員加入入口 |
| `waiting-room` | waiting 可加入但不可作答 |
| `active-poll` | Poll 作答與 vote-to-reveal |
| `active-quiz` | Quiz 複選與正解標記 |
| `active-open-text` | Open text 文字列表 |
| `closed-results` | close 後結果公布與歷史查詢 |
| `cancelled-empty` | 無答案 waiting 場次取消 |
| `archive-blocked` | 進行中場次阻擋 Course 封存 |
| `archived-readonly` | archived Course 只讀 |
| `batch-invalid` | 多個 validation error 與 all-or-nothing |
| `batch-valid-preview` | 批次 validation、Preview、Confirm |
| `snapshot-edited-source` | 來源題目修改不影響 snapshot |
| `second-question-open` | 同時開兩題被拒 |
| `submission-duplicate` | idempotency retry 與答案衝突 |
| `race-submit-first` | Submission 先 commit 的結果 |
| `race-close-first` | close 先 commit 的結果 |
| `auto-closed` | +8 小時 terminal state |

## 資料模型對照

| PostgreSQL entity | Prototype 對應 | 展示重點 |
|---|---|---|
| `course` | Course fixture | `draft`／`archived`、owner、封存 guard |
| `question_definition` + `question_option` | 題庫 | 題型欄位、順序、重用 |
| `live_session` | 課堂場次 | code、`waiting`／`active`／終止狀態 |
| `session_question` + `session_question_option` | 課堂題目 snapshot | 不可變內容、逐題狀態、一題 open |
| `participant` | 匿名學員 | 場次限定 token fixture、重連 |
| `submission` | 答案 fixture | immutable、idempotency、唯一性與衝突 |
| `archived_result` | 歷史結果 | close time、retention、tombstone metadata |

Prototype 沒有新增獨立的 question bank 或 activity entity；題庫語意由 `Course + QuestionDefinition` 表達，活動語意由 `LiveSession + SessionQuestion` 表達。

## 驗證紀錄

| 驗證項目 | 執行方式 | 結果 |
|---|---|---|
| JavaScript syntax | Node `new Function()` 解析 inline script | 通過，`JavaScript syntax: OK` |
| Standalone dependency | 掃描 `<script src>`、外部 stylesheet、remote URL | 通過，均為 0；favicon 為 inline data URI |
| HTTP 載入 | `py -m http.server 8765 --directory 50_實作與測試/prototype` | 回應 `200 text/html` |
| Chrome runtime | Headless Chrome + CDP 載入並檢查 `Runtime.exceptionThrown`／console | 未發現 JavaScript exception 或非預期 runtime error |
| 學員提交 | `active-poll` → 選答案 → submit | Submission count = 1，答案鎖定 |
| Idempotency | same-key retry → different-answer retry | 同 key 不新增資料；不同答案衝突且原答案保留 |
| 重連 | disconnect → reconnect | 恢復最新 fixture 狀態 |
| 批次驗證 | `batch-invalid` → validation | 同時出現 `TEXT_TOO_LONG`、`OPTION_DUPLICATE`、`FIELD_FORBIDDEN`、`CORRECT_OPTION_INVALID` |
| 批次 Preview | `batch-valid-preview` → Preview → Confirm | 通過，依 preview 順序建立題目 |
| 課堂控制 | 嘗試第二題 open → close → 嘗試 reopen | 一題 open guard、close 自動公布、closed 重開拒絕均通過 |
| 終止狀態 | `auto-closed` fixture | 顯示 +8 小時 terminal state，後續操作受限 |
| Responsive | Chrome 390px mobile emulation | `body.scrollWidth = 390`，無水平溢位 |
| Data visualization palette | `validate_palette.js`，light／dark | 兩組 palette 全部 checks pass |

## 尚未定案與後續工作

以下項目刻意沒有在 prototype 中冒充正式設計：

- Web API endpoint、正式 wire schema、版本相容策略。
- Socket.IO／WebSocket event、replay、backpressure 與多 instance 行為。
- Web Session、密碼、CLI credential 與完整系統管理員畫面。
- Participant token 的正式格式、保存方式與重連 protocol。
- Submission idempotency、transaction isolation 與 PostgreSQL row lock 的正式實作。
- LiveSession 8 小時 auto-close scheduler 的正式機制。
- Open text 採文字列表、文字雲或切換的產品決策；目前只做列表 prototype assumption。
- 300 位學員的 W1–W8 負載、壓測、廣播延遲與資料正確性測試；本次只有 UI/fixture 手動驗證。
- 真實 ArchivedResult retention job、刪除流程與 deletion event 操作畫面。

> [!warning] 使用邊界
> `window.__智學互動Prototype`、fixture reducer 與本地情境資料只服務 prototype 展示與測試，不可直接視為正式 domain API 或 production persistence。

## 結果

Prototype 已可作為 M2/M3 討論用的視覺基線：產品可直接從學員加入、老師建題、建立場次、逐題控制、答案提交與結果公布等流程檢查需求理解；工程實作時仍應以 [[功能需求規格 SPEC]] 與 [[PostgreSQL 資料庫綱要設計]] 為權威來源，不能以本 HTML 取代正式 API、transaction 或負載測試。
