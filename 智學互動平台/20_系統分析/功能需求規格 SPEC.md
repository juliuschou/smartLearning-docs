---
title: 智學互動平台 - 功能需求規格 SPEC
type: research
status: active
created: 2026-08-14
updated: 2026-08-14
tags:
  - project
  - 需求基線
  - BDD
  - SDD
  - spec
  - 智學互動平台
project: 智學互動平台
---

# 智學互動平台 - 功能需求規格 SPEC

> [!important] Phase B override（2026-08-23）
> 本 SPEC 中早期 R-F5-5 的「只建立 admin/teacher、不建立 learner account」已由 Phase B backend decision supersede。現行規格是 admin 建立 student（不提供公開 self-registration）、teacher/admin 管理 `CourseEnrollment`、active enrollment gate account-bound Participant；student 可登入但不得建課或使用 owner/admin paths，`canCreateCourse` 永遠為 `false`，anonymous session-code + participant-token fallback 不變。open_text 結果與 close/archive projection 仍不得包含 participant/account/display identity linkage，student 不提供歷史結果入口。
> 本 override 只同步 current contract；驗證狀態仍以 backend task log 的 targeted PASS、B3/full pending 分層為準。

> [!info] 目的
> 本檔為 `[[功能需求 BDD 場景]]` 重塑之 SDD 正式規格(Spec-Driven Development)。將 [[P0 核心需求基線]] P0-01～P0-05 與 [[題目領域契約]] P0-04 的功能需求以 `SPEC-NNN` + `SHALL/MUST` 規範語句 + Acceptance Criteria + Test Plan 結構化,作為 M2 系統設計與 M3/M4 實作測試的單一規格來源。本檔只涵蓋**功能行為視角**(單人正常流程與非負載邊界);**負載與效能門檻視角**(P0-07)由 [[MVP 效能需求 BDD 場景]] 涵蓋,**結果歸檔、保留與刪除**(P0-06)由 [[結果資料治理]] 涵蓋,兩者均非本 SPEC 重定義範圍。本檔在競態、idempotency 與重連主題與效能檔交叉引用,不重複定義門檻數值;在結果終止時點與治理檔交叉引用,不重複定義 retention 規則。

> [!note] 與來源 BDD 檔的關係
> 本 SPEC 由 `[[功能需求 BDD 場景]]`(M1 BDD 場景證據層,保留於 `10_需求蒐集/`)推導而來。原 BDD 檔保留作為 Gherkin 場景來源與 M1 追蹤證據;本 SPEC 在其基礎上加 SPEC-NNN ID、SHALL/MUST 規範框架、獨立 Acceptance Criteria 與 Test Plan。所有 User Story 編號(`US-F0`～`US-F17`)、Rule 編號(`R-Fn-x`)、Gherkin Scenario 與 Red cards 均沿用原檔,維持追蹤連續性。

> [!note] 補自 [[需求蒐集]] 未被基線接手的部分
> US-F16(`can_create_course` 開課授權)與 US-F17(結果統計圖呈現)的規則在 [[需求蒐集]] 的 US-01／US-02／US-03 與 BR-01、BR-08、BR-16、BR-17 中已確認,但未被 [[P0 核心需求基線]] 或 [[題目領域契約]] 重述,故於本 SPEC 補齊。CLI／Agent 建題流程另見 [[CLI Agent 建題 BDD 場景]]。

> [!note] 驗收勾選語意
> 本 SPEC `Test Plan` 中 `[ ]` 代表 BDD 場景已由 [[P0 核心需求基線]] 與 [[題目領域契約]] 規則推導起草,待 M2 系統設計與 M3/M4 實作測試驗證後才標記 `[x]`。

> [!success] SDD 狀態
> 本 SPEC 已通過三方審查(PO/BA、Dev、QA),狀態為 `Active`,可作為 M2 系統設計與 M3/M4 實作測試的單一功能規格來源。下方 [[#Red cards]] 之 M2 設計輸入未定案前,對應場景可起草但不得據以實作。審查紀錄見 [[#三方審查紀錄]]。

## BDD 階層

```text
Business Capability: 教學互動核心功能 (P0-01～P0-05)
  +-- SPEC (SPEC-001～SPEC-006,對應 P0-01～P0-05 + 開課授權/結果呈現)
      +-- Feature (對應 P0-01～P0-05 與 P0-04)
          +-- User Story
              +-- Rules (SHALL/MUST 規範語句,生命週期、code、帳號、題目語意、匿名參與)
                  +-- Scenarios (Gherkin,功能視角)
```

## Domain language(沿用)

名詞定義沿用 [[P0 核心需求基線#Domain glossary]] 與 [[題目領域契約#Domain object]]:Course、LiveSession、QuestionDefinition、SessionQuestion、Participant、Submission、ArchivedResult、session code、Option。Gherkin 一律使用此 ubiquitous language。

---

# SPEC-001 Feature: Course 與 LiveSession 生命週期(P0-01)

## Overview

定義 Course(持久課程容器)與 LiveSession(單次授課場次)的狀態機、授權閘與不可逆終止語意,作為教學互動的容器層基礎。

## US-F0 老師建立課程

> 身為具有開課授權的老師,我想建立一個新課程容器並自動成為該課唯一老師,以便在其中建立互動題目與開放場次。

> [!note] 規則來源
> [[需求蒐集]] US-02(AC-02-01)、BR-01、BR-02、BR-03。`can_create_course` 授權旗標的管理視角見 [[#US-F16 系統管理員以開課授權旗標控管誰能建立課程]]。本 Story 只涵蓋建立課程的授權閘與建立結果;建立後在課程中增刪改題目見 [[#US-F9 老師建立符合題型規則的題目]],開放場次見 [[#US-F2 老師管理單一場次生命週期]]。

### Rules

- R-F0-1　系統 SHALL 只允許帶 `can_create_course` 旗標的帳號建立課程;未授權帳號嘗試建立時 MUST 拒絕。
- R-F0-2　被授權帳號建立課程後,Course 狀態 MUST 為 `draft`,且建立者 MUST 自動成為該 Course 唯一老師(一門課一位老師,建立者)。
- R-F0-3　Course 為持久容器,狀態 MUST 為 `draft` 或 `archived`,SHALL NOT 使用 `active`／`closed` 表示授課狀態。(與 [[#US-F1 老師管理 Course 生命週期]] R-F1-1 同一規則,本條為建立時視角、R-F1-1 為維護視角,擇一引用即可。)
- R-F0-4　MVP SHALL NOT 支援共同授課、老師指派或所有權移轉。
- R-F0-5　系統 SHALL 只允許在 `draft` Course 建立 LiveSession、編輯課程資料與題目。(與 R-F1-2 同一規則,建立與維護視角。)
- R-F0-6　互動題目歸屬課程,系統 SHALL 只允許該課老師建立與修改。(與 R-F16-4 同一規則,US-F0 為建立者視角、US-F16 為管理員授權視角。)

### Scenarios

```gherkin
# happy path — 授權老師建立課程
Scenario: 帶可開課旗標的老師建立新課程並成為唯一老師
  假定 一位已登入且具有 can_create_course 旗標的老師
  當 該老師建立一個新 Course
  那麼 課程建立成功且狀態為 draft
  而且該老師自動成為此 Course 唯一老師
  而且該老師可在 draft 課程中建立互動題目與場次

# error path — 未授權帳號建立課程被拒
Scenario: 未授權可開課的帳號建立課程被拒
  假定 一位已登入但沒有 can_create_course 旗標的帳號
  當 該帳號嘗試建立課程
  那麼 系統拒絕建立課程
  而且不產生任何課程

# boundary — 建立者為唯一老師不支援共同授課
Scenario: 課程建立者為唯一老師不支援共同授課或移轉
  假定 一位老師已建立一個 Course
  當 該老師嘗試指派其他老師共同授課或移轉所有權
  那麼 系統不支援該操作
  而且該老師維持唯一老師
```

## US-F1 老師管理 Course 生命週期

> 身為老師,我想維護既有課程容器,在不影響進行中場次的前提下封存不再使用的課程,以便長期管理課程與題庫。建立課程見 [[#US-F0 老師建立課程]]。

### Rules

- R-F1-1　Course 為持久容器,狀態 MUST 為 `draft` 或 `archived`,SHALL NOT 使用 `active`／`closed` 表示授課狀態。
- R-F1-2　系統 SHALL 只允許在 `draft` Course 建立 LiveSession、編輯課程資料與題目。
- R-F1-3　Course 只有在不存在 `waiting` 或 `active` LiveSession 時才能封存。
- R-F1-4　`archived` 不可恢復、不可編輯、不可再建立場次,但 MUST 保留歷史場次與結果查詢。
- R-F1-5　MVP SHALL NOT 提供 Course 刪除。

### Scenarios

```gherkin
# happy path — 封存無進行中場次的課程
Scenario: 老師封存沒有進行中場次的 Course
  假定 一個 draft Course 且沒有任何 waiting 或 active LiveSession
  當 老師封存該 Course
  那麼 Course 狀態變為 archived
  而且仍可查詢歷史場次與結果
  而且不可再編輯、開場或恢復

# error path — 有進行中場次時封存被拒
Scenario: Course 存在進行中場次時封存被拒
  假定 一個 draft Course 且存在一個 active LiveSession
  當 老師嘗試封存該 Course
  那麼 系統拒絕封存
  而且Course 維持 draft

# boundary — archived 後編輯被拒
Scenario: archived Course 不可編輯或開場
  假定 一個 archived Course
  當 老師嘗試編輯題目或建立 LiveSession
  那麼 系統拒絕該操作
  而且仍允許查詢歷史結果
```

## US-F2 老師管理單一場次生命週期

> 身為老師,我想為每次授課建立獨立場次,控制場次開始、結束或取消,使每場有獨立狀態與結果。

### Rules

- R-F2-1　同一 Course 同時最多存在一個 `waiting` 或 `active` LiveSession。
- R-F2-2　LiveSession 建立時進入 `waiting`,並 MUST 取得自己的 session code。
- R-F2-3　`waiting → active` 時系統 SHALL 依當下選定題目及順序建立 SessionQuestion 不可變快照。
- R-F2-4　`active` 不代表所有題目自動開放;SessionQuestion 初始均 MUST 為 `not_open`,由老師逐題控制。
- R-F2-5　`cancelled` 只適用於尚未 active 且沒有任何 Submission 的場次。
- R-F2-6　`closed` 與 `cancelled` 都是不可逆終止狀態,之後 MUST NOT 允許加入、重連或作答。
- R-F2-7　LiveSession 建立滿 8 小時仍未終止時系統 MUST 自動 closed(負載視角見 [[MVP 效能需求 BDD 場景#US-P7 場次逾 8 小時自動關閉(W8)]])。

### Scenarios

```gherkin
# happy path — 完整授課流程
Scenario: 老師建立場次、開始授課並結束
  假定 一個 draft Course 沒有進行中場次
  當 老師建立 LiveSession
  那麼 場次狀態為 waiting 並取得新 session code
  當 老師開始授課
  那麼 場次狀態變為 active
  而且依選定題目與順序建立 SessionQuestion 不可變快照
  而且所有 SessionQuestion 初始為 not_open
  當 老師結束場次
  那麼 場次狀態變為 closed 且不可恢復

# error path — 同時第二場被拒
Scenario: 同一 Course 已有進行中場次時建立第二場被拒
  假定 一個 Course 已有一個 active LiveSession
  當 老師嘗試建立第二個 LiveSession
  那麼 系統拒絕建立
  而且不產生新場次或新 session code

# boundary — 取消未開始且無答案的場次
Scenario: 老師取消尚未開始且沒有答案的場次
  假定 一個 waiting LiveSession 且沒有任何 Submission
  當 老師取消該場次
  那麼 場次狀態變為 cancelled 且不可恢復
  而且不形成互動結果

# boundary — 有答案的場次只能 closed 不能 cancelled
Scenario: active 場次只能 closed 不能 cancelled
  假定 一個 active LiveSession 且已有 Submission
  當 老師嘗試 cancel 該場次
  那麼 系統拒絕 cancel
  而且老師只能選擇 close
```

## Acceptance Criteria

> AC spine 沿用來源 [[P0 核心需求基線#P0-01 驗收條件]],不另起編號(避免 cross-spec conflict)。

| AC ID(來源) | 對應 Rules | 覆蓋 Scenario | 來源錨點 |
|---|---|---|---|
| P0-01-AC-01 | R-F1-1, R-F1-2 | 封存無進行中場次的 Course | [[P0 核心需求基線#Course 生命週期]] |
| P0-01-AC-02 | R-F2-1, R-F2-2 | 老師建立場次、開始授課並結束 | [[P0 核心需求基線#LiveSession 生命週期]] |
| P0-01-AC-03 | R-F2-5, R-F2-6 | 老師取消尚未開始且沒有答案的場次 | [[P0 核心需求基線#LiveSession 生命週期]] |
| P0-01-AC-04 | R-F1-3, R-F1-4 | Course 存在進行中場次時封存被拒 | [[P0 核心需求基線#Course 生命週期]] |
| P0-01-AC-05 | R-F2-3, R-F2-4 | 場次開始建立 SessionQuestion 快照、初始 not_open | [[P0 核心需求基線#LiveSession 生命週期]] |
| P0-01-AC-06 | R-F2-6, R-F2-7 | closed 不可逆、8 小時自動 closed | [[P0 核心需求基線#LiveSession 生命週期]] |

> [!note] US-F0 額外追蹤(未編 P0)
> US-F0 建立課程追溯至 [[需求蒐集#US-02 老師建立課程與互動題目]] AC-02-01、BR-01、BR-02、BR-03,非 P0-01 AC spine;詳見 [[#需求追蹤]]。

## Test Plan

| Scenario | 測試層級 | 狀態 | 備註 |
|---|---|---|---|
| 帶可開課旗標的老師建立新課程並成為唯一老師 | integration | [ ] 待 M3 | 需 mock auth + can_create_course 旗標 |
| 未授權可開課的帳號建立課程被拒 | integration | [ ] 待 M3 | 驗證授權閘拒絕路徑 |
| 課程建立者為唯一老師不支援共同授課或移轉 | integration | [ ] 待 M3 | 驗證 MVP 不支援操作 |
| 老師封存沒有進行中場次的 Course | integration | [ ] 待 M3 | 狀態轉移 draft→archived |
| Course 存在進行中場次時封存被拒 | integration | [ ] 待 M3 | 驗證 R-F1-3 守護條件 |
| archived Course 不可編輯或開場 | integration | [ ] 待 M3 | 驗證 archived 不可寫 |
| 老師建立場次、開始授課並結束 | integration | [ ] 待 M3 | 完整狀態機 waiting→active→closed |
| 同一 Course 已有進行中場次時建立第二場被拒 | integration | [ ] 待 M3 | 驗證 R-F2-1 單場限制 |
| 老師取消尚未開始且沒有答案的場次 | integration | [ ] 待 M3 | 驗證 cancelled 條件 |
| active 場次只能 closed 不能 cancelled | integration | [ ] 待 M3 | 驗證 R-F2-5 守護條件 |

> [!warning] 紅卡阻擋
> 本 SPEC 涉及之 M2 設計輸入(SessionQuestion 儲存模型、8 小時排程實作)未定案前,對應場景可起草但不得據以實作;詳見 [[#Red cards]]。

---

# SPEC-002 Feature: 多輪上課、session code 與題目重用(P0-02)

## Overview

定義 session code(場次加入金鑰)的產生、有效期與身分隔離語意,以及 QuestionDefinition 跨場重用與 SessionQuestion 不可變快照的分離原則。

## US-F3 學員以 session code 加入場次

> 身為學員,我想用老師提供的 session code 加入場次,且 code 不分大小寫、不含混淆字元,以便快速且正確地進入正確場次。

### Rules

- R-F3-1　每個 LiveSession MUST 產生一組新的 8 碼 code,字元集為大寫英文字母與數字,排除 `O/0`、`I/1` 等混淆字元。
- R-F3-2　使用者輸入時系統 SHALL 不分大小寫比對。
- R-F3-3　Code 只在所屬 LiveSession 的 `waiting` 與 `active` 期間有效;closed、cancelled 或滿 8 小時時 MUST 立即失效。
- R-F3-4　舊 code MUST NOT 指向後續新場次,也 MUST NOT 重新啟用。
- R-F3-5　Code 只用於找到及加入 LiveSession,MUST NOT 作為 Participant 身分或 CLI credential。

### Scenarios

```gherkin
# happy path — 大小寫不敏感
Scenario: 學員以小寫 session code 加入場次
  假定 一個 waiting LiveSession 有有效 session code "ABCD2345"
  當 學員輸入 "abcd2345" 加入
  那麼 學員成功加入該場次
  而且code 大小寫不敏感

# happy path — 排除混淆字元
Scenario: session code 不含混淆字元
  假定 一個剛建立的 LiveSession
  那麼 其 session code 為 8 碼
  而且不含 O、0、I、1 等容易混淆的字元

# error path — 舊 code 不可加入新場次
Scenario: 學員以舊場次 code 嘗試加入
  假定 一個已 closed 的 LiveSession 其 code 為 "OLDCODE1"
  而且 同一 Course 已建立新場次
  當 學員以 "OLDCODE1" 嘗試加入
  那麼 系統拒絕加入
  而且舊 code 不指向新場次也不重新啟用

# boundary — code 不作身分
Scenario: session code 不得作為 Participant 身分
  假定 一個 active LiveSession
  當 學員以 session code 加入成功
  那麼 系統簽發場次限定 participant token
  而且session code 本身不作為 participant 身分識別
```

## US-F4 老師跨場次重用題目且不影響歷史

> 身為老師,我想在多次授課中重用同一批題目,且修改題目不影響已進行或歷史場次的快照與結果。

### Rules

- R-F4-1　QuestionDefinition 歸屬 Course,SHALL 可供同一 Course 的多個 LiveSession 重用。
- R-F4-2　老師建立 LiveSession 時 SHALL 可選擇題目子集合及順序。
- R-F4-3　場次 `waiting → active` 時系統 MUST 建立該場 SessionQuestion 不可變快照。
- R-F4-4　LiveSession active 後修改 QuestionDefinition MUST NOT 影響進行中或歷史場次。
- R-F4-5　SessionQuestion 逐題狀態為 `not_open → open → closed`,同一時間最多一題 `open`。
- R-F4-6　SessionQuestion closed 後 MUST NOT 在同一 LiveSession 重開;MVP SHALL NOT 支援 active 後新增題目。
- R-F4-7　同一 QuestionDefinition SHALL 可在下一個 LiveSession 再次使用,從 `not_open` 重新開始。

### Scenarios

```gherkin
# happy path — 跨場重用
Scenario: 同一題目在兩個不同場次獨立使用
  假定 一個 draft Course 有一個 QuestionDefinition Q
  當 老師建立第一個 LiveSession 並選用 Q
  而且 場次開始後完成 Q 的作答與關題
  而且 場次結束後老師建立第二個 LiveSession 並再次選用 Q
  那麼 第二場的 Q 從 not_open 重新開始
  而且兩場的逐題狀態、答案與結果完全分離

# boundary — 修改題目不影響快照
Scenario: 老師修改題目不影響進行中場次快照
  假定 一個 active LiveSession 已建立 SessionQuestion 快照
  當 老師在 Course 中修改來源 QuestionDefinition 的題幹
  那麼 進行中場次的 SessionQuestion 內容不變
  而且歷史場次結果不受影響

# error path — closed 題目不可重開
Scenario: 同一場次 closed 題目不可重新開放
  假定 一個 active LiveSession 某題已 closed
  當 老師嘗試在同一場次重新 open 該題
  那麼 系統拒絕重開
  而且若要在同一場重問須在場次開始前準備另一個 SessionQuestion

# boundary — 同時最多一題 open
Scenario: 同一場次同一時間最多一題 open
  假定 一個 active LiveSession 已有一題 open
  當 老師嘗試 open 第二題
  那麼 系統只允許一題 open
  而且需先 close 當前題目才能 open 下一題
```

## Acceptance Criteria

> AC spine 沿用來源 [[P0 核心需求基線#P0-02 驗收條件]]。

| AC ID(來源) | 對應 Rules | 覆蓋 Scenario | 來源錨點 |
|---|---|---|---|
| P0-02-AC-01 | R-F3-1, R-F3-2 | 學員以小寫 session code 加入場次 | [[P0 核心需求基線#Session code]] |
| P0-02-AC-02 | R-F3-1 | session code 不含混淆字元 | [[P0 核心需求基線#Session code]] |
| P0-02-AC-03 | R-F3-3, R-F3-4 | 學員以舊場次 code 嘗試加入 | [[P0 核心需求基線#Session code]] |
| P0-02-AC-04 | R-F4-1, R-F4-7 | 同一題目在兩個不同場次獨立使用 | [[P0 核心需求基線#題目重用與快照]] |
| P0-02-AC-05 | R-F4-3, R-F4-4 | 老師修改題目不影響進行中場次快照 | [[P0 核心需求基線#題目重用與快照]] |
| P0-02-AC-06 | R-F4-5, R-F4-6 | closed 題目不可重開、同時最多一題 open | [[P0 核心需求基線#題目重用與快照]] |

## Test Plan

| Scenario | 測試層級 | 狀態 | 備註 |
|---|---|---|---|
| 學員以小寫 session code 加入場次 | integration | [ ] 待 M3 | 驗證大小寫正規化 |
| session code 不含混淆字元 | unit | [ ] 待 M3 | code 產生器字元集驗證 |
| 學員以舊場次 code 嘗試加入 | integration | [ ] 待 M3 | 驗證 code 失效與不可重啟 |
| session code 不得作為 Participant 身分 | integration | [ ] 待 M3 | 驗證 token 簽發與身分隔離 |
| 同一題目在兩個不同場次獨立使用 | integration | [ ] 待 M3 | 跨場快照分離 |
| 老師修改題目不影響進行中場次快照 | integration | [ ] 待 M3 | 不可變快照驗證 |
| 同一場次 closed 題目不可重新開放 | integration | [ ] 待 M3 | 驗證 R-F4-6 |
| 同一場次同一時間最多一題 open | integration | [ ] 待 M3 | 驗證單題 open 限制 |

> [!warning] 紅卡阻擋
> session code 產生與儲存模型、SessionQuestion 排序併發控制待 M2 定案;詳見 [[#Red cards]]。

---

# SPEC-003 Feature: Web 帳號生命週期(P0-03)

## Overview

定義帳號 bootstrap、建立、登入/登出 Web Session、密碼規則與復原、停用與 credential 失效的完整生命週期,涵蓋安全控管與可撤銷性。

## US-F5 系統管理員建立首位管理員與後續帳號

> 身為系統管理員,我想透過一次性 bootstrap 建立首位管理員,並由我建立後續老師與管理員帳號,以便控管平台存取。

### Rules

- R-F5-1　部署時系統 SHALL 提供一次性 bootstrap 流程建立第一位系統管理員;成功後 MUST 自動失效,不得再次建立。
- R-F5-2　後續帳號 SHALL 由有效系統管理員建立,建立時 MUST 簽發一次性臨時密碼。
- R-F5-3　使用者首次登入 MUST 設定自己的新密碼後才能使用其他功能。
- R-F5-4　管理員 MUST NOT 能讀回使用者後續設定的密碼。
- R-F5-5　MVP SHALL 只建立系統管理員與老師帳號,SHALL NOT 建立學員帳號。
- R-F5-6　MVP SHALL NOT 提供帳號硬刪、Email 自助重設、SSO 或 MFA。

### Scenarios

```gherkin
# happy path — bootstrap
Scenario: 部署時建立首位系統管理員
  假定 平台剛部署且尚無任何管理員帳號
  當 執行一次性 bootstrap 流程
  那麼 建立第一位系統管理員
  而且bootstrap 流程成功後立即失效

# error path — bootstrap 重複使用被拒
Scenario: bootstrap 成功後再次使用被拒
  假定 bootstrap 流程已成功建立首位管理員
  當 再次嘗試執行 bootstrap
  那麼 系統拒絕建立第二位首位管理員

# happy path — 管理員建立老師帳號
Scenario: 管理員建立老師帳號並簽發臨時密碼
  假定 一位有效的系統管理員
  當 該管理員建立一位新老師帳號
  那麼 系統簽發一次性臨時密碼給新帳號
  而且新使用者首次登入必須設定新密碼後才能使用其他功能

# boundary — 管理員無法讀回使用者密碼
Scenario: 管理員無法讀回使用者後續設定的密碼
  假定 一位老師已登入並設定自己的新密碼
  當 系統管理員嘗試讀取該老師的密碼
  那麼 系統不回傳該密碼
  而且密碼不以明文保存
```

## US-F6 使用者登入、登出與 Web Session

> 身為老師或管理員,我想以獨立帳號登入並在安全 Session 中操作,閒置過久自動失效,以便安全地使用平台功能。

### Rules

- R-F6-1　使用者 SHALL 以獨立 DB 帳號登入,SHALL NOT 整合 SSO。
- R-F6-2　Web Session MUST 由 Secure、HttpOnly、SameSite cookie 保護。
- R-F6-3　閒置 30 分鐘或自登入起滿 8 小時,Session MUST 失效並要求重新登入。
- R-F6-4　使用者 SHALL 可登出目前 Session;登出後瀏覽器返回 MUST NOT 重新顯示受保護內容。
- R-F6-5　停用帳號、管理員重設密碼或使用者成功變更密碼時,所有既有 Web Session MUST 立即失效。
- R-F6-6　建立／輪替 CLI key 及管理員高風險操作,SHALL 要求最近 10 分鐘完成密碼 step-up 驗證。
- R-F6-7　`active` 帳號可登入;`disabled` 帳號 MUST 收到通用登入失敗且 MUST NOT 建立 Session。

### Scenarios

```gherkin
# happy path — 正常登入
Scenario: active 老師以帳密登入取得安全 Session
  假定 一位 active 老師帳號
  當 該老師以正確帳密登入
  那麼 系統建立由 Secure、HttpOnly、SameSite cookie 保護的 Web Session
  而且可執行授權功能

# boundary — 閒置逾時
Scenario: Session 閒置 30 分鐘後失效
  假定 一位老師已登入且 Session 已閒置 30 分鐘
  當 該老師嘗試操作
  那麼 Session 已失效並要求重新登入

# boundary — 登入滿 8 小時失效
Scenario: Session 自登入起滿 8 小時失效
  假定 一位老師已登入滿 8 小時
  當 該老師嘗試操作
  那麼 Session 已失效並要求重新登入

# happy path — 登出
Scenario: 使用者登出後返回不得見受保護內容
  假定 一位已登入的老師
  當 該老師登出
  那麼 既有 Web Session 失效
  而且瀏覽器返回不得重新顯示受保護內容

# boundary — 改密碼使既有 Session 失效
Scenario: 使用者變更密碼後既有 Session 立即失效
  假定 一位老師有多個裝置登入 Session
  當 該老師成功變更密碼
  那麼 所有既有 Web Session 立即失效
  而且其他裝置需重新登入

# boundary — 停用帳號
Scenario: disabled 帳號無法登入
  假定 一位 disabled 帳號
  當 該帳號嘗試登入
  那麼 系統回傳通用登入失敗訊息
  而且不得建立 Session
  而且錯誤不洩露帳號是否存在

# boundary — step-up 驗證
Scenario: 建立 CLI key 要求最近 10 分鐘 step-up 驗證
  假定 一位已登入老師但最近 10 分鐘未做密碼 step-up
  當 該老師嘗試建立 CLI key
  那麼 系統要求先完成密碼 step-up 驗證
  而且未完成 step-up 不得建立 CLI key
```

## US-F7 使用者設定與變更密碼

> 身為使用者,我想設定符合安全規則的密碼,忘記時由管理員重設,以便兼顧安全與可恢復性。

### Rules

- R-F7-1　密碼長度 MUST 為 12～128 個 Unicode 字元,SHALL 允許 passphrase。
- R-F7-2　SHALL NOT 要求固定大小寫、數字、符號組合,也 SHALL NOT 要求定期更換。
- R-F7-3　MUST NOT 使用平台列為常見或已知外洩的密碼。
- R-F7-4　密碼 MUST NOT 明文保存;實際雜湊演算法與參數 SHOULD 由 M2 在 [[技術棧]] 定案。
- R-F7-5　使用者變更密碼時 MUST 先驗證目前密碼。
- R-F7-6　MVP SHALL NOT 提供 Email 自助重設;忘記密碼 SHALL 由管理員簽發新的一次性臨時密碼,下次登入 MUST 強制改密碼。
- R-F7-7　登入失敗 SHALL 採帳號與來源雙重 rate limit,回傳 MUST NOT 洩露帳號是否存在的通用錯誤,MUST NOT 因大量失敗永久鎖死帳號。

### Scenarios

```gherkin
# happy path — passphrase
Scenario: 使用者以 passphrase 設定密碼
  假定 一位首次登入的老師須設定新密碼
  當 該老師輸入 20 字元的 passphrase
  那麼 密碼設定成功
  而且不強迫包含特定大小寫、數字或符號組合

# error path — 常見密碼被拒
Scenario: 使用者設定常見外洩密碼被拒
  假定 一位使用者嘗試設定密碼
  當 該密碼為平台列為常見或已知外洩的密碼
  那麼 系統拒絕該密碼
  而且要求改用其他密碼

# error path — 長度不足
Scenario: 使用者設定過短密碼被拒
  假定 一位使用者嘗試設定密碼
  當 該密碼少於 12 字元
  那麼 系統拒絕該密碼
  而且提示長度須為 12～128 字元

# boundary — 變更密碼須驗證目前密碼
Scenario: 使用者變更密碼須先驗證目前密碼
  假定 一位已登入老師
  當 該老師變更密碼但未提供正確的目前密碼
  那麼 系統拒絕變更
  而且不得在未驗證目前密碼下改密碼

# boundary — 忘記密碼由管理員重設
Scenario: 忘記密碼由管理員簽發臨時密碼
  假定 一位老師忘記密碼
  當 系統管理員為該老師簽發新的一次性臨時密碼
  那麼 該老師下次登入使用臨時密碼
  而且登入後強制設定新密碼才能使用其他功能

# boundary — 登入失敗 rate limit
Scenario: 大量登入失敗受 rate limit 但不永久鎖死
  假定 一位老師帳號
  當 同一來源短時間內多次登入失敗
  那麼 系統依帳號與來源雙重 rate limit 限制後續嘗試
  而且錯誤訊息不洩露帳號是否存在
  而且不得因大量失敗永久鎖死帳號
```

## US-F8 帳號停用與 credential 失效

> 身為系統管理員,我想停用帳號使其 Web 與 CLI 存取同時失效,但保留課程、場次結果與稽核資料,以便安全收回存取而不破壞資料。

### Rules

- R-F8-1　`active` 帳號 SHALL 可依角色登入並執行授權功能。
- R-F8-2　停用帳號時既有 Web Session、CLI credential 與未使用 token MUST 立即失效。
- R-F8-3　停用 MUST NOT 刪除 Course、LiveSession、ArchivedResult 或稽核資料。
- R-F8-4　CLI key security lock 只阻擋 CLI credential 建立／啟用／輪替,MUST NOT 等同停用 Web 帳號;帳號停用則 MUST 同時阻擋 Web 與 CLI。
- R-F8-5　停用後 SHALL 可由管理員恢復為 `active`。
- R-F8-6　MVP SHALL NOT 硬刪帳號。

### Scenarios

```gherkin
# happy path — 停用帳號
Scenario: 管理員停用老師帳號使 Web 與 CLI 同時失效
  假定 一位 active 老師有 Web Session 與 CLI credential
  當 系統管理員停用該帳號
  那麼 該帳號狀態變為 disabled
  而且既有 Web Session 立即失效
  而且CLI credential 與未使用 token 立即失效
  而且Course、LiveSession、ArchivedResult 與稽核資料保留

# boundary — 停用後可恢復
Scenario: 管理員恢復已停用帳號
  假定 一位 disabled 帳號
  當 系統管理員恢復該帳號
  那麼 帳號狀態變為 active
  而且可再次依角色登入

# boundary — CLI lock 不等同停用 Web
Scenario: CLI key security lock 不阻擋 Web 登入
  假定 一位 active 老師其 CLI key 觸發 security lock
  當 該老師嘗試以 Web 帳密登入
  那麼 Web 登入不受 CLI lock 影響仍可成功
  而且CLI credential 的建立／啟用／輪替被阻擋
```

## Acceptance Criteria

> AC spine 沿用來源 [[P0 核心需求基線#P0-03 驗收條件]]。

| AC ID(來源) | 對應 Rules | 覆蓋 Scenario | 來源錨點 |
|---|---|---|---|
| P0-03-AC-01 | R-F5-1 | 部署時建立首位系統管理員 | [[P0 核心需求基線#帳號建立與首位管理員]] |
| P0-03-AC-02 | R-F5-2, R-F5-3 | 管理員建立老師帳號並簽發臨時密碼 | [[P0 核心需求基線#帳號建立與首位管理員]] |
| P0-03-AC-03 | R-F6-7, R-F8-2 | disabled 帳號無法登入、停用使 Session 失效 | [[P0 核心需求基線#角色與帳號狀態]]、[[P0 核心需求基線#登入、登出與 Web Session]] |
| P0-03-AC-04 | R-F6-2, R-F6-3 | active 老師登入取得安全 Session、閒置/8 小時失效 | [[P0 核心需求基線#登入、登出與 Web Session]] |
| P0-03-AC-05 | R-F6-4, R-F6-5 | 登出後返回不得見受保護內容、改密碼使 Session 失效 | [[P0 核心需求基線#登入、登出與 Web Session]] |
| P0-03-AC-06 | R-F7-1, R-F7-2 | passphrase 設定密碼 | [[P0 核心需求基線#密碼規則與復原]] |
| P0-03-AC-07 | R-F7-3, R-F7-5 | 常見密碼被拒、變更須驗證目前密碼 | [[P0 核心需求基線#密碼規則與復原]] |
| P0-03-AC-08 | R-F8-3, R-F8-5 | 停用保留資料、停用後可恢復 | [[P0 核心需求基線#角色與帳號狀態]] |
| P0-03-AC-09 | R-F5-4, R-F5-6 | 管理員無法讀回密碼、MVP 不硬刪/無 SSO | [[P0 核心需求基線#帳號建立與首位管理員]] |

## Test Plan

| Scenario | 測試層級 | 狀態 | 備註 |
|---|---|---|---|
| 部署時建立首位系統管理員 | integration | [ ] 待 M3 | bootstrap 一次性驗證 |
| bootstrap 成功後再次使用被拒 | integration | [ ] 待 M3 | 驗證 R-F5-1 失效 |
| 管理員建立老師帳號並簽發臨時密碼 | integration | [ ] 待 M3 | 臨時密碼簽發 |
| 管理員無法讀回使用者後續設定的密碼 | unit | [ ] 待 M3 | 密碼不可明文 |
| active 老師以帳密登入取得安全 Session | integration | [ ] 待 M3 | cookie 屬性驗證 |
| Session 閒置 30 分鐘後失效 | integration | [ ] 待 M3 | 閒置逾時 |
| Session 自登入起滿 8 小時失效 | integration | [ ] 待 M3 | 絕對逾時 |
| 使用者登出後返回不得見受保護內容 | integration | [ ] 待 M3 | 登出撤銷 |
| 使用者變更密碼後既有 Session 立即失效 | integration | [ ] 待 M3 | 多裝置 Session 撤銷 |
| disabled 帳號無法登入 | integration | [ ] 待 M3 | 通用錯誤不洩露 |
| 建立 CLI key 要求最近 10 分鐘 step-up 驗證 | integration | [ ] 待 M3 | step-up 閘 |
| 使用者以 passphrase 設定密碼 | unit | [ ] 待 M3 | 長度與組合規則 |
| 使用者設定常見外洩密碼被拒 | unit | [ ] 待 M3 | 外洩密碼清單 |
| 使用者設定過短密碼被拒 | unit | [ ] 待 M3 | 長度下限 |
| 使用者變更密碼須先驗證目前密碼 | integration | [ ] 待 M3 | 目前密碼驗證 |
| 忘記密碼由管理員簽發臨時密碼 | integration | [ ] 待 M3 | 管理員重設流程 |
| 大量登入失敗受 rate limit 但不永久鎖死 | integration | [ ] 待 M3 | 雙重 rate limit |
| 管理員停用老師帳號使 Web 與 CLI 同時失效 | integration | [ ] 待 M3 | credential 同步失效 |
| 管理員恢復已停用帳號 | integration | [ ] 待 M3 | disabled→active |
| CLI key security lock 不阻擋 Web 登入 | integration | [ ] 待 M3 | CLI/Web 失效分離 |

> [!warning] 紅卡阻擋
> Bootstrap 具體命令與秘密傳遞、Web Session 儲存與 cookie 值形式、密碼雜湊演算法待 M2 定案;詳見 [[#Red cards]]。

---

# SPEC-004 Feature: 題目領域契約(P0-04)

## Overview

定義 poll、open text、quiz 三題型的欄位必要/允許/禁止語意、共用 validation(正規化、批次、all-or-nothing、一次回報)與 Web／CLI 批次建立 preview/確認流程。題型語意為 Web 與 CLI 共用契約,詳見 [[題目領域契約]]。

## US-F9 老師建立符合題型規則的題目

> 身為老師,我想建立 poll、open text 或 quiz 題目,系統會依題型嚴格檢查必要／允許／禁止欄位,以便題目語意一致且可跨 Web 與 CLI 使用。

### Rules

- R-F9-1　Poll:`type` 必要、`prompt` 必要、`selection_mode` 必要(single／multiple)、`options` 必要 2～10 個、`correct_option_refs` 禁止。
- R-F9-2　Open text:`type` 必要、`prompt` 必要,`selection_mode`／`options`／`correct_option_refs` 均禁止。
- R-F9-3　Quiz:`type` 必要、`prompt` 必要、`selection_mode` 禁止(由正確答案數推導單選／複選)、`options` 必要 2～10 個、`correct_option_refs` 必要且每個 ref 須存在於 options。
- R-F9-4　`prompt` 為 Unicode 純文字,trim 後 1～1,000 字元;`option text` trim 後 1～250 字元。
- R-F9-5　第一版 SHALL NOT 支援 Markdown、HTML、附件、圖片或其他 rich content。
- R-F9-6　Question ID SHALL 由平台指定且不可變;Web／CLI 均 MUST NOT 自訂正式 ID。

### Scenarios

```gherkin
# happy path — poll
Scenario: 老師建立合法的 poll 題目
  假定 一位老師在 draft Course 中建立題目
  當 該題目 type 為 poll、prompt 有效、selection_mode 為 single、有 3 個有效 options 且無 correct_option_refs
  那麼 題目通過 validation 並建立

# happy path — open text
Scenario: 老師建立合法的 open text 題目
  假定 一位老師在 draft Course 中建立題目
  當 該題目 type 為 open_text、prompt 有效且無 selection_mode、options、correct_option_refs
  那麼 題目通過 validation 並建立

# happy path — quiz 複選
Scenario: 老師建立合法的 quiz 複選題目
  假定 一位老師在 draft Course 中建立題目
  當 該題目 type 為 quiz、prompt 有效、有 3 個有效 options、correct_option_refs 引用其中 2 個且無 selection_mode
  那麼 題目通過 validation 並建立
  而且由 2 個正確答案推導為複選測驗

# error path — poll 帶 correct options
Scenario: poll 題目帶 correct_option_refs 被 error
  假定 一位老師建立 poll 題目
  當 該題目包含 correct_option_refs
  那麼 系統回傳 FIELD_FORBIDDEN error
  而且題目不被建立

# error path — open_text 帶 options
Scenario: open_text 題目帶 options 被 error
  假定 一位老師建立 open_text 題目
  當 該題目包含 options
  那麼 系統回傳 FIELD_FORBIDDEN error
  而且題目不被建立

# error path — quiz 缺正確答案
Scenario: quiz 題目缺 correct_option_refs 被 error
  假定 一位老師建立 quiz 題目
  當 該題目沒有 correct_option_refs
  那麼 系統回傳 CORRECT_OPTION_INVALID error
  而且題目不被建立

# boundary — 題幹過長
Scenario: 題幹超過 1,000 字元被 error
  假定 一位老師建立題目
  當 該題目 prompt trim 後超過 1,000 字元
  那麼 系統回傳 TEXT_TOO_LONG error
  而且題目不被建立

# boundary — 選項數量不足
Scenario: poll 選項少於 2 個被 error
  假定 一位老師建立 poll 題目
  當 該題目只有 1 個 option
  那麼 系統回傳 OPTION_COUNT_INVALID error
  而且題目不被建立
```

## US-F10 系統以正規化判斷重複選項並一次回報所有錯誤

> 身為老師,我想在批次建立題目時一次看到所有錯誤與警告,而非逐一修正,以便高效完成題庫建立。

### Rules

- R-F10-1　題幹與 option text SHALL 先去前後空白再檢查空值及長度。
- R-F10-2　重複 option SHALL 以 Unicode 正規化、trim、合併連續空白及忽略大小寫後判斷;正規化後重複為阻擋 error。
- R-F10-3　批次建立每批 1～50 題;`client_ref` 在單次 payload 內 MUST 唯一。
- R-F10-4　All-or-nothing:任一 error 均 MUST NOT 建立部分題目。
- R-F10-5　Validation SHALL 一次回報所有可辨識的 error 與 warning。
- R-F10-6　同一 Course SHALL 可有相同題幹;validation SHALL 可提「可能重複題目」warning 但 MUST NOT 阻擋或自動合併。
- R-F10-7　Error／warning SHALL 至少回傳穩定語言無關 code、可定位題目與欄位的 path、人類訊息、是否阻擋、使用者可採取的下一步。

### Scenarios

```gherkin
# happy path — 一次回報所有錯誤
Scenario: 批次建立多題時一次回報全部可辨識錯誤
  假定 一位老師批次提交 5 題 payload
  當 其中第 2 題題幹過長且第 4 題 poll 帶 correct_option_refs
  那麼 系統一次回報第 2 題 TEXT_TOO_LONG 與第 4 題 FIELD_FORBIDDEN
  而且依 all-or-nothing 不建立任何題目

# error path — 正規化重複選項
Scenario: 正規化後重複選項被 error
  假定 一位老師建立題目且兩個 option 文字為 "PostgreSQL" 與 "  postgresql  "
  當 系統以 Unicode 正規化、trim、合併空白並忽略大小寫判斷
  那麼 兩個 option 判定為重複
  而且系統回傳 OPTION_DUPLICATE error 且不建立題目

# boundary — 相同題幹僅 warning
Scenario: 相同題幹提出 warning 但不阻擋
  假定 一個 Course 已有題幹「今天最重要的收穫？」
  當 老師建立另一題題幹也是「今天最重要的收穫？」
  那麼 系統提出可能重複題目 warning
  而且不自動合併也不阻擋建立

# error path — 批次超過 50 題
Scenario: 批次超過 50 題被 error
  假定 一位老師批次提交 51 題
  那麼 系統回傳 BATCH_SIZE_INVALID error
  而且不建立任何題目

# boundary — client_ref 唯一
Scenario: 同 payload 內重複 client_ref 被 error
  假定 一位老師批次提交且兩題使用相同 client_ref
  那麼 系統回報 client_ref 重複 error
  而且依 all-or-nothing 不建立任何題目
```

## US-F11 老師批次建立題目須預覽並明確確認

> 身為老師,我想在批次建立題目前看到完整預覽並明確確認,payload 改變後重新驗證,以便建立正確的題庫。

### Rules

- R-F11-1　Validation 成功後的 preview SHALL 完整呈現 Course 名稱與 ID、題目順序、內容、正確答案及 warning。
- R-F11-2　正式建立前 MUST 由老師明確確認;payload 改變即 SHALL 重新 validation 與確認。
- R-F11-3　正式建立 SHALL 採相同 validation 結果、授權重查、transaction 與 idempotency 規則。
- R-F11-4　成功題目 SHALL 依預覽順序附加到 Course 當下末端。
- R-F11-5　Web 單題 CRUD SHALL NOT 受每批最多 50 題限制。
- R-F11-6　Course archived 後 MUST NOT 修改題目。

### Scenarios

```gherkin
# happy path — 預覽後確認建立
Scenario: 老師預覽合法批次後確認建立題目
  假定 一位老師在 draft Course 批次提交 3 題且全部通過 validation
  當 系統產生完整 preview 顯示 Course 名稱、ID、題目順序、內容、正確答案與 warning
  而且 老師明確確認
  那麼 系統以相同 validation 結果正式建立 3 題
  而且題目依預覽順序附加到 Course 當下末端

# boundary — payload 改變須重新 validation
Scenario: payload 改變後須重新 validation 與確認
  假定 一位老師已取得某批次 preview
  當 該老師修改 payload 後再次提交
  那麼 系統重新執行 validation
  而且須重新確認才能正式建立

# boundary — Web 單題不受批次限制
Scenario: 老師在 Web 單題新增不受 50 題限制
  假定 一位老師在 Web 逐題建立題目
  當 該老師單題新增超過 50 題
  那麼 單題操作不受每批最多 50 題限制
  而且可正常建立

# error path — archived Course 不可改題目
Scenario: archived Course 不得修改題目
  假定 一個 archived Course
  當 老師嘗試建立、修改或刪除題目
  那麼 系統回傳 COURSE_NOT_EDITABLE error
  而且不變更任何題目
```

## Acceptance Criteria

> AC spine 沿用來源 [[題目領域契約#P0-04 驗收條件]]。

| AC ID(來源) | 對應 Rules | 覆蓋 Scenario | 來源錨點 |
|---|---|---|---|
| P0-04-AC-01 | R-F9-1, R-F9-2 | poll / open_text 合法題目建立 | [[題目領域契約#題型規則]] |
| P0-04-AC-02 | R-F9-3 | quiz 複選題目建立、缺正確答案 error | [[題目領域契約#題型規則]] |
| P0-04-AC-03 | R-F10-1, R-F10-2 | 正規化重複選項 error | [[題目領域契約#共用 validation]] |
| P0-04-AC-04 | R-F10-4, R-F10-5 | 批次一次回報所有錯誤、all-or-nothing | [[題目領域契約#共用 validation]] |
| P0-04-AC-05 | R-F11-1, R-F11-2 | 預覽後確認建立、payload 改變重新 validation | [[題目領域契約#Web／CLI 批次 command]] |
| P0-04-AC-06 | R-F11-3, R-F11-4 | 正式建立 transaction/idempotency、依序附加 | [[題目領域契約#Web／CLI 批次 command]] |
| P0-04-AC-07 | R-F9-4, R-F9-5 | 題幹/選項長度、無 rich content | [[題目領域契約#題型規則]] |
| P0-04-AC-08 | R-F9-6, R-F11-6 | Question ID 不可變、archived 不可改題目 | [[題目領域契約#題型規則]] |

## Test Plan

| Scenario | 測試層級 | 狀態 | 備註 |
|---|---|---|---|
| 老師建立合法的 poll 題目 | unit | [ ] 待 M3 | 題型 validation |
| 老師建立合法的 open text 題目 | unit | [ ] 待 M3 | 題型 validation |
| 老師建立合法的 quiz 複選題目 | unit | [ ] 待 M3 | 推導單選/複選 |
| poll 題目帶 correct_option_refs 被 error | unit | [ ] 待 M3 | FIELD_FORBIDDEN |
| open_text 題目帶 options 被 error | unit | [ ] 待 M3 | FIELD_FORBIDDEN |
| quiz 題目缺 correct_option_refs 被 error | unit | [ ] 待 M3 | CORRECT_OPTION_INVALID |
| 題幹超過 1,000 字元被 error | unit | [ ] 待 M3 | TEXT_TOO_LONG |
| poll 選項少於 2 個被 error | unit | [ ] 待 M3 | OPTION_COUNT_INVALID |
| 批次建立多題時一次回報全部可辨識錯誤 | integration | [ ] 待 M3 | 一次回報 + all-or-nothing |
| 正規化後重複選項被 error | unit | [ ] 待 M3 | Unicode 正規化重複判定 |
| 相同題幹提出 warning 但不阻擋 | unit | [ ] 待 M3 | warning 不阻擋 |
| 批次超過 50 題被 error | integration | [ ] 待 M3 | BATCH_SIZE_INVALID |
| 同 payload 內重複 client_ref 被 error | integration | [ ] 待 M3 | client_ref 唯一 |
| 老師預覽合法批次後確認建立題目 | integration | [ ] 待 M3 | preview→confirm→建立 |
| payload 改變後須重新 validation 與確認 | integration | [ ] 待 M3 | payload 變更重驗 |
| 老師在 Web 單題新增不受 50 題限制 | integration | [ ] 待 M3 | 單題 CRUD 不受限 |
| archived Course 不得修改題目 | integration | [ ] 待 M3 | COURSE_NOT_EDITABLE |

> [!warning] 紅卡阻擋
> QuestionDefinition/Option/SessionQuestion 儲存模型、validation token/payload hash/transaction/idempotency、wire schema 與版本相容策略待 M2 定案;詳見 [[#Red cards]]。

---

# SPEC-005 Feature: 匿名 Participant、重連、提交與競態(P0-05)

## Overview

定義匿名 Participant 加入、場次限定 token、重連恢復、Submission idempotency 與唯一性、關題/提交競態的伺服器權威順序判定。本 SPEC 為**功能行為視角**(單人正常流程與非負載邊界);**負載與門檻視角**(300 人集中提交、p95 延遲、同時斷線重連等)見 [[MVP 效能需求 BDD 場景]],本檔不重複門檻數值。

> [!note] 與效能檔的分工
> 以下為**功能行為視角**。**負載與門檻視角**見 [[MVP 效能需求 BDD 場景]],本檔不重複門檻數值。

## US-F12 學員匿名加入場次並取得場次限定 token

> 身為學員,我想以 session code 與自填顯示名匿名加入場次,取得場次限定 token 以便參與互動而不建立跨場身分。

### Rules

- R-F12-1　學員 SHALL 以 session code 與自填顯示名加入 LiveSession。
- R-F12-2　加入成功後系統 SHALL 由伺服器簽發只對該 LiveSession 有效的 opaque participant token。
- R-F12-3　Token SHALL 可由同一 browser 保存並用於重連,但 MUST NOT 用於其他 LiveSession,也 MUST NOT 建立跨場追蹤身分。
- R-F12-4　清除 browser 資料、改用其他 browser 或裝置後,平台 SHALL NOT 保證識別為同一 participant。
- R-F12-5　顯示名去前後空白後 MUST 為 1～40 個安全可顯示 Unicode 字元,MUST NOT 含換行、控制字元或顯示方向控制符。
- R-F12-6　同一 LiveSession SHALL 允許重複顯示名;顯示名只供 UI 展示,MUST NOT 作身份、防重複或授權依據。

### Scenarios

```gherkin
# happy path — 匿名加入
Scenario: 學員以 session code 與顯示名匿名加入
  假定 一個 active LiveSession 有有效 session code
  當 學員以該 code 與自填顯示名「小明」加入
  那麼 系統簽發只對該場有效的 opaque participant token
  而且該 token 不得用於其他 LiveSession

# boundary — 允許重複顯示名
Scenario: 同一場次兩位學員使用相同顯示名
  假定 一個 active LiveSession
  當 兩位學員都以顯示名「小明」加入
  那麼 兩位都成功加入並取得不同 participant token
  而且顯示名不作為身份或防重複依據

# error path — 顯示名含控制字元被拒
Scenario: 顯示名含換行或控制字元被拒
  假定 一個 active LiveSession
  當 學員以含換行字元的顯示名加入
  那麼 系統拒絕加入
  而且要求改用安全可顯示字元

# boundary — 顯示名長度
Scenario: 顯示名超過 40 字元被拒
  假定 一個 active LiveSession
  當 學員以 trim 後 41 字元的顯示名加入
  那麼 系統拒絕加入
  而且要求長度為 1～40 字元

# boundary — 跨裝置不保證同一 participant
Scenario: 學員改用其他裝置加入取得新 participant 身分
  假定 一位學員已在某 browser 加入場次
  當 該學員清除 browser 資料或改用其他裝置加入
  那麼 平台不保證識別為同一 participant
  而且此為無帳號模式的已知限制
```

## US-F13 學員以 participant token 重連恢復狀態

> 身為學員,我想在斷線後用原 token 重連,恢復場次狀態與作答進度,且不被當成新參與者或產生重複答案。

### Rules

- R-F13-1　有效 participant token 重連後系統 SHALL 回傳:LiveSession 最新狀態、目前 SessionQuestion 及狀態、自己是否已提交目前題目、依 vote-to-reveal 有權看到的最新彙總。
- R-F13-2　瀏覽器快取或 WebSocket 事件 SHALL NOT 作為權威資料;斷線後 SHALL 以伺服器回傳的最新狀態為準。
- R-F13-3　LiveSession closed／cancelled 或滿 8 小時後 MUST NOT 重連。

### Scenarios

```gherkin
# happy path — 重連恢復狀態
Scenario: 學員斷線後以原 token 重連恢復作答進度
  假定 一位學員已加入 active LiveSession 且已提交某題答案後斷線
  當 該學員以原 participant token 重連
  那麼 系統恢復 LiveSession 最新狀態、目前題目、自己已答狀態與可見彙總
  而且不建立第二個 participant
  而且已答題目不產生第二筆有效 Submission

# boundary — 以伺服器為準
Scenario: 斷線後以伺服器最新狀態為準而非瀏覽器快取
  假定 一位學員斷線時瀏覽器仍有舊快取
  當 該學員重連
  那麼 系統以伺服器回傳的最新狀態為準
  而且不採過期的瀏覽器快取或 WebSocket 事件作權威

# error path — 場次終止後重連被拒
Scenario: 場次 closed 後重連被拒
  假定 一個 LiveSession 已 closed
  當 學員以原 participant token 嘗試重連
  那麼 系統拒絕重連
  而且不恢復任何場次狀態
```

## US-F14 學員提交答案受 idempotency 與唯一性保護

> 身為學員,我想提交的答案受保護,安全重送不產生重複,不同答案再次提交不覆寫第一次,以便資料正確不重複。

### Rules

- R-F14-1　同一 participant 對同一 SessionQuestion 最多一筆有效 Submission。
- R-F14-2　第一次成功提交後 MUST NOT 修改答案。
- R-F14-3　同一 idempotency key 的安全重送 SHALL 回傳第一次提交結果,MUST NOT 新增第二筆 Submission。
- R-F14-4　同一 participant 對同一題以不同答案再次提交 SHALL 回傳衝突,MUST NOT 覆寫第一次答案。
- R-F14-5　多分頁或併發請求同時提交時,最多一筆成功。
- R-F14-6　只有 LiveSession `active` 且 SessionQuestion `open` 時 SHALL 可提交。

### Scenarios

```gherkin
# happy path — 第一次提交成功
Scenario: 學員首次提交答案成功
  假定 一個 active LiveSession 且一個 SessionQuestion 處於 open
  而且 一位學員尚未提交該題
  當 該學員提交有效答案
  那麼 Submission 建立成功
  而且該 participant 該題只有一筆有效答案

# boundary — 安全重送
Scenario: 學員以相同 idempotency key 重送取得第一次結果
  假定 一位學員已成功提交但未收到 response
  當 該學員以相同 idempotency key 重送
  那麼 系統回傳第一次提交結果
  而且不建立第二筆 Submission

# error path — 不同答案再次提交衝突
Scenario: 學員以不同答案再次提交回傳衝突
  假定 一位學員已成功提交某題答案
  當 該學員以不同答案再次提交該題
  那麼 系統回傳衝突錯誤
  而且第一次答案不被覆寫

# boundary — 多分頁併發
Scenario: 多分頁同時提交最多一筆成功
  假定 一位學員以多分頁同時提交同一題答案
  當 併發請求同時到達伺服器
  那麼 最多一筆 Submission 成功
  而且其他請求回傳衝突或已存在

# error path — 題目未開放
Scenario: 學員對 not_open 題目提交被拒
  假定 一個 active LiveSession 且目標 SessionQuestion 處於 not_open
  當 學員以有效 token 提交
  那麼 系統拒絕該 Submission
  而且不建立有效答案
```

## US-F15 關題與提交競態依伺服器權威順序判定

> 身為學員,我想在老師關題瞬間提交的答案依伺服器權威順序正確判定,不因網路到達先後而誤判。

### Rules

- R-F15-1　系統 SHALL 以伺服器提交順序為唯一權威,SHALL NOT 採 client device time 或 WebSocket 到達先後。
- R-F15-2　Submission 先成功提交後題目 closed → 答案 SHALL 保留並納入結果。
- R-F15-3　題目先成功 closed 後 Submission 提交 → 答案 SHALL 拒絕,SHALL NOT 納入結果。
- R-F15-4　Client 已送出但未取得回應時,SHALL 以原 idempotency key 取回第一次權威結果。
- R-F15-5　WebSocket 顯示已關題但權威查詢顯示 Submission 已先提交時,SHALL 以權威查詢為準。
- R-F15-6　LiveSession 自動 closed 與 Submission 同時發生時,SHALL 同樣依伺服器提交順序判定。

### Scenarios

```gherkin
# happy path — 提交先 commit
Scenario: 學員答案先 commit 後老師關題,答案保留
  假定 一個 active LiveSession 且一個 SessionQuestion 處於 open
  當 學員 Submission 先成功 commit,隨後老師 close 該題
  那麼 該答案保留並納入彙總
  而且權威查詢確認該題有一筆有效 Submission

# boundary — 關題先 commit
Scenario: 老師關題先 commit 後學員提交,答案被拒
  假定 一個 active LiveSession 且一個 SessionQuestion 處於 open
  當 老師 close 先成功 commit,隨後學員提交
  那麼 該 Submission 被拒絕且不納入結果
  而且題目 closed commit 後新接受的答案為 0

# boundary — client timeout 重送取回權威結果
Scenario: Client 未收到回應以原 idempotency key 取回第一次結果
  假定 學員已送出 Submission 但尚未取得回應
  當 學員以原 idempotency key 重送
  那麼 系統回傳第一次權威提交結果
  而且不建立第二筆 Submission

# boundary — WebSocket 與權威不一致
Scenario: WebSocket 顯示已關題但權威查詢顯示答案已先提交
  假定 學員 Submission 已在伺服器 commit
  而且 WebSocket 事件先顯示題目已 closed
  當 學員以權威查詢確認提交狀態
  那麼 以權威查詢結果為準,答案納入結果
  而且不因 WebSocket 到達先後判定為拒絕

# boundary — 自動關閉與提交同時
Scenario: LiveSession 自動關閉與 Submission 同時發生依伺服器順序判定
  假定 一個 active LiveSession 達 8 小時上限觸發自動 closed
  當 同時有 Submission 正在提交
  那麼 依伺服器提交順序判定是否納入
  而且不採 client time 或事件到達順序
```

## Acceptance Criteria

> AC spine 沿用來源 [[P0 核心需求基線#P0-05 驗收條件]]。**補列 P0-05-AC-07**(終止/8 小時後拒絕加入、重連、新 Submission),原 BDD 需求追蹤表漏列,本 SPEC 補正。

| AC ID(來源) | 對應 Rules | 覆蓋 Scenario | 來源錨點 |
|---|---|---|---|
| P0-05-AC-01 | R-F12-1, R-F12-2 | 學員以 session code 與顯示名匿名加入 | [[P0 核心需求基線#匿名 Participant]] |
| P0-05-AC-02 | R-F12-3, R-F12-6 | token 場次限定、允許重複顯示名 | [[P0 核心需求基線#匿名 Participant]] |
| P0-05-AC-03 | R-F13-1, R-F13-2 | 重連恢復狀態、以伺服器為準 | [[P0 核心需求基線#重連]] |
| P0-05-AC-04 | R-F14-1, R-F14-3 | 第一次提交成功、安全重送 | [[P0 核心需求基線#Submission 與 idempotency]] |
| P0-05-AC-05 | R-F14-2, R-F14-4 | 不同答案再次提交衝突、不覆寫 | [[P0 核心需求基線#Submission 與 idempotency]] |
| P0-05-AC-06 | R-F15-1～R-F15-6 | 關題/提交競態伺服器權威順序 | [[P0 核心需求基線#Submit／close 競態]] |
| P0-05-AC-07 | R-F13-3, R-F14-6 | 場次終止/8 小時後拒絕重連與新 Submission | [[P0 核心需求基線#重連]]、[[P0 核心需求基線#Submission 與 idempotency]] |
| P0-05-AC-08 | R-F12-4, R-F12-5 | 跨裝置不保證同一 participant、顯示名安全字元 | [[P0 核心需求基線#匿名 Participant]] |

## Test Plan

| Scenario | 測試層級 | 狀態 | 備註 |
|---|---|---|---|
| 學員以 session code 與顯示名匿名加入 | integration | [ ] 待 M3 | token 簽發 |
| 同一場次兩位學員使用相同顯示名 | integration | [ ] 待 M3 | 重複顯示名 |
| 顯示名含換行或控制字元被拒 | unit | [ ] 待 M3 | 安全字元驗證 |
| 顯示名超過 40 字元被拒 | unit | [ ] 待 M3 | 長度上限 |
| 學員改用其他裝置加入取得新 participant 身分 | integration（manual） | [ ] 待 M3 | 跨裝置為已知非確定限制,以 manual 驗證 |
| 學員斷線後以原 token 重連恢復作答進度 | integration | [ ] 待 M3 | 重連恢復 |
| 斷線後以伺服器最新狀態為準而非瀏覽器快取 | integration | [ ] 待 M3 | 伺服器權威 |
| 場次 closed 後重連被拒 | integration | [ ] 待 M3 | 終止後拒絕重連 |
| 學員首次提交答案成功 | integration | [ ] 待 M3 | Submission 建立 |
| 學員以相同 idempotency key 重送取得第一次結果 | integration | [ ] 待 M3 | idempotency |
| 學員以不同答案再次提交回傳衝突 | integration | [ ] 待 M3 | 不覆寫 |
| 多分頁同時提交最多一筆成功 | integration + 併發 | [ ] 待 M3 | 併發唯一性(門檻視角見效能檔) |
| 學員對 not_open 題目提交被拒 | integration | [ ] 待 M3 | R-F14-6 守護 |
| 學員答案先 commit 後老師關題,答案保留 | integration + 併發 | [ ] 待 M3 | 提交先 commit |
| 老師關題先 commit 後學員提交,答案被拒 | integration + 併發 | [ ] 待 M3 | 關題先 commit |
| Client 未收到回應以原 idempotency key 取回第一次結果 | integration | [ ] 待 M3 | timeout 重送 |
| WebSocket 顯示已關題但權威查詢顯示答案已先提交 | integration | [ ] 待 M3 | 權威優先 |
| LiveSession 自動關閉與 Submission 同時發生依伺服器順序判定 | integration + 併發 | [ ] 待 M3 | 自動關閉競態 |

> [!warning] 紅卡阻擋
> Participant token 格式/保存/重連 protocol、Submission idempotency/unique constraint/transaction isolation、8 小時自動 closed 排程實作待 M2 定案;詳見 [[#Red cards]]。

---

# SPEC-006 Feature: 開課授權與結果呈現(補自需求蒐集)

## Overview

補齊未被 [[P0 核心需求基線]] 或 [[題目領域契約]] 重述的兩項功能:`can_create_course` 開課授權旗標(管理員視角)與題型對應的即時結果呈現。追溯至 [[需求蒐集]] 原始 AC 與 BR,非 P0-01～P0-05 AC spine。

> [!note] CLI／Agent 建題的規格層級
> CLI／Agent 建題流程未升級為 SPEC-NNN,刻意以 [[CLI Agent 建題 BDD 場景]] 為現行規格權威(US-C1～US-C5 Gherkin 場景)。M2/M3 引用 CLI 建題時以此 BDD 檔為單一來源;本 SPEC 不重述其規則,僅在題目 validation 語意(SPEC-004)與開課授權(SPEC-006 US-F16)交界處引用。

## US-F16 系統管理員以開課授權旗標控管誰能建立課程

> 身為系統管理員,我想在帳號上設定「可開課」授權旗標,使只有被授權的老師能建立課程與互動題目,以便控管平台內容的建立者。

> [!note] 規則來源
> [[需求蒐集]] BR-01、US-01(AC-01-02、AC-01-03)、US-02(AC-02-01)。`can_create_course` 是帳號層級旗標,因為課程建立前不存在可指派的標的;該帳號建立課程後自動成為該課老師。此規則在 [[P0 核心需求基線]] 的帳號生命週期中未重述,於本 SPEC 補齊。

### Rules

- R-F16-1　`can_create_course` 為帳號層級旗標,SHALL 由系統管理員在帳號上切換。
- R-F16-2　系統 SHALL 只允許帶 `can_create_course` 旗標的帳號建立課程;未授權帳號嘗試建立時 MUST 拒絕。
- R-F16-3　被授權帳號建立課程後 SHALL 自動成為該課唯一老師(一門課一位老師,建立者)。
- R-F16-4　互動題目歸屬課程,系統 SHALL 只允許該課老師建立與修改。
- R-F16-5　移除 `can_create_course` 時,既有課程、題目與歷史結果 MUST NOT 刪除。移除旗標是否同步使相關 CLI credential 與未使用 token 失效,**待 M2 於 Web Auth 設計確認**:P0 基線現僅定義「帳號停用、使用者變更密碼、管理員重設密碼」三個 credential 失效觸發([[P0 核心需求基線#角色與帳號狀態]]、[[P0 核心需求基線#登入、登出與 Web Session]]),未含移除旗標;本 SPEC 不擴增觸發清單,留 M2 定案。

### Scenarios

```gherkin
# happy path — 授權帳號建立課程
Scenario: 帶可開課旗標的老師建立課程並自動成為該課老師
  假定 一位帳號具有 can_create_course 旗標
  當 該帳號建立一個新課程
  那麼 課程建立成功
  而且該帳號自動成為此課程的唯一老師
  而且該老師可在課程中建立互動題目

# error path — 未授權帳號建立課程被拒
Scenario: 未授權可開課的帳號建立課程被拒
  假定 一位帳號沒有 can_create_course 旗標
  當 該帳號嘗試建立課程
  那麼 系統拒絕建立課程
  而且不產生任何課程

# happy path — 管理員切換旗標
Scenario: 系統管理員在帳號上切換可開課旗標
  假定 一位有效的系統管理員
  而且 一位尚未授權的老師帳號
  當 管理員為該帳號啟用 can_create_course
  那麼 該帳號隨後可建立課程

# boundary — 移除旗標保留課程,credential 失效與否待 M2
Scenario: 移除可開課旗標保留課程,credential 失效與否待 M2
  假定 一位帶 can_create_course 的老師有 CLI credential 與既有課程
  當 系統管理員移除該帳號的 can_create_course
  那麼 既有課程、題目與歷史結果不刪除
  而且該老師不能再建立新課程
  而且相關 CLI credential 是否同步失效待 M2 於 Web Auth 設計定案
```

## US-F17 學員與老師看到符合題型的即時結果呈現

> 身為學員,我想在作答後看到符合題型的即時結果呈現(投票為長條圖、問答為文字列表／文字雲、測驗為長條圖並標示正確答案),以便直觀理解全班回答分布;身為老師,我想在投票開放中即時看到統計圖與已投／加入人數,但看不到個別學員答案。

> [!note] 規則來源
> [[需求蒐集]] BR-08、BR-16、BR-17、US-02(AC-02-04、AC-02-05)、US-03(AC-03-04、AC-03-05、AC-03-07、AC-03-08)。vote-to-reveal 與逐題控制的狀態規則已由 [[P0 核心需求基線]] 涵蓋,但**題型對應的呈現方式**與**老師端即時彙總視角**未被基線重述,於本 SPEC 補齊。問答題呈現是否切換文字列表／文字雲仍為 [[需求蒐集#仍待 M2 或產品細節確認]] 的待確認項。

### Rules

- R-F17-1　學員 SHALL 須先送出自己答案(vote-to-reveal)才能看到該題即時彙總;未作答者於題目 open 時 SHALL 看不到受限制彙總。
- R-F17-2　老師關閉題目時,該題統計 SHALL 自動公布為全班可見(含未投者),無需獨立「公布」操作。
- R-F17-3　Poll 題統計圖 SHALL 為長條圖。
- R-F17-4　Open text 題 SHALL 呈現為文字列表／文字雲(是否可切換待確認,MUST NOT 影響 `open_text` domain schema)。
- R-F17-5　Quiz 題統計圖 SHALL 為長條圖並標示正確答案。
- R-F17-6　題目 open 期間,老師端 SHALL 即時顯示統計圖與已投／加入人數。
- R-F17-7　老師端 SHALL NOT 看個別學員答案(匿名彙總)。

### Scenarios

```gherkin
# happy path — poll 長條圖
Scenario: 學員投票後看到 poll 長條圖即時彙總
  假定 一個 active LiveSession 且一個 poll SessionQuestion 處於 open
  而且 一位學員尚未提交該題
  當 該學員送出自己的答案
  那麼 該學員解鎖看到全班 poll 即時彙總
  而且彙總以長條圖呈現

# happy path — quiz 長條圖標正確答案
Scenario: 學員作答後看到 quiz 長條圖並標示正確答案
  假定 一個 active LiveSession 且一個 quiz SessionQuestion 處於 open
  當 學員送出自己的答案
  那麼 該學員看到全班 quiz 即時彙總
  而且彙總以長條圖呈現並標示正確答案

# happy path — open text 文字列表
Scenario: 學員作答後看到 open text 文字列表彙總
  假定 一個 active LiveSession 且一個 open text SessionQuestion 處於 open
  當 學員送出自己的答案
  那麼 該學員看到全班 open text 即時彙總
  而且彙總以文字列表呈現

# boundary — 未作答者看不到彙總
Scenario: 未作答學員在題目 open 時看不到即時彙總
  假定 一個 poll SessionQuestion 處於 open 且採 vote-to-reveal
  而且 某學員尚未提交該題答案
  當 其他學員陸續提交
  那麼 該未作答學員看不到受限制的即時彙總

# boundary — 關題自動公布全班
Scenario: 老師關題時統計自動公布為全班可見
  假定 一個 poll SessionQuestion 處於 open 且有部分學員未作答
  當 老師 close 該題
  那麼 該題統計自動公布為全班可見(含未投者)
  而且無需老師執行獨立的「公布」操作

# boundary — 老師端即時彙總但匿名
Scenario: 老師端即時看到統計圖與已投人數但不看個別答案
  假定 一個 active LiveSession 且一個 SessionQuestion 處於 open
  當 學員陸續提交答案
  那麼 老師端即時顯示統計圖與已投／加入人數
  而且老師端不看個別學員答案(僅匿名彙總)
```

## Acceptance Criteria

> AC spine 追溯至 [[需求蒐集]] 原始 AC 與 BR(非 P0-01～P0-05 基線 AC)。

| AC ID(來源) | 對應 Rules | 覆蓋 Scenario | 來源錨點 |
|---|---|---|---|
| AC-01-02、AC-01-03、BR-01 | R-F16-1, R-F16-2 | 授權/未授權帳號建立課程 | [[需求蒐集#角色與帳號模型]] |
| AC-02-01、BR-01 | R-F16-3, R-F16-4 | 授權帳號自動成為唯一老師 | [[需求蒐集#US-02 老師建立課程與互動題目]] |
| BR-01 | R-F16-5 | 移除旗標使 credential 失效但保留課程 | [[P0 核心需求基線#角色與帳號狀態]] |
| AC-02-04、AC-02-05 | R-F17-1, R-F17-3 | poll vote-to-reveal 長條圖 | [[需求蒐集#課程與互動題目機制]] |
| AC-03-04、AC-03-05 | R-F17-5 | quiz 長條圖標正確答案 | [[需求蒐集#課程與互動題目機制]] |
| AC-03-07、AC-03-08、BR-08 | R-F17-4 | open text 文字列表 | [[需求蒐集#課程與互動題目機制]] |
| BR-16、BR-17 | R-F17-2, R-F17-6, R-F17-7 | 關題自動公布、老師端即時匿名彙總 | [[需求蒐集#課程與互動題目機制]] |

## Test Plan

| Scenario | 測試層級 | 狀態 | 備註 |
|---|---|---|---|
| 帶可開課旗標的老師建立課程並自動成為該課老師 | integration | [ ] 待 M3 | 旗標檢查 + 自動老師 |
| 未授權可開課的帳號建立課程被拒 | integration | [ ] 待 M3 | 授權閘拒絕 |
| 系統管理員在帳號上切換可開課旗標 | integration | [ ] 待 M3 | 旗標切換 |
| 移除可開課旗標保留課程,credential 失效與否待 M2 | integration | [ ] 待 M3 | 資料保留 + credential 失效待 M2 |
| 學員投票後看到 poll 長條圖即時彙總 | integration | [ ] 待 M3 | vote-to-reveal + 長條圖 |
| 學員作答後看到 quiz 長條圖並標示正確答案 | integration | [ ] 待 M3 | quiz 長條圖標正解 |
| 學員作答後看到 open text 文字列表彙總 | integration | [ ] 待 M3 | 文字列表(切換待確認) |
| 未作答學員在題目 open 時看不到即時彙總 | integration | [ ] 待 M3 | vote-to-reveal 限制 |
| 老師關題時統計自動公布為全班可見 | integration | [ ] 待 M3 | 關題自動公布 |
| 老師端即時看到統計圖與已投人數但不看個別答案 | integration | [ ] 待 M3 | 老師端匿名彙總 |

> [!warning] 紅卡阻擋
> Open text 題結果以文字列表、文字雲或兩者切換呈現待產品/M2 確認;詳見 [[#Red cards]]。

---

## Red cards(待確認,阻擋開發前須解決)

| 紅卡 | 指派 | 期限 | 來源 |
|---|---|---|---|
| Bootstrap 具體命令與秘密傳遞方式? | M2 | M2 定案 | [[P0 核心需求基線#帳號建立與首位管理員]] |
| Web Session 具體 session 儲存與 cookie 值形式? | M2 | M2 定案 | [[P0 核心需求基線#登入、登出與 Web Session]] |
| 密碼安全雜湊演算法與參數? | M2 | M2 定案 | [[P0 核心需求基線#密碼規則與復原]]、[[技術棧]] |
| QuestionDefinition、Option、SessionQuestion 的儲存模型與排序併發控制? | M2 | M2 定案 | [[題目領域契約#M2 設計輸入]] |
| Validation token、payload hash、transaction 與 idempotency 的具體設計? | M2 | M2 定案 | [[題目領域契約#M2 設計輸入]] |
| 正式 wire schema 與版本相容策略? | M2 | M2 定案 | [[題目領域契約#M2 設計輸入]] |
| Participant token 格式、保存方式與重連 protocol? | M2 | M2 定案 | [[P0 核心需求基線#M2 設計輸入清單]] |
| Submission idempotency、unique constraint、transaction isolation 的具體實作? | M2 | M2 定案 | [[P0 核心需求基線#M2 設計輸入清單]] |
| LiveSession 8 小時自動 closed 的可靠排程實作? | M2 | M2 定案 | [[P0 核心需求基線#M2 設計輸入清單]] |
| Open text 題結果以文字列表、文字雲或兩者切換呈現? | 產品/M2 | M2 前 | [[需求蒐集#仍待 M2 或產品細節確認]] |
| 移除 `can_create_course` 旗標是否同步使相關 CLI credential 與未使用 token 失效? | M2 | M2 定案 | R-F16-5(本 SPEC 審查修正派生);P0 基線 credential 失效觸發見 [[P0 核心需求基線#角色與帳號狀態]] |

> [!warning] 不得帶著紅卡進入開發
> 上述 M2 設計輸入未定案前,對應場景可起草但不得據以實作;實作採用前必須由 M2 設計文件補齊。

## 需求追蹤

| User Story | SPEC | P0 | 對應 AC | 現行規範 | 效能檔對應 |
|---|---|---|---|---|---|
| US-F0 老師建立課程 | SPEC-001 | —(未編 P0) | AC-02-01、BR-01、BR-02、BR-03 | [[需求蒐集#US-02 老師建立課程與互動題目]]、[[P0 核心需求基線#Course 生命週期]] | — |
| US-F1 Course 生命週期(封存與 archived) | SPEC-001 | P0-01 | P0-01-AC-01、AC-04 | [[P0 核心需求基線#Course 生命週期]] | — |
| US-F2 LiveSession 生命週期 | SPEC-001 | P0-01 | P0-01-AC-02、AC-03、AC-05、AC-06 | [[P0 核心需求基線#LiveSession 生命週期]] | [[MVP 效能需求 BDD 場景#US-P7 場次逾 8 小時自動關閉(W8)]] |
| US-F3 session code | SPEC-002 | P0-02 | P0-02-AC-01～AC-03 | [[P0 核心需求基線#Session code]] | — |
| US-F4 題目重用快照 | SPEC-002 | P0-02 | P0-02-AC-04～AC-06 | [[P0 核心需求基線#題目重用與快照]] | — |
| US-F5 帳號建立與 bootstrap | SPEC-003 | P0-03 | P0-03-AC-01、AC-02、AC-09 | [[P0 核心需求基線#帳號建立與首位管理員]] | — |
| US-F6 登入登出與 Session | SPEC-003 | P0-03 | P0-03-AC-03、AC-04、AC-05 | [[P0 核心需求基線#登入、登出與 Web Session]] | — |
| US-F7 密碼規則與復原 | SPEC-003 | P0-03 | P0-03-AC-06、AC-07 | [[P0 核心需求基線#密碼規則與復原]] | — |
| US-F8 帳號停用與 credential 失效 | SPEC-003 | P0-03 | P0-03-AC-03、AC-08 | [[P0 核心需求基線#角色與帳號狀態]] | — |
| US-F9 題型語意 | SPEC-004 | P0-04 | P0-04-AC-01、AC-02、AC-07、AC-08 | [[題目領域契約#題型規則]] | — |
| US-F10 validation 與批次 | SPEC-004 | P0-04 | P0-04-AC-03、AC-04、AC-05 | [[題目領域契約#共用 validation]] | — |
| US-F11 批次預覽確認 | SPEC-004 | P0-04 | P0-04-AC-05、AC-06 | [[題目領域契約#Web／CLI 批次 command]] | — |
| US-F12 匿名 Participant | SPEC-005 | P0-05 | P0-05-AC-01、AC-02、AC-08 | [[P0 核心需求基線#匿名 Participant]] | — |
| US-F13 重連恢復狀態 | SPEC-005 | P0-05 | P0-05-AC-03、AC-07 | [[P0 核心需求基線#重連]] | [[MVP 效能需求 BDD 場景#US-P3 學員斷線後快速重連恢復狀態(W4)]] |
| US-F14 idempotency 與唯一性 | SPEC-005 | P0-05 | P0-05-AC-04、AC-05、AC-07 | [[P0 核心需求基線#Submission 與 idempotency]] | [[MVP 效能需求 BDD 場景#US-P6 網路不穩時安全重送不產生重複答案(W7)]] |
| US-F15 關題競態 | SPEC-005 | P0-05 | P0-05-AC-06、AC-07 | [[P0 核心需求基線#Submit／close 競態]] | [[MVP 效能需求 BDD 場景#US-P5 關題與提交競態下依伺服器權威順序判定(W6)]] |
| US-F16 開課授權旗標(管理員視角) | SPEC-006 | —(未編 P0) | AC-01-02、AC-01-03、BR-01 | [[需求蒐集#角色與帳號模型]]、[[P0 核心需求基線#角色與帳號狀態]] | — |
| US-F17 結果統計圖呈現 | SPEC-006 | —(未編 P0) | AC-02-04、AC-02-05、AC-03-04、AC-03-05、AC-03-07、AC-03-08、BR-08、BR-16、BR-17 | [[需求蒐集#課程與互動題目機制]] | — |

> [!note] P0-05-AC-07 補正
> 原 BDD 需求追蹤表未列 `P0-05-AC-07`(終止/8 小時後拒絕加入、重連、新 Submission)。本 SPEC 補列於 US-F13、US-F14、US-F15,對應 R-F13-3 與 R-F14-6。

## Three Amigos 視角對照

| 場景 | Problem Owner(PO／BA) | Problem Solver(Dev) | Skeptic(Tester／QA) |
|---|---|---|---|
| US-F0 老師建立課程 | 被授權的老師能建立課程成為唯一老師 | 建立時檢查 can_create_course 並自動指定唯一老師 | 未授權帳號被拒、不支援共同授課或移轉 |
| US-F2 場次生命週期 | 老師能控制每場開始與結束 | 狀態轉移須強制不可逆與單場限制 | 驗證 cancelled 須無答案、closed 後全拒、第二場被拒 |
| US-F6 Web Session | 使用者安全登入且閒置自動失效 | cookie 須 Secure／HttpOnly／SameSite 且可撤銷 | 驗證 30 分鐘／8 小時失效、改密碼與停用使 Session 立即失效 |
| US-F9 題型語意 | 老師依題型建立題目 | 依題型嚴格檢查 required／allowed／forbidden 欄位 | 對 poll／open_text／quiz 各自的禁止欄位與缺失欄位驗證 error |
| US-F15 競態 | 關題瞬間已提交答案算數 | 以伺服器 commit 順序為權威 | 涵蓋提交先、關題先、timeout、WebSocket 不一致、自動關閉五情境 |
| US-F16 開課授權 | 只有被授權的老師能開課 | 旗標為帳號層級,建立課程時檢查並自動成為老師 | 未授權帳號被拒、移除旗標使 credential 失效但保留課程 |
| US-F17 結果呈現 | 學員作答後看到符合題型的彙總 | 依題型渲染長條圖／文字列表並標示 quiz 正確答案 | 驗證未作答者看不到、關題自動公布全班、老師端匿名彙總 |

## 三方審查紀錄

> [!success] 審查結論:PASS_WITH_FINDINGS
> 2026-08-14 完成三方審查(PO/BA、Dev、QA)。無 blocking 項,1 major + 5 minor 已全數修正後升 `status: active`。審查方式:逐條比對 SPEC Rules ↔ [[P0 核心需求基線]]/[[題目領域契約]]/[[需求蒐集]] 上游原文,並對照 [[M2 系統分析與設計交付計畫]] 紅卡閉環與 [[技術棧]] 已定案技術。

### 修正項

| 視角 | 嚴重 | 位置 | 問題 | 修正 |
|---|---|---|---|---|
| PO/BA + Dev | major | R-F16-5 | 「移除 `can_create_course` 使 CLI credential 立即失效」超出 P0 基線三個失效觸發,屬設計層而非需求層 | 弱化 MUST 為「待 M2 於 Web Auth 設計確認」;對應 scenario 與 Test Plan 同步修改;新增 Red card 追蹤 |
| PO/BA | minor | 範圍 callout | 只排除 P0-07,未說 P0-06(結果治理)涵蓋範圍 | 補 P0-06 邊界聲明,明確不重定義 retention 規則 |
| PO/BA | minor | SPEC-006 | CLI/Agent 建題未升級 SPEC-NNN,規格不對稱 | 加 note 註明刻意以 [[CLI Agent 建題 BDD 場景]] 為權威,本 SPEC 僅在交界引用 |
| Dev | minor | R-F0-3/R-F0-5/R-F0-6 vs R-F1-1/R-F1-2/R-F16-4 | 字面重複規則未標 cross-ref | 在 R-F0 條加 cross-ref 註明建立者 vs 維護/管理員視角分工 |
| QA | minor | Test Plan「跨裝置」 | 「跨裝置不保證同一 participant」為非確定限制,無法自動測 | 測試層級標 `integration（manual）` 並備註 |

### 未修正項(刻意保留,非缺陷)

- US-F0/US-F16 的 can_create_course 規則分屬建立者與管理員視角,各自 AC spine 追蹤不同來源,不合併。
- 10 張既有 Red card 均為 M2 可消解的設計輸入,非需求歧義,不回需求層。
- open text 呈現紅卡維持「產品/M2、非阻擋」歸屬,與 M2 計畫一致。

## 相關連結

- 本 SPEC 推導來源(BDD 場景證據層):[[功能需求 BDD 場景]]
- 核心需求與 ubiquitous language:[[P0 核心需求基線]]
- 題目共用語意:[[題目領域契約]]
- 效能 BDD 場景(負載視角):[[MVP 效能需求 BDD 場景]]
- CLI／Agent 建題 BDD 場景:[[CLI Agent 建題 BDD 場景]]
- BDD 場景關聯圖:[[BDD 場景關聯圖]]
- 結果歸檔與保留:[[結果資料治理]]
- 效能門檻:[[MVP 效能目標]]
- 原始需求與既有 AC:[[需求蒐集]]
- 專案首頁:[[智學互動平台]]
- 技術選型:[[技術棧]]