---
title: 智學互動平台 - MVP 效能目標
type: project
status: active
created: 2026-08-13
updated: 2026-08-13
tags:
  - project
  - MVP
  - 效能
  - NFR
  - 智學互動平台
project: 智學互動平台
---

# 智學互動平台 - MVP 效能目標

> [!important] P0-07 驗收基線
> 本檔將 [[智學互動平台]] 原本「約 300 人同時上線」的容量描述轉為可重現、可量測、具 pass/fail 的 MVP 非功能需求。效能基準是**單一 LiveSession 內 300 位學員加 1 位老師**。

## 目的與邊界

本文件定義：

- 標準負載模型。
- Join、submit、broadcast、reconnect 與競態 workload。
- 延遲、錯誤率及資料正確性門檻。
- 測試報告最小內容。

本文件不指定壓測工具、硬體、雲端服務、WebSocket library、資料庫連線池、cache、pub/sub、部署拓撲或監控產品；上述內容留到 M2，並記錄在 [[技術棧]] 或系統設計文件。

> [!note] 驗收勾選語意
> 本檔 `[x]` 代表效能需求與門檻已確認,不代表系統已完成壓測或達標。實際結果須由 M4 測試報告證明。

## 名詞與量測邊界

| 指標 | 起點 | 終點 | 不包含 |
|---|---|---|---|
| Join API latency | Server 收到完整 join request | Server 回傳成功／失敗 response | Browser DNS、頁面載入及人工輸入時間 |
| Submit API latency | Server 收到完整 Submission request | Server 回傳權威提交結果 | 結果廣播與圖表 render |
| Commit-to-broadcast latency | Submission 成功 commit | 學員／老師 client 收到包含該答案的新結果事件 | Browser 圖表 render |
| Reconnect recovery | Client 開始重新連線 | Client 取得權威 LiveSession、目前題目、已答狀態與可見彙總 | 使用者手動刷新時間 |
| Client render latency | Client 收到結果事件 | 統計數字與圖表完成更新 | Server 與網路傳輸 |

所有報告至少列出 p50、p95、p99 與最大值；本基線以明列的 p95/p99 作為 pass/fail。

## 標準測試環境前提

- 單一 LiveSession。
- 1 位老師與 300 位匿名學員。
- Course 已建立足夠的 poll、open text、quiz SessionQuestion。
- 每位學員具有不同的場次限定 participant token。
- Client 使用支援的正式 browser/profile；具體矩陣由 M2 定案。
- 使用接近正式部署的 build、設定、資料庫與即時通訊路徑，不以 mock server 代替端到端量測。
- 測試前記錄硬體、OS、版本、網路條件、部署拓撲及資料庫初始資料量。

## Workload profile

### W1：集中加入

- 300 位學員於 120 秒內加入同一個 `waiting` 或 `active` LiveSession。
- 每位學員使用有效 session code 與顯示名。
- 應同時量測成功率、Join API latency、participant 建立重複數與老師端加入人數準確性。

### W2：集中提交

- LiveSession active 且一題 SessionQuestion open。
- 300 位學員於 10 秒內各提交一次有效答案。
- 應分別對 poll、open text、quiz 執行。
- 量測 Submit API latency、commit-to-broadcast latency、功能錯誤率、有效 Submission 數與彙總一致性。

### W3：結果廣播

- W2 期間老師端與全部已加入學員維持即時連線。
- 已作答學員依 vote-to-reveal 接收即時結果；未作答者在題目 open 時不得取得受限制彙總。
- 題目 closed 後，全班接收最終結果。
- 量測 p95/p99 廣播延遲、漏送情況及最終權威查詢一致性。

### W4：重連

- 300 人在線期間，30 位學員於 10 秒內同時斷線並使用原 participant token 重連。
- 重連後必須恢復 LiveSession 狀態、目前題目、本人已答狀態與有權查看的彙總。
- 不得建立第二個 participant 或第二筆 Submission。

### W5：持續運作

- 300 位學員與 1 位老師持續連線 30 分鐘。
- 至少完成 10 題逐題 open、集中提交、closed 及切換下一題。
- 期間執行少量自然斷線／重連及重複 request。
- 觀察錯誤率、資源趨勢、連線穩定與結果一致性。

### W6：Submit／close 競態

- 在集中提交窗口內讓老師 closed 當前題目。
- 同時涵蓋 Submission 先 commit、close 先 commit、client timeout 後重送等情境。
- 依 [[P0 核心需求基線#Submit／close 競態]] 驗證伺服器提交順序與 closed 後零新答案。

### W7：Idempotent retry

- 對成功但 client 未收到 response 的 Submission，以相同 idempotency key 重送。
- 另以相同 participant、同一 SessionQuestion、不同答案發送新 request。
- 前者必須回傳第一次結果且不重複建立；後者必須回傳衝突且不覆寫。

### W8：8 小時自動 closed

- 可透過測試環境可控時間驗證，不要求實際等待 8 小時。
- 場次達 hard limit 時，系統自動 closed 當前題目與 LiveSession，code 失效，後續加入、重連與 Submission 全部拒絕。
- 自動 closed 後啟動與手動 closed 相同的歸檔流程。

## MVP pass/fail 門檻

| 指標 | 門檻 | 適用 workload |
|---|---:|---|
| 300 人加入完成時間 | ≤ 120 秒 | W1 |
| Join API p95 | ≤ 1 秒 | W1 |
| 300 人集中提交窗口 | ≤ 10 秒 | W2 |
| Submit API p95 | ≤ 500 毫秒 | W2、W6、W7 |
| Commit-to-broadcast p95 | ≤ 2 秒 | W2、W3 |
| Commit-to-broadcast p99 | ≤ 5 秒 | W2、W3 |
| Reconnect recovery p95 | ≤ 3 秒 | W4 |
| 功能 request 錯誤率 | < 1% | W1～W5；排除測試刻意產生的預期衝突／拒絕 |
| 已確認成功但查不到的 Submission | 0 | W2、W5～W7 |
| 同一 participant／SessionQuestion 多筆有效 Submission | 0 | W2、W4、W6、W7 |
| 相同 idempotency key 造成重複資料 | 0 | W7 |
| 彙總與有效 Submission 不一致 | 0 | W2、W3、W5、W6 |
| 題目 closed commit 後新接受的答案 | 0 | W6 |
| 場次 closed/cancelled/逾 8 小時後成功加入或重連 | 0 | W8 |

> [!warning] 錯誤率不能掩蓋資料錯誤
> 即使總錯誤率低於 1%，只要發生成功資料遺失、重複有效答案、權威彙總不一致或 closed 後接受答案，該次測試仍判定失敗。

## 結果正確性核對

每次 workload 完成後，以伺服器權威查詢核對：

- Participant 數量。
- 每題有效 Submission 數。
- 每位 participant 每題最多一筆有效答案。
- Poll／quiz 各 option 計數。
- Quiz 正確／錯誤總數。
- Open text 匿名答案數。
- 老師端已投／加入人數。
- LiveSession 與 SessionQuestion 最終狀態。
- Broadcast 最終內容與權威彙總一致。

即時事件漏送可以透過重連權威查詢恢復，但仍須記錄；不能把過期 client state 當作成功結果。

## 超過容量時的 MVP 行為

- 300 learners＋1 teacher 是保證驗收基準，不代表第 301 位必須被固定拒絕。
- 若系統因容量或 rate limit 拒絕請求，必須回傳穩定錯誤與可重試資訊，不得無限等待或誤報成功。
- 系統不得為維持表面延遲而接受後遺失 Submission、重複計票或顯示錯誤彙總。
- 超過 300 人的擴展目標、降級策略與資源配置留待 M2 容量規劃。

## 測試報告模板

### 基本資料

| 欄位 | 內容 |
|---|---|
| 測試日期 |  |
| Build／commit |  |
| 測試環境 |  |
| 部署拓撲 |  |
| App／DB／即時元件版本 |  |
| CPU／RAM／網路 |  |
| 初始 Course／LiveSession／歷史資料量 |  |
| 測試工具與版本 |  |

### 結果

| Workload | 人數／速率 | p50 | p95 | p99 | 最大值 | 錯誤率 | 重複 | 遺失 | 結論 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| W1 Join |  |  |  |  |  |  |  |  |  |
| W2 Submit |  |  |  |  |  |  |  |  |  |
| W3 Broadcast |  |  |  |  |  |  |  |  |  |
| W4 Reconnect |  |  |  |  |  |  |  |  |  |
| W5 Sustain |  |  |  |  |  |  |  |  |  |
| W6 Race |  |  |  |  |  |  |  |  |  |
| W7 Retry |  |  |  |  |  |  |  |  |  |
| W8 Auto-close |  |  |  |  |  |  |  |  |  |

### 必填分析

- 未達門檻項目及可重現步驟。
- 所有非預期錯誤 code 與數量。
- Broadcast 漏送與重連恢復情況。
- 資料一致性核對結果。
- 測試期間 CPU、RAM、DB connection、event loop／queue 等主要趨勢。
- 是否符合全部硬性正確性門檻。
- 最終 `PASS`／`FAIL`，不得只以平均值判定。

## P0-07 驗收條件

- [x] P0-07-AC-01 容量目標明確定義為單一 LiveSession 300 位學員＋1 位老師，而非模糊的全平台在線人數。
- [x] P0-07-AC-02 負載測試涵蓋 120 秒集中加入、10 秒集中提交、結果廣播、重連、30 分鐘持續運作、競態及 idempotent retry。
- [x] P0-07-AC-03 Join p95、submit p95、broadcast p95/p99 與 reconnect p95 均有明確 pass/fail 門檻。
- [x] P0-07-AC-04 功能錯誤率低於 1%，且成功資料遺失、重複有效答案、彙總不一致與 closed 後接受答案均必須為零。
- [x] P0-07-AC-05 報告分開量測 API、commit-to-broadcast、reconnect 與 client render，不以單一平均值取代尾端延遲。
- [x] P0-07-AC-06 測試使用接近正式環境的完整路徑並記錄 build、拓撲、資源、版本、資料量與工具。
- [x] P0-07-AC-07 8 小時自動 closed 可用可控時間驗證，且結果與手動 closed 相同。

## M2 設計輸入

- 正式部署拓撲與容量預算。
- 即時通訊技術、連線管理、broadcast、backpressure 與重連設計。
- 資料庫連線池、索引、聚合與 transaction 設計。
- 是否需要 cache、pub/sub 或多 instance 協調。
- Rate limit、timeout、retry 與超載降級。
- Metrics、log、trace、dashboard 與 alert。
- 壓測工具、資料生成、client 模擬與 CI／pre-release 執行方式。

## 相關連結

- P0 核心需求：[[P0 核心需求基線]]
- 題目領域：[[題目領域契約]]
- 結果治理：[[結果資料治理]]
- 原始需求：[[需求蒐集]]
- 技術選型：[[技術棧]]
