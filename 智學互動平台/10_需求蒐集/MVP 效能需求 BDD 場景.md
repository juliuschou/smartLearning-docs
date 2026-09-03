---
title: 智學互動平台 - MVP 效能需求 BDD 場景
type: research
status: draft
created: 2026-08-14
updated: 2026-08-14
tags:
  - project
  - 需求基線
  - BDD
  - 效能
  - 智學互動平台
project: 智學互動平台
---

# 智學互動平台 - MVP 效能需求 BDD 場景

> [!info] 目的
> 將 [[MVP 效能目標]] 的非功能門檻轉成可執行的 BDD 場景（Given-When-Then），對齊 [[P0 核心需求基線]] 的 ubiquitous language。門檻數值以 [[MVP 效能目標]] 為唯一來源；本檔不重新定義數值語意，只在場景中引用。

> [!note] 驗收勾選語意
> 本檔 `[ ]` 代表 BDD 場景已起草並由 [[MVP 效能目標]] 門檻推導而來，待 M2 系統設計與 M4 壓測報告驗證後才標記 `[x]`。場景的 pass/fail 仍以 [[MVP 效能目標#MVP passfail 門檻]] 為準。

## BDD 階層

```text
Business Capability: 即時互動容量與正確性 (P0-07)
  +-- Feature: 單場 300 人即時互動不丟資料
      +-- User Story (對應 W1～W8 與超量行為)
          +-- Rules (門檻與正確性)
              +-- Scenarios (Gherkin)
```

## Domain language（沿用）

本檔名詞定義沿用 [[P0 核心需求基線#Domain glossary]]：Course、LiveSession、QuestionDefinition、SessionQuestion、Participant、Submission、ArchivedResult、session code。Gherkin 一律使用此 ubiquitous language，確保業務、開發、測試零翻譯損失。

## US-P1 學員集中加入場次（W1）

> 身為學員，我想在老師開場前後快速加入場次，即使 300 人同時加入也不會長時間等待或被錯誤拒絕，以便順利參與即時互動。

### Rules

- R-P1-1　300 位學員於 120 秒內完成加入。
- R-P1-2　Join API p95 ≤ 1 秒。
- R-P1-3　每位學員只建立一個場次限定 Participant，不產生重複 participant。
- R-P1-4　老師端即時加入人數與伺服器權威 participant 數一致。

### Scenarios

```gherkin
# happy path
Scenario: 300 位學員在 120 秒內集中加入同一場次
  假定 一個 waiting 的 LiveSession 已建立且 session code 有效
  而且 老師端已連線並顯示即時加入人數
  當 300 位學員於 120 秒內各以有效 session code 與顯示名加入
  那麼 全部學員加入完成時間 ≤ 120 秒
  而且 Join API p95 延遲 ≤ 1 秒
  而且每位學員取得一個場次限定 participant token 且不產生重複 participant
  而且老師端即時加入人數與伺服器權威 participant 數一致

# error path（預期拒絕，不計入錯誤率）
Scenario: 以失效 session code 加入被穩定拒絕
  假定 一個 LiveSession 已 closed 且其 session code 已失效
  當 學員以該失效 code 嘗試加入
  那麼 系統回傳穩定錯誤與可重試資訊
  而且不建立任何 participant
  而且此預期拒絕排除在功能錯誤率之外，不影響有效加入的正確性
```

## US-P2 學員集中提交答案並即時收到結果（W2、W3）

> 身為學員，我想在題目開放時即時提交答案，即使全班同時提交也能快速收到權威提交結果，且答案不遺失、不重複，並在作答後看到即時彙總。

### Rules

- R-P2-1　300 位學員於 10 秒內各提交一次有效答案（poll、open text、quiz 分別驗證）。
- R-P2-2　Submit API p95 ≤ 500 毫秒（亦適用 W6、W7）。
- R-P2-3　Commit-to-broadcast p95 ≤ 2 秒、p99 ≤ 5 秒。
- R-P2-4　已確認成功但查不到的 Submission = 0。
- R-P2-5　同一 participant／SessionQuestion 多筆有效 Submission = 0。
- R-P2-6　權威彙總與有效 Submission 不一致 = 0。
- R-P2-7　已作答學員依 vote-to-reveal 收到即時結果；未作答者於題目 open 時不得取得受限制彙總；關題後全班收到最終結果。

### Scenarios

```gherkin
# happy path — poll
Scenario: 全班在 10 秒內集中提交 poll 答案並即時收到彙總
  假定 一個 active LiveSession 且一個 poll SessionQuestion 處於 open
  而且 300 位學員已加入並維持即時連線
  當 300 位學員於 10 秒內各提交一次有效 poll 答案
  那麼 Submit API p95 ≤ 500 毫秒
  而且 commit-to-broadcast p95 ≤ 2 秒且 p99 ≤ 5 秒
  而且每位 participant 該題只有一筆有效 Submission
  而且權威彙總各 option 計數與有效 Submission 完全一致
  而且沒有已確認成功卻查不到的 Submission

# happy path — quiz（正確／錯誤總數）
Scenario: 全班在 10 秒內集中提交 quiz 答案且正確錯誤計數一致
  假定 一個 active LiveSession 且一個 quiz SessionQuestion 處於 open
  當 300 位學員於 10 秒內各提交一次有效 quiz 答案
  那麼 Submit API p95 ≤ 500 毫秒
  而且權威 quiz 正確／錯誤總數與有效 Submission 一致
  而且沒有成功資料遺失或重複有效答案

# happy path — open text（匿名答案數）
Scenario: 全班在 10 秒內集中提交 open text 答案
  假定 一個 active LiveSession 且一個 open text SessionQuestion 處於 open
  當 300 位學員於 10 秒內各提交一次有效 open text 答案
  那麼 Submit API p95 ≤ 500 毫秒
  而且權威匿名答案數與有效 Submission 一致

# boundary — vote-to-reveal 限制
Scenario: 未作答學員在題目 open 時看不到受限制彙總
  假定 一個 poll SessionQuestion 處於 open 且採 vote-to-reveal
  而且 某學員尚未提交該題答案
  當 該學員維持連線期間其他學員陸續提交
  那麼 該未作答學員不得收到受限制的即時彙總
  而且關題後該學員與全班一同收到最終結果且與權威彙總一致

# error path — 題目未開放時提交被拒
Scenario: 學員對 not_open 題目提交被拒
  假定 一個 active LiveSession 且目標 SessionQuestion 處於 not_open
  當 學員以有效 participant token 提交答案
  那麼 系統拒絕該 Submission 且不建立有效答案
  而且此預期拒絕排除在功能錯誤率之外
```

## US-P3 學員斷線後快速重連恢復狀態（W4）

> 身為學員，我想在斷線後用原 participant token 快速重連，恢復場次狀態與作答進度，且不會被當成新參與者或產生重複答案。

### Rules

- R-P3-1　Reconnect recovery p95 ≤ 3 秒。
- R-P3-2　重連不建立第二個 participant，已答題目不建立第二筆有效 Submission。
- R-P3-3　重連後取得 LiveSession 最新狀態、目前題目、自己已答狀態與可見彙總。

### Scenarios

```gherkin
# happy path
Scenario: 30 位學員同時斷線後快速重連恢復狀態
  假定 一個 active LiveSession 有 300 位學員在線
  而且 一個 SessionQuestion 處於 open
  當 30 位學員於 10 秒內同時斷線並以原 participant token 重連
  那麼 reconnect recovery p95 ≤ 3 秒
  而且每位重連學員恢復 LiveSession 狀態、目前題目、自己已答狀態與可見彙總
  而且不建立第二個 participant
  而且已答題目不產生第二筆有效 Submission

# error path — 場次已終止
Scenario: 場次 closed 後重連被拒
  假定 一個 LiveSession 已 closed
  當 學員以原 participant token 嘗試重連
  那麼 系統拒絕重連並回傳穩定錯誤
  而且不恢復任何場次狀態
```

## US-P4 課堂長時間穩定運作（W5）

> 身為老師，我想在 30 分鐘的課堂中逐題開放、作答、關題並切換下一題，全程穩定連線且每題結果一致。

### Rules

- R-P4-1　300 位學員與 1 位老師持續連線 30 分鐘，至少完成 10 題逐題 open／集中提交／closed／切換。
- R-P4-2　功能 request 錯誤率 < 1%（排除預期衝突／拒絕）。
- R-P4-3　期間資源趨勢穩定、連線穩定、每題彙總與有效 Submission 一致、無成功資料遺失或重複有效答案。

### Scenarios

```gherkin
# happy path
Scenario: 300 人持續連線 30 分鐘逐題互動且結果一致
  假定 一個 active LiveSession 有 300 位學員與 1 位老師連線
  當 老師於 30 分鐘內逐題 open、集中提交、closed 並切換下一題，至少完成 10 題
  而且 期間發生少量自然斷線、重連與重複 request
  那麼 功能 request 錯誤率 < 1%
  而且資源使用趨勢穩定無異常洩漏
  而且每題彙總與有效 Submission 一致
  而且沒有成功資料遺失或重複有效答案
```

## US-P5 關題與提交競態下依伺服器權威順序判定（W6）

> 身為學員，我想在老師關題瞬間提交的答案能依伺服器權威順序正確判定，不因網路到達先後而錯誤接受或遺失。

### Rules

- R-P5-1　題目 closed commit 後新接受的答案 = 0。
- R-P5-2　以伺服器提交順序為唯一權威，不採 client device time 或 WebSocket 到達先後。
- R-P5-3　Submission 先 commit 後關題 → 答案保留；關題先 commit 後提交 → 答案拒絕。
- R-P5-4　Client 未收到回應時，以原 idempotency key 取回第一次權威結果。
- R-P5-5　WebSocket 顯示已關題但權威查詢顯示答案已先提交時，以權威查詢為準。

### Scenarios

```gherkin
# happy path — 提交先 commit
Scenario: 學員答案先 commit 後老師關題，答案保留並納入結果
  假定 一個 active LiveSession 且一個 SessionQuestion 處於 open
  當 學員 Submission 先成功 commit，隨後老師 close 該題
  那麼 該答案保留並納入彙總
  而且權威查詢確認該題有一筆有效 Submission

# boundary — 關題先 commit
Scenario: 老師關題先 commit 後學員提交，答案被拒
  假定 一個 active LiveSession 且一個 SessionQuestion 處於 open
  當 老師 close 先成功 commit，隨後學員提交答案
  那麼 該 Submission 被拒絕且不納入結果
  而且題目 closed commit 後新接受的答案為 0

# boundary — client timeout 重送
Scenario: Client 未收到回應後以原 idempotency key 取回第一次結果
  假定 學員已送出 Submission 但尚未取得回應
  當 學員以原 idempotency key 重送
  那麼 系統回傳第一次權威提交結果
  而且不建立第二筆 Submission

# boundary — WebSocket 與權威不一致
Scenario: WebSocket 顯示已關題但權威查詢顯示答案已先提交
  假定 學員 Submission 已在伺服器 commit
  而且 WebSocket 事件先顯示題目已 closed
  當 學員以權威查詢確認提交狀態
  那麼 以權威查詢結果為準，答案納入結果
  而且不因 WebSocket 到達先後判定為拒絕
```

## US-P6 網路不穩時安全重送不產生重複答案（W7）

> 身為學員，我想在網路不穩時安全重送提交，不會因重送而產生重複答案或覆寫第一次答案。

### Rules

- R-P6-1　相同 idempotency key 造成重複資料 = 0。
- R-P6-2　相同 idempotency key 重送回傳第一次結果，不新增第二筆 Submission。
- R-P6-3　同 participant、同 SessionQuestion、不同答案再次提交回傳衝突，不覆寫第一次答案。

### Scenarios

```gherkin
# happy path — 安全重送
Scenario: 相同 idempotency key 重送回傳第一次結果且不重複建立
  假定 學員已成功提交但 client 未收到 response
  當 學員以相同 idempotency key 重送
  那麼 系統回傳第一次提交結果
  而且不建立第二筆 Submission
  而且相同 idempotency key 造成重複資料為 0

# error path — 不同答案再次提交
Scenario: 同 participant 同題不同答案再次提交回傳衝突且不覆寫
  假定 學員已對某 SessionQuestion 成功提交第一次答案
  當 學員以不同答案再次提交該題
  那麼 系統回傳衝突錯誤
  而且第一次答案不被覆寫
  而且此預期衝突排除在功能錯誤率之外
```

## US-P7 場次逾 8 小時自動關閉（W8）

> 身為老師，我想在場次超過 8 小時上限時，系統自動關閉場次與當前題目，使 session code 失效並啟動與手動關閉相同的歸檔流程。

### Rules

- R-P7-1　場次達 8 小時 hard limit 時，自動 closed 當前 open 題目與 LiveSession。
- R-P7-2　session code 立即失效，後續加入、重連與 Submission 全部被拒。
- R-P7-3　自動 closed 後啟動與手動 closed 相同的歸檔流程。
- R-P7-4　可透過測試環境可控時間驗證，不要求實際等待 8 小時。

### Scenarios

```gherkin
# happy path
Scenario: 場次達 8 小時上限自動關閉並啟動歸檔
  假定 一個 active LiveSession 已達 8 小時 hard limit（以可控時間驗證）
  而且 一個 SessionQuestion 處於 open
  當 系統觸發自動 closed
  那麼 當前 open 題目與 LiveSession 均 closed
  而且session code 立即失效
  而且啟動與手動 closed 相同的歸檔流程

# error path — 自動 closed 後一切被拒
Scenario: 場次自動 closed 後加入、重連與提交全部被拒
  假定 一個 LiveSession 因逾 8 小時自動 closed
  當 學員嘗試加入、重連或提交 Submission
  那麼 全部被拒絕，成功加入或重連次數為 0
  而且此預期拒絕排除在功能錯誤率之外
```

## US-P8 超過容量時優雅拒絕不誤報成功

> 身為學員，我想在場次達容量或速率限制時，收到穩定錯誤與可重試資訊，而不是無限等待或誤報成功。

### Rules

- R-P8-1　300 learners ＋ 1 teacher 是保證基準，第 301 位不要求固定拒絕。
- R-P8-2　因容量或 rate limit 拒絕時，回傳穩定錯誤與可重試資訊，不無限等待、不誤報成功。
- R-P8-3　不得為維持表面延遲而遺失 Submission、重複計票或顯示錯誤彙總。

### Scenarios

```gherkin
# boundary — 超量
Scenario: 超過 300 人基準時請求被穩定拒絕並提供可重試資訊
  假定 一個 active LiveSession 已有 300 位學員
  當 第 301 位以後的學員嘗試加入或提交
  那麼 系統以穩定錯誤回傳並提供可重試資訊
  而且不無限等待也不誤報成功
  而且不為維持表面延遲而遺失 Submission、重複計票或顯示錯誤彙總
```

> [!warning] 第 301 位不要求固定拒絕
> 擴展目標、降級策略與資源配置留待 M2 容量規劃（見 [[技術棧]]），不在此定義硬性上限。

## US-P9 每次 workload 後以伺服器權威查詢核對正確性（橫跨 W2～W7）

> 身為測試者，我想在每個 workload 完成後以伺服器權威查詢核對資料正確性，確保即時事件漏送可由重連恢復，且資料錯誤不被低錯誤率掩蓋。

### Rules

- R-P9-1　核對 participant 數、每題有效 Submission 數、每位 participant 每題最多一筆有效答案、poll／quiz 各 option 計數、quiz 正確／錯誤總數、open text 匿名答案數、老師端已投／加入人數、LiveSession 與 SessionQuestion 最終狀態。
- R-P9-2　廣播最終內容與權威彙總一致。
- R-P9-3　即使錯誤率 < 1%，只要發生成功資料遺失、重複有效答案、權威彙總不一致或 closed 後接受答案，該次測試仍判定 FAIL。

### Scenarios

```gherkin
# 後置驗證
Scenario: workload 後伺服器權威查詢核對資料正確性
  假定 任一 workload（W1～W8）已執行完成
  當 以伺服器權威查詢核對 participant 數、有效 Submission 數、各 option 計數、quiz 正確錯誤總數、open text 匿名答案數、老師端人數與最終狀態
  那麼 每位 participant 每題最多一筆有效答案
  而且廣播最終內容與權威彙總一致
  而且即時事件漏送均被記錄且可由重連權威查詢恢復

# 關鍵失敗判定
Scenario: 低錯誤率但發生資料錯誤仍判定失敗
  假定 某 workload 功能錯誤率 < 1%
  但 發生成功資料遺失、重複有效答案、權威彙總不一致或 closed 後接受答案之一
  當 進行 pass／fail 判定
  那麼 該次測試判定 FAIL，不以平均值或低錯誤率掩蓋資料錯誤
```

## Red cards（待確認，阻擋開發前須解決）

| 紅卡 | 指派 | 期限 | 來源 |
|---|---|---|---|
| 超過 300 人的擴展目標、降級策略與資源配置？ | PO ＋ M2 設計 | M2 前 | [[MVP 效能目標#超過容量時的 MVP 行為]] |
| 支援的正式 browser／profile 矩陣？ | M2 | M2 定案 | [[MVP 效能目標#標準測試環境前提]] |
| 壓測工具、資料生成、client 模擬與 CI／pre-release 執行方式？ | M2 | M2 定案 | [[MVP 效能目標#M2 設計輸入]] |
| 即時通訊技術、連線管理、broadcast、backpressure 與重連設計？ | M2 | M2 定案 | [[MVP 效能目標#M2 設計輸入]] |
| Metrics、log、trace、dashboard 與 alert？ | M2 | M2 定案 | [[MVP 效能目標#M2 設計輸入]] |

> [!warning] 不得帶著紅卡進入開發
> 上述 M2 設計輸入未定案前，對應場景可起草但不得據以實作；實作採用前必須由 M2 設計文件補齊。

## 需求追蹤

| User Story | Workload | 對應門檻 | P0-07 AC | 現行規範 |
|---|---|---|---|---|
| US-P1 加入 | W1 | 加入完成 ≤120s、Join p95 ≤1s | P0-07-AC-02、AC-03 | [[MVP 效能目標]] |
| US-P2 提交與廣播 | W2、W3 | Submit p95 ≤500ms、broadcast p95 ≤2s／p99 ≤5s | P0-07-AC-02、AC-03、AC-04、AC-05 | [[MVP 效能目標]] |
| US-P3 重連 | W4 | reconnect p95 ≤3s | P0-07-AC-02、AC-03 | [[MVP 效能目標]] |
| US-P4 持續運作 | W5 | 錯誤率 <1%、資源穩定 | P0-07-AC-02、AC-04、AC-06 | [[MVP 效能目標]] |
| US-P5 競態 | W6 | closed 後新答案 =0、依伺服器順序 | P0-07-AC-04 | [[MVP 效能目標]]、[[P0 核心需求基線#Submitclose 競態]] |
| US-P6 重送 | W7 | idempotency 重複資料 =0 | P0-07-AC-04 | [[MVP 效能目標]]、[[P0 核心需求基線#Submission 與 idempotency]] |
| US-P7 自動關閉 | W8 | 逾 8 小時自動 closed | P0-07-AC-07 | [[MVP 效能目標]]、[[P0 核心需求基線#LiveSession 生命週期]] |
| US-P8 超量行為 | — | 穩定錯誤、不誤報成功 | P0-07-AC-04 | [[MVP 效能目標#超過容量時的 MVP 行為]] |
| US-P9 正確性核對 | W2～W7 | 各項一致性 =0 | P0-07-AC-04、AC-05 | [[MVP 效能目標#結果正確性核對]] |

## Three Amigos 視角對照

同一場景在不同視角下的解讀，確保零翻譯損失：

| 場景 | Problem Owner（PO／BA） | Problem Solver（Dev） | Skeptic（Tester／QA） |
|---|---|---|---|
| US-P2 集中提交 | 學員作答不被全班同時提交卡住 | Submit 路徑須承載 300 筆／10s 且廣播 backpressure 受控 | 驗證 p95／p99 尾端延遲與彙總一致性，不只看平均值 |
| US-P5 競態 | 老師關題時已提交的答案算數 | 須以伺服器 commit 順序為權威，非事件到達順序 | 涵蓋提交先、關題先、timeout 重送、WebSocket 與權威不一致 |
| US-P7 自動關閉 | 超時場次自動結束並歸檔 | 須可靠排程 8 小時上限且與手動 closed 同流程 | 以可控時間驗證，closed 後加入／重連／提交全為 0 |

## 相關連結

- 效能門檻唯一來源：[[MVP 效能目標]]
- 功能需求 BDD 場景（功能視角）：[[功能需求 BDD 場景]]（競態／idempotency／重連的功能視角在該檔，本檔不重複）
- 核心需求與 ubiquitous language：[[P0 核心需求基線]]
- 題目共用語意：[[題目領域契約]]
- 結果歸檔與保留：[[結果資料治理]]
- 原始需求與既有 AC：[[需求蒐集]]
- 專案首頁：[[智學互動平台]]
- 技術選型：[[技術棧]]