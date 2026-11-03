# ER 模型設計 — 智學互動平台（Coad 交易樣式建模）

> 詞彙一律依 `../20_系統分析/GLOSSARY.md`（權威版）。資料庫：PostgreSQL。
> 完整欄位定義與每欄位 DB 註解見 `er_model_postgresql.sql`（COMMENT ON）。

## 一、原型分類表（Peter Coad 四色原型／交易樣式）

### [Transaction] — moment-interval（粉紅）
| 類別 | 表 | 說明 |
|---|---|---|
| 帳號邀請／重設 | `one_time_link`（type=INVITATION/PASSWORD_RESET/EMAIL_VERIFICATION） | 一次性連結事件，7 天／30 分鐘有效、重發即失效 |
| 登入 Session | `login_session` | 登入後工作階段；含權限快照 |
| 教學活動 | `teaching_session` | 老師建立並主持的課堂互動單元（NOT_STARTED→IN_PROGRESS→ENDED） |
| 加入交易 | `session_join_info` | Game PIN + QR/連結一組，輪替世代管理 |
| 作答提交 | `response` | 學員有效提交；最後成功提交為準、冪等重送 |
| 作答資格快照 | `question_eligibility_snapshot` | 計分題開放時固定的資格名單（統計分母） |
| 團隊結算 | `team_score_ledger` | 每題每隊至多一筆有效結算，冪等鍵 |
| 公布 | `publish_log` | 公布統計／正解／排行榜；更正版本鏈 |
| 控制租約 | `control_lease` | 同一活動同時唯一有效控制權 |
| 批次操作 | `batch_operation` | M03 批次管理，全有全無＋冪等 |
| 匯出（P1） | `export_job` | CSV/XLSX 報表匁出 |

### [Line-Item] — moment-interval detail（粉紅）
| 表 | 屬於 | 快照欄位 |
|---|---|---|
| `login_session` 的權限快照欄 | login_session（內嵌 jsonb snapshot） | 角色-權限集合 |
| `session_question` / `session_question_option` | teaching_session（composition） | 題幹、題型、選項文字、正解、題序（快照自 question/question_option） |
| `answer_distribution` | session_question | 各選項有效作答人數（可重算，物化為報表加速） |
| `personal_score` | teaching_session × participant × 題 | 答對 100／其餘 0，等權重 |
| `leaderboard_entry` | teaching_session | 總分＋競賽/密集排名 |
| `team_membership` | session_team | 成員隸屬（生效時點必記） |
| `activity_event_log` | teaching_session | 模式鎖定、公布、租約、開始/結束等事件 |

### [Role] — role（黃）
| 表/概念 | 對應 Party | 說明 |
|---|---|---|
| `user_role` | user_account × role | 帳號角色指派（M03 維護） |
| 主持老師（SESSION_HOST） | user_account.hosted_sessions | 活動層級角色，屬 teaching_session.host_user_id |
| `team_membership`（隊員） | participant × session_team | 同一時間至多一個有效隊伍 |
| 報表查閱者／活動監控者 | user_account（經 permission） | 授權角色層，不需獨立表 |

### [Party / Place / Thing] — thing（綠）
| 表 | 原型 | 說明 |
|---|---|---|
| `user_account` | Party（Person） | 正式帳號（系統管理者／老師）；學員不建帳號 |
| `participant` | Party（活動內身分） | 臨時參與實體，活動內唯一識別 |
| `participant_credential` | Thing | 不可猜測匿名憑證，重連用 |
| `participant_heartbeat` | Thing（即時狀態） | 60 秒有效心跳 → 在線判定 |
| `question_set` | Thing | 題庫（老師擁有、軟刪除） |
| `question` / `question_option` | Thing | 題目與選項（快照來源） |
| `tag` / `question_set_tag` | Thing | 老師本人題庫標籤 |
| `session_team` | Thing | 隊伍（僅 TEAM 模式） |
| `organization`（P1） | Party（組織） | 組織間競賽比較單位 |

### [Catalog Description] — description（藍）
| 表 | 說明 |
|---|---|
| `role` | 固定系統角色目錄（SYSTEM_ADMIN/TEACHER，代碼不可改不可刪） |
| `permission` | 權限目錄（`<MODULE>_READ/WRITE`），未列入預設拒絕 |
| `role_permission` | 角色-功能對應：完整權限集合一次提交取代 |
| `system_parameter` | 系統參數目錄（活動預設值＋Session 逾時），樂觀鎖批次更新 |

### [Subsequent Transaction] — 後續交易鏈
```
one_time_link(邀請) → user_account(ACTIVE) → login_session → teaching_session
  → teaching_session.status = NOT_STARTED → IN_PROGRESS → ENDED（不可逆）
  → teaching_session 開放首道計分題 → question_eligibility_snapshot → response
  → personal_score → team_score_ledger → leaderboard_entry → publish_log
  → control_lease / batch_operation / export_job（支線）
```

---

## 二、Mermaid ER 圖

```mermaid
erDiagram
    USER_ACCOUNT ||--o{ ONE_TIME_LINK : "邀請/重設/驗證連結"
    USER_ACCOUNT ||--o{ LOGIN_SESSION : "登入 Session（含權限快照）"
    USER_ACCOUNT ||--o{ USER_ROLE : "帳號角色指派"
    ROLE ||--o{ USER_ROLE : ""
    ROLE ||--o{ ROLE_PERMISSION : "角色-功能對應"
    PERMISSION ||--o{ ROLE_PERMISSION : ""

    USER_ACCOUNT ||--o{ QUESTION_SET : "擁有者"
    QUESTION_SET ||--o{ QUESTION : "題目"
    QUESTION ||--o{ QUESTION_OPTION : "選項"
    QUESTION_SET }o--o{ TAG : "question_set_tag"

    USER_ACCOUNT ||--o{ TEACHING_SESSION : "主持老師 host_user_id"
    TEACHING_SESSION ||--o{ SESSION_JOIN_INFO : "Game PIN 世代"
    TEACHING_SESSION ||--o{ SESSION_QUESTION : "題目快照（不可變）"
    QUESTION ||--o| SESSION_QUESTION : "source_question_id（可追溯）"
    SESSION_QUESTION ||--o{ SESSION_QUESTION_OPTION : "快照選項"

    TEACHING_SESSION ||--o{ PARTICIPANT : "參與者（活動內唯一）"
    PARTICIPANT ||--o{ PARTICIPANT_CREDENTIAL : "參與者憑證"
    PARTICIPANT ||--o{ PARTICIPANT_HEARTBEAT : "心跳→在線"
    TEACHING_SESSION ||--o{ RESPONSE : ""
    PARTICIPANT ||--o{ RESPONSE : "最後成功提交為準"
    SESSION_QUESTION ||--o{ RESPONSE : ""

    TEACHING_SESSION ||--o{ SESSION_TEAM : "僅 TEAM 模式"
    SESSION_TEAM ||--o{ TEAM_MEMBERSHIP : ""
    PARTICIPANT ||--o| TEAM_MEMBERSHIP : "同時至多一有效隊伍"

    SESSION_QUESTION ||--o{ QUESTION_ELIGIBILITY_SNAPSHOT : "計分題開放時固定"
    SESSION_QUESTION ||--o{ ANSWER_DISTRIBUTION : "答案分布"
    SESSION_QUESTION ||--o{ PERSONAL_SCORE : "個人得分"
    TEACHING_SESSION ||--o{ LEADERBOARD_ENTRY : "個人/隊伍排行榜"
    SESSION_QUESTION ||--o| TEAM_SCORE_LEDGER : "每題每隊至多一筆"
    SESSION_TEAM ||--o{ TEAM_SCORE_LEDGER : ""

    TEACHING_SESSION ||--o{ CONTROL_LEASE : "同時唯一有效"
    TEACHING_SESSION ||--o{ PUBLISH_LOG : "公布（統計/正解/排行榜）"
    TEACHING_SESSION ||--o{ ACTIVITY_EVENT_LOG : "活動事件"

    ROLE ||--o{ LOGIN_SESSION : "權限快照（jsonb）"
    SYSTEM_PARAMETER {}o--|| TEACHING_SESSION : "建立時套用預設值（不回溯）"
    ORGANIZATION |o--o{ PARTICIPANT : "組織歸屬（P1）"
    USER_ACCOUNT ||--o{ BATCH_OPERATION : "批次操作（冪等）"
    TEACHING_SESSION ||--o{ EXPORT_JOB : "匯出（P1）"
```

UML 原型版（關鍵交易鏈）：

```mermaid
classDiagram
    direction LR
    class TeachingSession {
      <<moment-interval>>
      status, grouping_mode, leaderboard_mode, mode_locked
    }
    class SessionQuestion {
      <<moment-interval detail>>
      copied_stem, question_type, sort_order（不可變）
    }
    class SessionQuestionOption {
      <<moment-interval detail>>
      copied_option_text, is_correct
    }
    class Response {
      <<moment-interval>>
      answer, is_valid, is_latest, client_submission_id
    }
    class EligibilitySnapshot {
      <<moment-interval>>
      participant_id / team_id, eligible_count
    }
    class TeamScoreLedger {
      <<moment-interval>>
      eligibility_snapshot_ref, raw_score_sum, team_score
    }
    class PersonalScore {
      <<moment-interval detail>>
      score
    }
    class LeaderboardEntry {
      <<moment-interval detail>>
      total_score, rank_type
    }
    class PublishLog {
      <<moment-interval>>
      publish_kind, version, reason
    }
    class ControlLease {
      <<moment-interval>>
      issued_to, expires_at, released_at
    }
    class UserAccount { <<thing>> }
    class Participant { <<thing>> }
    class SessionTeam { <<thing>> }
    class QuestionSet { <<description-來源 thing>> }
    class UserRole { <<role>> }
    class TeamMembership { <<role>> }
    class Role { <<description>> }
    class Permission { <<description>> }
    class RolePermission { <<description>> }
    class SystemParameter { <<description>> }

    TeachingSession *-- "1..*" SessionQuestion : composition
    SessionQuestion *-- "*" SessionQuestionOption : composition
    TeachingSession --> "0..*" Response
    Response --> EligibilitySnapshot : 分母
    EligibilitySnapshot --> TeamScoreLedger
    TeachingSession --> PersonalScore
    TeachingSession --> LeaderboardEntry
    TeachingSession --> PublishLog
    TeachingSession --> ControlLease
    SessionQuestion --> Question : source（可追溯）
    UserAccount --> UserRole --> Role --> RolePermission --> Permission
    Participant --> TeamMembership --> SessionTeam
```

---

## 三、快照／不可變稽核（Snapshot Audit）

| 交易成立時點 | 從哪複製 | 複製到 | 不變規則 |
|---|---|---|---|
| 建立教學活動 | `question` / `question_option` | `session_question` / `session_question_option`（題幹、題型、選項文字、正解、題序） | 活動建立後永不自動同步；來源編輯/軟刪除不影響快照 |
| 登入成功 | `role` × `role_permission` → 有效權限集合 | `login_session.permission_snapshot`（jsonb） | 權限異動須重新登入生效；帳號/角色停用例外 → 立即撤銷 |
| 開放計分題 | 有效學員／有效隊員名單 | `question_eligibility_snapshot` | 遲到者、旁聽不回寫；統計分母唯一依據 |
| 發布加入資訊 | — | `session_join_info`（generation 世代） | 整組同時失效，不得分別撤銷 |
| 結算隊伍分數 | `question_eligibility_snapshot` 具資格人數 | `team_score_ledger.raw_score_sum / team_question_score`（numeric 高精度） | (活動,題,隊) 至多一筆有效；冪等重試不部分加分 |
| 公布 | — | `publish_log` | 不可撤回；更正為新版本＋必填原因 |

禁改清單：禁止以 `question_set` 當前值動態計算歷史分數；禁止以「在線人數／已加入人數」當統計母體（必須用資格快照）。

---

## 四、設計決策備註

1. **邀請／密碼重設/Email 驗證統一為 `one_time_link`**：三者皆「一次性連結、時限、重發失效」語意，共用 60 秒寄送頻率限制（`last_sent_at`）。
2. **公布狀態集中於 `publish_log`**：四項公布（統計／正解／個人榜／隊伍榜）各自獨立、單向寫入（不可撤回）、更正走版本鏈（必填原因）。
3. **作答資格快照兩種粒度合一張表**：`question_eligibility_snapshot` 以 `participant_id`（個人）或 `team_id`（隊伍）兩種 nullable 雙向欄位存名單，`eligible_count` 為結算分母。
4. **`session_join_info.game_pin` 為 char(6)**（允許前導 0），唯一性以「仍允許加入」partial unique index 表達；世代 `generation` 序號管理輪替。
5. **控制租約唯一有效性**：partial unique index `WHERE released_at IS NULL`。
6. **每張表皆附 `created_at / updated_at`**（timestamptz, default now()），以 `COMMENT ON` 讓 DB 端每欄位均有說明；列舉欄位以 PostgreSQL enum type 定義並由類型本身承載語意。
7. **P1 概念**（組織競賽、匯出）已建表但標註 P1，預設不啟用。

## 五、驗證方式

```bash
psql "$DATABASE_URL" -f er_model_postgresql.sql   # 全新資料庫上執行應一次通過
psql "$DATABASE_URL" -c "\d+ app.teaching_session" # 確認每欄位註解可見
```