# 智學互動平台 — 系統分析領域詞彙表（權威版）

本詞彙表彙整自 `10_需求蒐集/系統功能規劃書 V1.2` 與 `20_系統分析/M01–M11` 使用者需求與驗收規格，為系統設計、契約撰寫與雛形製作的**唯一用語基準**。對同一概念有不同寫法時，本表一律採 opinionated 正名，其餘寫法列於 _Avoid_。規劃書層級的原始詞彙另見 `../10_需求蒐集/GLOSSARY.md`。

## Language

### 角色與身分

**系統管理者 (System Administrator, `SYSTEM_ADMIN`)**:
平台兩個正式角色之一，負責帳號、角色、功能授權與系統設定；不因角色自動取得授課能力。
_Avoid_: 管理者、授權管理者

**老師 (Teacher, `TEACHER`)**:
平台兩個正式角色之一，維護自己的題庫、建立並主持教學活動、檢視自己的報表。
_Avoid_: 講師（Instructor 僅保留於產品定位語「Instructor-Led」）

**學員 (Learner)**:
以臨時身分加入單場教學活動的參與者，不需正式帳號，不納入角色管理。
_Avoid_: 學生、參賽者

**參與者 (Participant)**:
系統在單一活動範圍內唯一識別的臨時參與實體；「學員」是人、「參與者」是活動內身分。
_Avoid_: 臨時參與者、有效參與者

**使用者 (User)**:
持有正式帳號的登入者（系統管理者或老師）。
_Avoid_: 泛指學員時使用

**操作者 (Acting User)**:
執行某項操作、供權限與資源範圍檢查所指涉的使用者。

**有效角色 (Valid Role)**:
帳號啟用、角色狀態啟用、且 `USER_ROLE` 指派有效，三者同時成立的角色。
_Avoid_: 啟用角色、有效指派角色

**最後有效系統管理者 (Last Effective System Administrator)**:
平台至少保留一位的最後可執行管理能力的系統管理者。
_Avoid_: 最後管理者、核心管理能力

### 帳號、登入與憑證

**帳號 (Account, `USER_ACCOUNT`)**:
以已驗證且唯一 Email 登入的正式系統帳號。
_Avoid_: 混用「使用者」

**帳號名稱 (Account Name)**:
老師帳號的必填、全平台唯一管理欄位，不作登入識別。

**登入識別 (Login Identifier)**:
正式帳號登入用的唯一識別；V1 為已驗證且唯一的 Email。

**帳號狀態 (Account Status)**:
老師帳號生命週期狀態：`INVITED`（已邀請）、`ACTIVE`（啟用）、`DISABLED`（停用）。

**邀請 (Invitation) / 一次性連結 (One-time Link)**:
建立老師帳號後寄送的一次性啟用連結，7 天有效，重發時舊連結立即失效。

**密碼重設 (Password Reset)**:
以 Email 一次性連結（30 分鐘有效）設定新密碼的流程。

**登入 Session (Login Session)**:
使用者登入後的驗證工作階段；閒置 30 分鐘或登入後 24 小時逾時。
_Avoid_: 裸用「Session」指教學活動

**登入憑證 (Login Credential)**:
Session 或 Token 的合稱，受停用、登出時立即撤銷。
_Avoid_: 裸用「憑證」

**撤銷 (Revoke)**:
使既有登入憑證立即失效的動作（登出、停用、密碼變更等）。

**權限快照 (Permission Snapshot)**:
登入憑證建立時記錄的授權狀態；權限變更須重新登入後套用。

**個人資料 (Personal Profile)**:
使用者本人維護的姓名、Email、聯絡電話；與管理者維護的老師基本資料（`TEACHER_PROFILE`）分開。

**帳號枚舉 (Account Enumeration)**:
從登入或重設密碼回應推斷帳號是否存在的風險；回應不得洩露。

### 角色、權限與授權

**權限 (Permission)**:
權限目錄中的穩定授權單位，以模組讀取／寫入為單位（如 `M05_WRITE`）。
_Avoid_: 功能權限、模組權限（指判定「結果」時改用「授權」）

**權限目錄 (Permission Catalog)**:
系統維護的權限清單；未列入者預設拒絕。
_Avoid_: 功能清單（僅為畫面名稱）

**角色—功能對應 (Role–Permission Mapping, `ROLE_PERMISSION`)**:
角色與權限之間的授權關聯，由 M04 以完整權限集合一次提交維護。
_Avoid_: 角色功能授權、功能授權摘要

**帳號角色指派 (Role Assignment, `USER_ROLE`)**:
帳號與角色的多對多關聯；維護入口為 M03。
_Avoid_: 使用者角色指派

**固定系統角色 (Fixed System Role)**:
V1 僅 `SYSTEM_ADMIN`、`TEACHER`；代碼不可修改、角色不可刪除。
_Avoid_: 系統保留角色

**有效授權 (Effective Authorization)**:
帳號啟用、憑證有效、有效角色與角色—功能對應同時成立的授權結果；多角色採聯集，無 deny 覆寫。

**資源擁有者 (Resource Owner)**:
題庫等資源歸屬的老師；每次請求都須檢查擁有者範圍。

**主持老師 (Host Teacher / `SESSION_HOST`)**:
特定教學活動的主持者，僅其可控制該活動的題目、公布、分組與模式。
_Avoid_: 活動擁有者、活動主持者混合命名

**前端選單過濾 (Frontend Menu Filtering)**:
依有效權限隱藏選單，僅為使用體驗，不構成安全邊界。

**最小權限 (Least Privilege)**:
角色預設只授予職責所需的最小權限。

### 題庫與題目

**題庫 (Question Bank, `QUESTION_SET`)**:
老師擁有、可跨活動重複使用的題目集合。
_Avoid_: 教材

**主題 (Topic)**:
每個題庫至多一個的分類欄位。
_Avoid_: 課程主題（泛稱）；實體無「課程」

**標籤 (Tag)**:
老師自訂、僅用於本人題庫的分類標記。

**題目 (Question, `QUESTION`)**:
題庫中的單一問題，含題幹、選項與答案。

**題幹 (Question Stem)**:
題目的敘述文字，必填且不可為空白。

**選項 (Option)**:
題目的作答選項；同一題內不得重複。

**正確答案 (Correct Answer, 標準答案)**:
單選／多選題中判定對錯的既定答案，由老師決定何時公布。
_Avoid_: 正解、答案

**題型 (Question Type)**:
單選、多選、投票、開放式文字四類。

**單選題 (Single-choice Question)**:
僅一個正確答案、至少兩個非空選項。

**多選題 (Multiple-choice Question)**:
一個以上正確答案、正確率須全對才算對。

**投票題 (Poll Question)**:
無標準答案、預設不計分的意見徵集題型。
_Avoid_: 意見投票

**開放式文字題 (Open-ended Text Question)**:
學員自由輸入文字、不設自動判分的題型；其提交內容稱文字回饋。
_Avoid_: 自由文字、文字題

**計分題 (Scored Question)**:
納入計分與資格的題目；首道計分題開放即觸發模式鎖定。

**知識測驗題 (Knowledge Quiz Question)**:
有標準答案、可算正確率並可計分的題型。

**軟刪除 (Soft Delete)**:
題庫標記已刪除、自清單隱藏但可由擁有者復原；實體清除須經資料治理流程。
_Avoid_: 與帳號「停用」混淆

**題庫複製 / 副本 (Question Set Copy / Copy)**:
複製自己題庫成為獨立副本，修改或刪除不影響來源。

**題目快照 (Question Snapshot, `SESSION_QUESTION`)**:
活動建立時保存的不可變題目副本，事後改題庫不影響歷史結果。
_Avoid_: 歷史題目快照、活動題目快照

**題序 (Question Sequence)**:
活動內題目快照的既定順序；老師只能逐題前進，不得跳題或返回。

### 教學活動與生命週期

**教學活動 (Teaching Activity)**:
老師建立並主持的一場課堂互動單元，含題目快照、參與者與結果。
_Avoid_: 場次、教學 Session、Session

**活動狀態 (Activity Status)**:
尚未開始（Not Started）、進行中（In Progress）、已結束（Ended）三態；「歷史活動」即已結束。
_Avoid_: 活動終止

**開始活動 (Start Activity)**:
老師啟動活動進入進行中的操作，不等同開放任何題目。
_Avoid_: 啟動教學 Session

**結束活動 (End Activity)**:
老師結束活動並保留結果的操作；不可恢復。
_Avoid_: 結束 Session、活動終止

**活動設定 (Activity Settings)**:
暱稱、匿名、計分、排行榜等活動層級選項。

**主辦單位 (Organizer)**:
建立活動時的選填欄位，標示主辦方；與 M11 的「組織」關係待契約定義。

**活動擁有者範圍檢查 (Owner-scope Check)**:
後端每次請求依主持老師／擁有者驗證的資源層級授權，而非只驗證角色。

### 加入、身分與即時互動

**加入資訊 (Join Information)**:
Game PIN、QR Code 與活動連結的合稱，僅在活動允許加入期間有效。

**Game PIN (Game PIN)**:
6 位數字（允許前導 0）的加入碼，於全平台仍允許加入的活動間唯一。

**活動允許加入期間 (Join Window)**:
加入資訊有效、系統仍接受學員加入的期間；起訖條件待平台契約定義。

**參與者憑證 (Participant Credential)**:
系統核發、不可猜測的匿名持久憑證，用於恢復同一活動內的參與者身分；與加入資訊不同。
_Avoid_: 活動憑證（泛稱）、重連憑證、加入憑證

**重連 (Reconnection)**:
短暫斷線後以參與者憑證恢復原身分與活動狀態；不得建立重複參與者、作答或計分。

**暱稱 (Nickname)**:
學員自行輸入、可缺席的活動內顯示名稱來源；不作唯一鍵。

**顯示名稱 (Display Name)**:
暱稱缺席時系統分配的活動內名稱；不得作為唯一鍵，與暱稱為兩個概念。

**匿名模式 (Anonymous Mode)**:
老師端與投影不顯示個資、但系統仍保留活動內識別能力的顯示設定。

**等候 (Waiting)**:
學員已加入但活動未啟動或無開放題目的狀態。

**在線 (Online)**:
最近 60 秒內收到有效心跳的參與者狀態。

**作答資格 (Answering Eligibility)**:
參與者符合特定題目參與條件的狀態；與在線、已加入是不同概念。

**開放作答 (Open Answering)**:
老師發送題目並允許學員提交答案的狀態轉換。

**停止作答 (Close Answering)**:
關閉目前題目的答題階段、不再接受新有效答案。
_Avoid_: 關閉作答、結束答題階段

**作答倒數 (Answer Countdown)**:
老師可選的作答時限；到期只停止作答，不代表結算完成。

**下一題 (Next Question)**:
依題序切換至下一題。

**有效提交 (Valid Submission)**:
伺服器成功接受、可納入統計或計分的答案。
_Avoid_: 泛用「答案」

**最後成功提交 (Last Successful Submission)**:
開放期間多次更新時，以最後一筆通過的提交為準。

**公布 (Publish)**:
老師明確向學員或投影揭曉某項結果的動作；一經公布不可撤回。
_Avoid_: 發布、公開

**公布統計 (Publish Statistics)**:
向學員僅顯示答案分布的公布操作；與公布正確答案分別控制。

**公布正確答案 (Publish Correct Answer)**:
僅適用有標準答案題型的公布操作。

**公布排行榜 (Publish Leaderboard)**:
老師決定是否及何時公開已啟用排行榜。

**投影 (Projection) / 投影畫面 (Projection Screen)**:
大螢幕呈現當前題目、已公布結果或 Join QR Code 的輸出。
_Avoid_: 投影統計

**安全待機畫面 (Safe Standby Screen)**:
投影與即時服務失聯時顯示、避免呈現過期或未授權資料的畫面。

**控制端租約 (Control Lease)**:
同一活動同一時間僅一個瀏覽器控制台可持有的控制權憑證；細節待平台契約。

**模式狀態提示 (Mode Status Indicator)**:
控制台顯示目前分組模式、排行榜模式與鎖定狀態的提示。

**活動監控 (Activity Monitoring)**:
系統管理者查詢進行中活動與彙總連線狀態的功能；不提供活動控制。

### 計分、統計與排行榜

**即時統計 (Real-time Statistics)**:
活動進行中依有效提交計算的作答狀況與測驗表現（教師端範圍）。

**統計可查 (Statistics Available)**:
統計已可供查詢，但不代表已公布給學員的中間狀態。

**結算完成 (Settlement Complete)**:
統計或團隊結算已就緒、可供公布或進入下一題的狀態。

**處理中 (Processing)**:
統計或結算尚未完成時的回覆狀態，不得視為就緒。

**答案分布 (Answer Distribution)**:
各選項的有效作答人數及以有效作答為分母的比例。
_Avoid_: 答題分布

**作答人數 (Answered Count) / 未作答人數 (Non-answered Count)**:
該題有效作答的人數，與具資格但未作答的人數。

**正確率 (Accuracy Rate)**:
完全答對人數 ÷ 題目資格快照人數；未作答計為錯誤。

**作答完成率 (Completion Rate)**:
有效作答人數 ÷ 題目資格快照人數。

**活動摘要 (Activity Summary)**:
逐題與整體正確率、完成率及文字回饋提交數的彙總。

**個人得分 (Individual Score)**:
每題答對 100、其餘 0、等權重累加的個人分數。
_Avoid_: 個人分數、積分

**隊伍得分 (Team Score)**:
該題具資格隊員得分總和 ÷ 該題有效人數的隊伍分數。
_Avoid_: 團隊得分、團隊分數、隊伍分數

**團隊結算 (Team Settlement)**:
依資格快照固定隊伍分數、每題每隊至多一筆紀錄的程序。

**排行榜 (Leaderboard)**:
依分數排序的名次清單；僅於相容模式啟用且老師公布後顯示。
_Avoid_: 排名（指榜單時）

**個人排行榜 / 隊伍排行榜 (Individual / Team Leaderboard)**:
分別對應 `leaderboard_mode` 為 `INDIVIDUAL`／`TEAM` 的榜單。
_Avoid_: 個人排名、團隊排名

**競賽排名 (Competition Ranking)**:
同分並列且後續跳號（1、1、3）；個人排行榜採用。

**密集排名 (Dense Ranking)**:
同分並列且後續不跳號（1、1、2）；隊伍排行榜採用。

**並列名次 (Tied Rank)**:
總分相同顯示相同名次，不使用未公告的決勝規則（如速度加分）。

**報表 (Report / 活動彙總報表)**:
授權老師查詢的活動成果統計視圖。
_Avoid_: 彙總報表、教學報表

**去識別化 (De-identification)**:
授權報表對外呈現時移除可識別個資的形式。

**標準化成績 (Normalized Score)**:
P1 組織排行榜依具資格人數標準化後加總的組織彙總成績。

### 分組與競賽

**分組模式 (Grouping Mode, `grouping_mode`)**:
`INDIVIDUAL`（不分組）或 `TEAM`（分組）；新活動預設 `INDIVIDUAL`。
_Avoid_: 活動參與模式
（注意：`INDIVIDUAL`／`TEAM` 在 `leaderboard_mode` 語意不同，書寫一律寫全名，禁止裸用代碼）

**排行榜模式 (Leaderboard Mode, `leaderboard_mode`)**:
`NONE`、`INDIVIDUAL` 或 `TEAM`，須與分組模式相容；預設 `NONE`。
_Avoid_: 排名模式、排行設定

**模式相容性 (Mode Compatibility)**:
僅允許 `INDIVIDUAL`+`NONE/INDIVIDUAL` 與 `TEAM`+`NONE/TEAM` 的組合規則。

**模式鎖定 (Mode Lock)**:
確認分組或開放首道計分題後，分組與排行榜模式不可再變更的狀態。
_Avoid_: 鎖定（裸用）

**隊伍 (Team)**:
單一活動內的合作／競賽單位，僅 `TEAM` 模式存在。
_Avoid_: 組、團隊（「團隊」僅保留於既有複合詞如「團隊競賽」）

**隊員 (Team Member)**:
被編入隊伍的學員；同一有效學員同時至多屬於一個有效隊伍。

**分組確認 (Grouping Confirmation)**:
老師確認隊伍安排、系統即原子鎖定隊伍與模式的事件。

**重建分組 (Unlock / Rebuild Grouping)**:
首道計分題開放前，由主持老師依明確流程解鎖並重新安排成員的複合操作。

**資格快照 (Question Eligibility Snapshot)**:
題目開放作答時固定的具作答資格名單，作為計分與統計分母。
_Avoid_: 有效人數快照、作答資格快照

**有效學員 (Eligible Learner)**:
符合活動參與與分組資格、可被分配隊伍或計分的學員。
_Avoid_: 有效參賽者、有效人數（用於分母時改稱「資格快照人數」）

**遲到者 (Late Joiner)**:
計分題開放後才加入、僅能參與後續尚未開放且具資格計分題的學員。

**旁聽 (Observer)**:
所有計分題均已開放或結束後才加入、可接收資訊但不具計分資格的學員。

**隨機分組 (Random Grouping)**:
有效學員隨機洗牌後儘量平均分配；任兩隊人數差至多 1。

**活動容量 (Activity Capacity)**:
每場活動最多 300 位有效學員、10 隊的上限。

**組織 (Organization)**:
P1 概念：公司、協會或公益團體，為組織間競賽的比較單位；不可與隊伍混同。

**組織代碼 (Organization Code)**:
P1 活動專屬代碼，學員輸入以標記組織歸屬。

**組織間競賽 (Inter-organization Competition)**:
P1 僅比較授權同場活動組織標準化成績、不開放跨組織原始資料的競賽型態。
_Avoid_: 組織競賽

**競賽摘要 (Competition Summary)**:
各隊與各組織總得分、表現與有效人數的摘要（P1）。

### 系統設定與監控

**系統參數 (System Parameters)**:
活動預設值與登入 Session 逾時兩類全域設定。

**活動預設值 (Activity Defaults)**:
新建活動套用的系統參數；變更不回溯既有活動。

**彙總連線狀態 (Aggregated Connection Status)**:
活動層級、不含個別參與者明細的連線摘要。

**未知 (Unknown)**:
連線狀態過期或來源暫時無法取得時的標示，不得呈現為即時正常。

**批次更新 (All-or-nothing Batch Update)**:
系統參數批次更新時版本不符即全數拒絕並要求重新讀取。

**冪等識別碼 (Idempotency Key)**:
批次或重送請求的唯一識別碼；同識別碼重送回傳原結果，不重複執行。

## 用語規則（書寫守則）

1. **禁止裸用「Session」**：一律寫「登入 Session」或「教學活動」；「教學 Session」「結束 Session」為舊文殘留，勿再使用。
2. **禁止裸用 `INDIVIDUAL`／`TEAM`**：一律寫全名 `grouping_mode=INDIVIDUAL`、`leaderboard_mode=TEAM`。
3. **禁止裸用「憑證」**：一律加限定詞（登入憑證／邀請連結／參與者憑證）。
4. **「停用／啟用」須帶對象**：帳號停用、角色停用、權限未啟用是三種不同後果。
5. **公布 ≠ 統計可查**：統計先「可查」（內部就緒），經主持老師「公布」才向學員顯示，且公布不可撤回。
6. **「參賽者」不再使用**：泛稱時用「學員／參與者」；強調計分資格時用「有效學員」。

## 待決議事項影響的用語

以下用語在本表為佔位定義，**完整判準以平台／跨模組契約為準**（見 `待決議事項與選項.md`）：控制端租約、活動允許加入期間、活動狀態完整狀態機、作答資格完整判準、有效提交去重語意、在線／心跳細節、參與者憑證格式、活動預設值與逾時核准值、組織參賽資格、學員端結果可見期限。