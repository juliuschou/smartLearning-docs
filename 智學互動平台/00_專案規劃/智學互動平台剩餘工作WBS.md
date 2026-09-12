# 智學互動平台剩餘工作 WBS

- 文件日期：2026-09-07
- 規劃範圍：Phase B 收尾、帳號式課堂 MVP、資料治理、即時可靠性及 production readiness
- 規劃原則：後端契約及 DB-backed 驗收先完成，再開發對應前端；不使用 mock 或 placeholder 取代正式串接
- 估算單位：人日，為區間估算；不含既有回歸問題的大規模修復

## 1. 里程碑摘要

| WBS | 里程碑                 | 後端估算 | 前端估算 | QA／文件／平台 | 主要產出                                                                                            | 參考文件                                                                                                                                                                                                                         |
| --- | ---------------------- | -------: | -------: | -------------: | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0 | Phase B 封板           |      5–8 |      0–1 |            3–5 | 學生帳號與加選後端正式簽核                                                                          | [Phase B 後端執行計畫](../50_實作與測試/Phase%20B%20學生帳號與加選名冊%20後端執行計畫.md)、[Web Auth 與安全設計](../30_系統設計/Web%20Auth%20與安全設計.md)、[API 與共用 Schema](../30_系統設計/API%20與共用%20Schema%20設計.md) |
| 2.0 | Student 基礎 UI        |      0–1 |      3–5 |            1–2 | 登入、角色導向、我的課程                                                                            | [Phase B 學員帳號實作計畫](../50_實作與測試/Phase%20B%20學員帳號%20實作計畫.md)、[API 與共用 Schema](../30_系統設計/API%20與共用%20Schema%20設計.md)                                                                             |
| 3.0 | Teacher 名冊與課堂控制 |      2–4 |      6–9 |            2–3 | 名冊、開關題、課堂狀態與結果（FE-2 與 FE-3 real-browser acceptance 已交付，含 FE-3.3.8 2026-09-11） | [P0 核心需求基線](../10_需求蒐集/P0%20核心需求基線.md)、[即時同步與結果治理設計](../30_系統設計/即時同步與結果治理設計.md)                                                                                                       |
| 4.0 | Student 完整課堂       |      2–4 |     8–14 |            3–5 | 四題型加入、作答、結果與匿名 fallback                                                               | [題目領域契約](../10_需求蒐集/題目領域契約.md)、[API 與共用 Schema](../30_系統設計/API%20與共用%20Schema%20設計.md)、[即時同步與結果治理設計](../30_系統設計/即時同步與結果治理設計.md)                                          |
| 5.0 | Archive 與資料治理     |     8–13 |      2–4 |            4–6 | Archive、90 日 retention、刪除與 tombstone                                                          | [結果資料治理](../10_需求蒐集/結果資料治理.md)、[資料模型與 ER 設計](../30_系統設計/資料模型與%20ER%20設計.md)、[即時同步與結果治理設計](../30_系統設計/即時同步與結果治理設計.md)                                               |
| 6.0 | 即時可靠性與容量       |    15–25 |      5–8 |           8–12 | Scheduler、outbox/replay、Redis、W1–W8                                                              | [MVP 效能目標](MVP%20效能目標.md)、[架構、容量與可觀測性設計](../30_系統設計/架構、容量與可觀測性設計.md)、[即時同步與結果治理設計](../30_系統設計/即時同步與結果治理設計.md)                                                    |

---

# 2. 後端 WBS

## BE-1 Phase B 封板

### BE-1.1 Account-bound Participant HTTP 驗收

- [ ] BE-1.1.1 驗證 active enrollment 的學生可透過 Web Session cookie 加入課堂
- [ ] BE-1.1.2 驗證 Participant 正確綁定 `accountId`
- [ ] BE-1.1.3 驗證重複 join 不建立第二筆 Participant
- [ ] BE-1.1.4 驗證學生 cookie 可取得 snapshot
- [ ] BE-1.1.5 驗證學生 cookie 可提交答案
- [ ] BE-1.1.6 驗證學生 cookie 可讀取 participant-safe results
- [ ] BE-1.1.7 驗證 account-bound flow 不回傳 participant token
- [ ] BE-1.1.8 驗證 CSRF token 與 exact Origin 仍為 mutation 必要條件

**驗收：** `test/participant-account.e2e-spec.ts` 全部通過，0 skipped。

### BE-1.2 撤銷與競態

- [ ] BE-1.2.1 Enrollment removal 後禁止新 join
- [ ] BE-1.2.2 Enrollment removal 後禁止既有 Participant submit
- [ ] BE-1.2.3 Account disable 後禁止新 join
- [ ] BE-1.2.4 Account disable 後禁止既有 Participant submit
- [ ] BE-1.2.5 驗證 concurrent enrollment removal vs join
- [ ] BE-1.2.6 驗證 concurrent enrollment removal vs submit
- [ ] BE-1.2.7 驗證 concurrent account disable vs join／submit
- [ ] BE-1.2.8 確認 transaction lock order 為 `liveSession → course → account`
- [ ] BE-1.2.9 查詢 authority rows，確認沒有 duplicate Participant／Submission

**驗收：** 撤銷線性化；commit 後不再接受未授權操作。

### BE-1.3 匿名流程回歸

- [ ] BE-1.3.1 Session code 加入仍可使用
- [ ] BE-1.3.2 Participant token snapshot 仍可使用
- [ ] BE-1.3.3 Participant token submit 仍可使用
- [ ] BE-1.3.4 Participant token results 仍可使用
- [ ] BE-1.3.5 匿名與 account-bound rows 可共存

### BE-1.4 Phase B 回歸驗證

**目標：** 在不改動 `smartlearning_dev`、不重置非測試資料的前提下，證明 B1–B5 的 runtime contract、匿名 fallback、撤銷線性化、realtime projection/privacy 與既有 Phase A 行為均可回歸；產出可供 Phase B sign-off 的可重現證據。

**執行邊界與前置條件：**

- DB-backed 測試只允許使用 `.env.test` 指定的 `smartlearning_test`；先以 `NODE_ENV=test npm run prisma:migrate:status` 做唯讀檢查，確認 target、migration 數量與 schema up to date。
- `test/setup/db.ts` 會在 DB-backed suite 內部執行 idempotent `prisma migrate deploy` 與 `truncateAll`；執行前須取得該次測試與 fixture isolation 的明確授權，並記錄此隱式邊界。
- 不直接執行 `prisma migrate deploy`、`prisma db push` 或任何 development DB 清除命令；migration 不 up to date、target 不符或 PostgreSQL 不可達時停止，不以 skip 視為通過。
- 先確認工作樹 commit／diff baseline，測試期間不得混入 product source、schema、migration、environment 或非本項回歸的修改。

#### BE-1.4.0 驗證編排與證據格式

- [ ] 建立 baseline：branch、HEAD commit、工作樹狀態、Node/npm/Prisma 版本與測試 DB target。
- [ ] 以「schema/static → B1/B2 → B3 → B4 → B5 → OpenAPI → full regression → quality gates」順序執行；每階段記錄 command、suite/test count、skip count、DB target 與最小失敗證據。
- [ ] 每個 DB-backed suite 均確認實際進入 `requireDatabase()`，不得接受因 DB 不可用而靜默 skip。
- [ ] 若任一 stop condition 觸發，停止後續擴充／廣泛回歸，保留失敗輸出、重新規劃修復與回歸範圍。

#### BE-1.4.1 Schema／migration preflight

- [ ] `NODE_ENV=test npm run prisma:validate`：schema/config valid。
- [ ] `NODE_ENV=test npm run prisma:migrate:status`：只核對 `smartlearning_test`，確認所有 migration applied、無 pending/failed migration。
- [ ] 檢查 B1–B3 additive migrations 與 Prisma generated client 對齊；不在本階段修改 migration 或執行 development DB mutation。

#### BE-1.4.2 B1 identity targeted tests

- [ ] `identity.integration-spec.ts`：student role CHECK、role/session projection、`canCreateCourse=false` 與 account lifecycle。
- [ ] `student-account.e2e-spec.ts`：admin 建立／student login、不可建課、owner path deny、disabled account。
- [ ] 驗收：B1 suites 0 failure、0 skipped，且 401/403、cookie session、錯誤 envelope 與既有 teacher/admin 行為不變。

#### BE-1.4.3 B2 enrollment targeted tests

- [ ] `enrollments.e2e-spec.ts`：owner/admin add/list/remove/reactivate/idempotency、student `GET /me/courses`、archived-course rejection、cross-owner privacy。
- [ ] 同步執行 `openapi.e2e-spec.ts` 的 enrollment/admin path assertions，確認 route、DTO 與版本前綴沒有漂移。
- [ ] 驗收：active enrollment 是唯一可授權來源；removed／非 enrolled／跨 owner 不得洩漏存在性或建立錯誤名冊資料。

#### BE-1.4.4 B3 participant HTTP／concurrency tests

- [ ] `participant-account.e2e-spec.ts` 全套：student cookie join、`accountId` binding、duplicate join、snapshot、submit、participant-safe results、無 participant token 回傳、CSRF + exact Origin。
- [ ] 驗證撤銷後行為：enrollment removal／account disable 對新 join 與既有 submit 均拒絕；匿名 session-code + participant-token path 同時保持可用。
- [ ] 執行 concurrency/race cases，查詢 authority rows 確認無 duplicate Participant／Submission，並確認 lock order 為 `liveSession → course → account`。
- [ ] 驗收：B3 full HTTP/concurrency 0 failure、0 skipped；任何 commit 後未授權接受、duplicate row 或 token leakage 均阻擋 sign-off。

#### BE-1.4.5 B4 realtime targeted tests

- [ ] `live-session-realtime.e2e-spec.ts`：student cookie handshake 只進 `session:<id>`、不進 teacher room；snapshot projection 與 REST parity。
- [ ] 驗證 student 收 participant-safe `result.updated`、不收 `counts.updated`；enrollment/account revoke 會 disconnect；anonymous fallback 與既有 teacher lifecycle 不回歸。
- [ ] 事件 listener 必須在觸發 REST mutation 前註冊；測試 failure 時保留 event、room、socket 與 projection 的最小證據。
- [ ] 驗收：realtime targeted suite 0 failure、0 skipped，且 post-commit emit failure 不使已提交 REST mutation 失敗。

#### BE-1.4.6 B5 privacy／redaction tests

- [ ] `pino-redaction.spec.ts` 與 `question-results.spec.ts`：password/cookie/session token/participant token/idempotency/answer/open-text sensitive fields 不進 log 或 response。
- [ ] `open-text-live-flow.e2e-spec.ts`：open/closed result 僅回 `{ text }`，不含 display name、`accountId`、token linkage；student realtime close projection 同樣安全。
- [ ] 審閱所有權威設計文件的 historical 「no student account」文字；可編輯文件完成同步，受權限阻擋者須記錄 path、原因與未完成邊界，不得宣稱 B5 完成。
- [ ] 驗收：privacy negative assertions 全部通過；文件同步與 runtime evidence 分開標示，避免 focused pass 被誤報為完整 DoD。

#### BE-1.4.7 OpenAPI E2E

- [ ] `openapi.e2e-spec.ts`：`/api/docs` HTML、`/api/docs-json` raw JSON、`/api/v1` paths、enrollment/admin/participant routes、無 `/api/api/` 雙前綴。
- [ ] 驗證 OpenAPI route/DTO 與實際 envelope、auth/CSRF、student role contract 一致；不以 spec 存在取代 runtime E2E。

#### BE-1.4.8 Full regression

- [ ] `npm test -- --runInBand`：完整 unit suites。
- [ ] `NODE_ENV=test npm run test:integration -- --runInBand`：完整 integration suites，0 skipped。
- [ ] `NODE_ENV=test npm run test:e2e -- --runInBand`：完整 E2E suites，包含 Phase A 題型、結果/reveal、匿名流程、OpenAPI 與 Phase B。
- [ ] 回歸失敗時先縮小到 failing suite/test，再修復與重跑；不得只重跑到綠而不保留 root-cause evidence。

#### BE-1.4.9 Static／quality gates

- [ ] `npm run typecheck`
- [ ] `npm run lint:check`
- [ ] `npm run format:check`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] 確認生成 client／build artifact 不造成 CJS/ESM 啟動回歸；只報告目前 branch 實際結果。

**DoD：** B1–B5 targeted suites、OpenAPI、full unit/integration/e2e 與 quality gates 全部 0 failure、0 skipped；驗證紀錄包含 branch/commit、實際 DB target、migration status、每個 suite/test/skip count、授權與隱式 migrate 邊界、失敗證據（若有）及最終 `git diff --check`。B3 full HTTP/concurrency、B5 文件同步或任何 DB-backed suite 未完成時，不得宣稱 Phase B 封板。

---

## BE-2 Student 與 Enrollment API 穩定化

**目標：** 在 BE-1 的 runtime／撤銷／匿名 fallback 驗收完成後，將 student account 與 enrollment roster 的目前實作收斂成可供 FE-1／FE-2 消費的 v1 contract；本項以 contract freeze、negative-path proof、OpenAPI 與 frontend reference 一致性為出口，不新增課堂功能或前端 mock。

**依賴與前置：**

- BE-1.1～BE-1.4 完成，尤其 B3 account-bound Participant HTTP、B5 文件／privacy 邊界；BE-1 未完成時只能做差異盤點，不得宣稱 BE-2 contract stable。
- 只以目前 source、targeted DB-backed tests、OpenAPI runtime output 與 M2 authoritative docs 對照；`docs/frontend-api-reference.md` 是前端消費文件，不反過來覆寫 runtime contract。
- DB-backed 驗證僅限 `.env.test` 指向的 `smartlearning_test`；先做唯讀 migration status，測試內部的 idempotent migrate／truncate 邊界須明確記錄；不得觸碰 `smartlearning_dev` 或未知資料庫。

### BE-2.1 Student account／role contract freeze

- [ ] 盤點並凍結 `AccountRole.STUDENT`、`AccountDto`、`SessionDto`、`CreateAccountDto` 的欄位、nullable／enum、HTTP status 與 envelope 形狀。
- [ ] 凍結 student invariant：`canCreateCourse` 永遠為 `false`；student 可 login／logout／change-password／讀自己的課程，但不得使用 courses、questions、live-session owner／teacher routes。
- [ ] 凍結 auth semantics：缺 session＝401、已登入但角色不符＝403；disabled／must-change-password 行為沿用既有 auth contract；不得從 student response 洩漏 password/hash/cookie/token。
- [ ] 以 `student-account.e2e-spec.ts`、`identity.integration-spec.ts`、OpenAPI path／schema assertion 覆蓋 success、disabled、owner-path denial、malformed input 與 response redaction。

### BE-2.2 `GET /me/courses` response contract freeze

- [ ] 凍結 route／guard：`GET /api/v1/me/courses?page&pageSize`，`SessionGuard + StudentGuard`，GET 不需 CSRF；teacher/admin／未登入的 status 與 stable error code 固定。
- [ ] 凍結 `Page<MyCourseDto>` 內層 shape：`enrollmentId`、`courseId`、`name`、`description`、`status`、`ownerAccountId`、`enrolledAt`、`createdAt`、`updatedAt`；時間為 UTC ISO 8601。
- [ ] 凍結只回 active enrollment、排序／分頁邊界、removed enrollment 即時消失、archived course 的既有 enrollment 可讀語意；不得回傳其他 student 或 roster identity。
- [ ] 補／核對 empty、pagination、removed、archived、cross-account privacy 與 envelope nested `data.data`／`data.meta` assertions。

### BE-2.3 Enrollment roster API contract freeze

- [ ] 凍結三條 route：`POST /api/v1/courses/:courseId/enrollments`、`GET /api/v1/courses/:courseId/enrollments?page&pageSize`、`DELETE /api/v1/courses/:courseId/enrollments/:studentAccountId`。
- [ ] 凍結 actor／CSRF：owner teacher 或 admin 可操作；所有 mutation 需 CSRF + exact Origin；student、非 owner teacher、未登入分別維持 403／404／401 semantics；GET 不需 CSRF。
- [ ] 凍結 `EnrollmentDto` 與 nested student projection 僅含 `id`、`username`、`displayName`，以及 status／timestamps；禁止 password/hash/session/token 等敏感欄位。
- [ ] 凍結 list 分頁 query 的數值驗證、stable ordering、active／removed rows 是否列出，並以 OpenAPI 與 e2e 共同驗證，不讓 DTO／route 漂移。

### BE-2.4 Archived course 行為

- [ ] 凍結 archived course 對 add：拒絕建立或恢復 active enrollment，回既定 409 domain conflict（目前 `COURSE_NOT_EDITABLE` 語意）。
- [ ] 凍結 archived course 對 list／remove／既有 active enrollment：依目前實作與 M2 policy 明確記錄可讀／可移除範圍；不得因查詢或撤銷而建立新 roster row。
- [ ] 加 archived transition 前後的 DB authority assertions，確認不存在 duplicate row、status 逆轉或跨 owner existence leak。

### BE-2.5 Duplicate enrollment／reactivation semantics

- [ ] 凍結 `(courseId, studentAccountId)` 為唯一 authority row；active duplicate add 為 idempotent success，回同一 enrollment ID，不新增 row。
- [ ] 凍結 removed row 的再次 add 為原 row reactivation（`removed → active`），不建立第二筆；remove 為 idempotent success，重複 remove 不報不存在性差異。
- [ ] 覆蓋 sequential duplicate、remove/add、並發 add／remove 的 transaction lock／unique constraint 結果；查詢 DB count 必須維持一筆 authority row。
- [ ] 若現行 status visibility 或 HTTP code 與上述語意不一致，先開 contract decision／forward-fix 子項，不在文件中默默改寫成理想行為。

### BE-2.6 Ownership、403／404 與 existence-hiding

- [ ] 凍結 course owner／admin 可讀寫 roster；非 owner teacher 對 list/add/remove 回 404 `NOT_FOUND`，不洩漏 course 是否存在或 target student 是否存在。
- [ ] 凍結 student 對 roster management routes 回 403，student 僅能透過 `/me/courses` 讀自己的 active enrollments；不得以 404 混淆角色拒絕。
- [ ] 凍結 target account 非 student、disabled／unknown UUID、cross-owner course、archived course 的 error code／status／field，並確認 validation error 不洩漏內部資料。
- [ ] 對照 `CourseService.assertCourseAccess`、`EnrollmentService`、guards、error filter 與 API docs；所有授權檢查須在資料投影前完成。

### BE-2.7 Contract artifacts、回歸與 release evidence

- [ ] 更新 `docs/frontend-api-reference.md`：student／session／`/me/courses`／roster route、DTO、pagination、auth／CSRF、error、archived／duplicate／reactivation semantics 與 evidence boundary。
- [ ] 更新 OpenAPI e2e assertions，確認 `/api/v1`、無 `/api/api/`、request／response schema 與實際 envelope 不漂移；文件標示 OpenAPI 顯示內層 DTO。
- [ ] 執行順序：`prisma:validate` → `prisma:migrate:status`（唯讀）→ B1/B2 targeted integration/e2e → B3／BE-1 regression → OpenAPI → typecheck/lint/format/build/diff check；DB suite 必須 0 skipped。
- [ ] 產出 evidence：branch／HEAD／working-tree baseline、DB target／migration status、每 suite test／skip count、最小失敗證據、隱式 test migration 邊界與未完成項；不把 code presence 或 focused pass 誤報為 Phase B sign-off。

**BE-2 完成 DoD：**

- [x] BE-2.1～BE-2.7 的 route、DTO、role／authorization、pagination、archived、duplicate／reactivation、403／404 semantics 在 source、OpenAPI、frontend reference 與 DB-backed tests 一致。
- [x] B1/B2 targeted suites、BE-1 B3／B5 必要回歸與 OpenAPI 皆 0 failure、0 skipped；authority query 證明無 duplicate enrollment／participant／submission side effect。
- [x] quality gates（typecheck、lint:check、format:check、build、git diff --check）全數通過；任何 migration／DB 不可達或文件同步阻擋都維持 BLOCKED，不得宣稱 contract freeze。

> **BE-2 contract freeze closeout（2026-09-03，使用者授權）：** BE-2.1～BE-2.7 的 runtime、DB-backed e2e、OpenAPI 與 frontend reference 證據已在 2026-08-26～08-27 checkpoint A–D 記錄並保持 0 failure / 0 skipped；2026-09-03 BE-2 student-search contract 以 backend commit `1c38d9c` 補齊（enrollments+OpenAPI e2e 2 suites / 7 tests、typecheck/lint/format/build 全綠、`smartlearning_test` 15 migrations up to date）。FE-2.1 已依此凍結契約交付。`smartlearning_dev` 不可達（P1003）不影響本 freeze 的 test-DB 證據。

**風險與 rollback：** 中高（公開 API contract、student authorization、roster privacy、撤銷與 participant 授權耦合）。優先採文件／測試／OpenAPI additive 修正；runtime 修正以小切片 forward-fix。不得修改已套用 migration、重置非測試資料或恢復已撤銷 enrollment／session；必要時逐切片 revert application／test／docs，保留 additive schema 與已提交 authority rows。

**依賴：** BE-1 完成後才視為正式穩定契約；BE-2 完成後才可啟動 FE-1 Student「我的課程」與 FE-2 Teacher Enrollment Roster 的正式串接。

---

## BE-3 Teacher 課堂生命週期

### BE-3.1 Session control

**目標：** 證明 LiveSession／SessionQuestion 的狀態轉移、不可逆終止、terminal-state access guard 與 transaction authority 符合 P0、API 及 realtime contract；自動關閉的 scheduler/retry 仍由 BE-6 實作，但本節先凍結其 domain boundary。

#### BE-3.1.0 Contract、前置條件與人工授權

- [ ] 凍結狀態機：`waiting → active`、`waiting → cancelled`、`active → closed`；`closed`／`cancelled` 不可 reopen。
- [x] 依 P0 凍結取消政策（使用者確認）：`cancelled` 僅適用於尚未 active 且沒有 Submission；`active → cancelled` 必須拒絕。後續需同步 runtime/domain tests 與所有受影響 contract 文件。
- [ ] 凍結 8 小時 hard limit：auto-close 與 manual close 共用 close service、lock protocol、question cascade、access rejection 與 event boundary；scheduler retry/restart 留 BE-6。
- [ ] 凍結各 route 的 HTTP status、stable error code、success/error envelope、401/403/404 ownership semantics、CSRF + exact Origin。
- [x] **人工 Checkpoint 0：** 使用者已確認上述 policy、測試 DB target 為 `smartlearning_test`，並授權本輪 DB-backed E2E（含 setup 內部 migrate/truncate 邊界）。CP0 targeted verification：unit 1 suite/4 tests、E2E 1 suite/7 tests、typecheck、lint 均通過；僅保留既有非阻擋 Nest wildcard／pg@9 warnings。

**Stop：** policy 或權威文件互相矛盾、DB target/migration 不明、或 DB-backed suite 可能靜默 skipped。

#### BE-3.1.1 CP1 — Session transition matrix

- [ ] 驗證 `waiting → active`：`startedAt`、狀態、選定題目順序及 immutable `SessionQuestion` snapshot 正確；重複 start 不新增 snapshot。
- [ ] 驗證 `waiting → cancelled`：`closedAt=null`、不形成互動結果；依 CP0 policy 驗證 active cancel 被拒絕。
- [ ] 驗證 `active → closed`：`closedAt` 正確；`closed/cancelled → *` 所有 reopen/重終止嘗試均為 stable conflict。
- [ ] 驗證同一 Course 不同時存在第二個 `waiting`／`active` session；session code 不重用且 terminal 後失效。
- [x] **人工 Checkpoint 1：** 使用者確認 CP1 verified；targeted close/cancel E2E 1 suite/8 tests、domain state unit 1 suite/4 tests 均通過，DB target 為 `smartlearning_test`，無 failure；start snapshot、`startedAt`、重複 start conflict 與單一 snapshot row 已驗證。

#### BE-3.1.2 CP2 — Question cascade 與不可 reopen

- [ ] 驗證 `not_open → open → closed`，同一 session 同時最多一題 open。
- [ ] 直接驗證 question close endpoint；重複 close、closed question reopen、非 active session open/close 均拒絕。
- [ ] Session close 時在同一 transaction 關閉所有 active/open questions，`closedAt` 可追溯且無遺留 `open` row。
- [ ] **人工 Checkpoint 2：** 使用者核對 session 與 SessionQuestion rows、response DTO 及 `question.closed` event；確認 cascade、順序與不可 reopen。CP2 首次 targeted run BLOCKED：2 suites failed，4 failed／21 passed／25 total；其中 realtime cancellation case 仍預期 active cancel 201，與 CP0 P0 policy 衝突，另有 waiting-session fixture 409 導致兩個 results cases 無法建立 fixture，及 account-disable realtime wait timeout。需先診斷／修正測試與 fixture，未通過前不得進入 CP3。

#### BE-3.1.3 CP3 — Terminal-state negative paths

- [ ] `closed`／`cancelled` session 的直接 join 與 reconnect 均回 `SESSION_NOT_JOINABLE`（或已凍結的等價 stable code），不論持有舊 participant token 或 Socket。
- [ ] `closed`／`cancelled` session 的新 submission 均拒絕；question close 後亦不得新增 submission。
- [ ] terminal state 不得 reopen，且 rejected request 不得新增 Participant、Submission、Question 或其他 side effect。
- [ ] 驗證 account-bound 與 anonymous fallback 兩條 path 均遵守相同 terminal guard。
- [ ] **人工 Checkpoint 3：** 使用者逐項查看 response status/code/envelope 及 before/after DB authority count；確認拒絕不是前端限制。

#### BE-3.1.4 CP4 — Auth、CSRF、Origin 與 ownership

- [ ] 每個 control route 覆蓋未登入＝401、角色不符＝403、非 owner teacher 的 existence-hiding、admin 合法操作。
- [ ] mutation 覆蓋缺失／錯誤 CSRF、非 exact Origin＝403；合法 session + CSRF + Origin + owner 才成功。
- [ ] success/error 均符合 `/api/v1` envelope；不得暴露 token、password、answer 或內部 exception。
- [ ] **人工 Checkpoint 4：** 使用者抽查 actor／role／credential matrix 的原始 HTTP evidence，確認授權檢查在 projection/side effect 前完成。

#### BE-3.1.5 CP5 — Idempotency、stable conflict 與 concurrency

- [ ] 重複 close/cancel/start、非法 transition 的 status、error code、envelope 固定；目前若採 stable 409，必須明確記錄而非宣稱 idempotent success。
- [ ] concurrent close/cancel 只有一個 authority transition 成功；重試不得改寫 timestamp 或產生 duplicate side effect。
- [ ] submit/close race 依 BE-3.3 驗證：submit 先 commit 則保留答案，close 先 commit 則後續 submit 拒絕；commit 而非 client/socket 順序為 authority。
- [ ] **人工 Checkpoint 5：** 使用者確認 race run evidence、lock/commit order 與最終 DB rows；任何 duplicate 或 outcome 不可判定即停止。

#### BE-3.1.6 CP6 — Post-commit realtime proof

- [ ] `session.state_changed`、`question.closed`、`session.closed` 僅在 PostgreSQL commit 後發布；listener 必須在 mutation 前註冊。
- [ ] 模擬 event bus/Socket publish failure：REST mutation 仍成功，已提交 DB state 不 rollback；錯誤隔離且不回報假失敗。
- [ ] 驗證 actor-specific projection，不把 teacher-only counts、raw token 或 quiz correctness 提前廣播給 participant。
- [ ] 本階段只驗證 current lite event bus/snapshot；durable `eventSeq`、outbox、replay、Redis 不得列為 BE-3.1 完成證據，留 BE-7。
- [ ] **人工 Checkpoint 6：** 使用者審閱 transaction/event/Socket evidence 的先後順序與 REST/snapshot parity。

#### BE-3.1.7 CP7 — 8 小時 auto-close handoff（依賴 BE-6）

- [ ] 凍結 controlled-clock 驗證案例：滿 8 小時仍未終止的 session 會 closed、active question 同時 closed、`autoClosed=true`。
- [ ] auto-close 後 join、reconnect、submission 全拒絕，且與 manual close 使用相同 lock/service/event boundary。
- [ ] scheduler claim、retry、process restart、duplicate close side effect 由 BE-6 驗證；BE-3.1 在 BE-6 未完成前只能標示 `DEFERRED/BLOCKED`。
- [ ] **人工 Checkpoint 7：** 使用者確認 controlled-clock evidence；不得以 manual close `autoClosed=false` 代替 auto-close 證明。

#### BE-3.1.8 CP8 — Final release evidence

- [ ] 建立 `waiting/active/closed/cancelled × start/open/close/cancel/join/reconnect/submit` transition/negative matrix，8 個原始 BE-3.1 行為項目各自對應 passing test 或人工步驟。
- [ ] targeted DB-backed suites 0 failure、0 skipped；記錄 branch、HEAD、working tree、Node/npm/Prisma、DB target/migration status、command、test/skip count、最小失敗證據與 authority queries。
- [ ] 明確分開 `runtime verified`、`contract decision confirmed`、`DEFERRED/BLOCKED`；未完成 cancellation decision、BE-6 auto-close、BE-3.3 race 或 durable realtime 不得宣稱 BE-3.1 完成。
- [ ] **人工 Final sign-off：** 使用者逐項回覆「Checkpoint X verified」並確認 release evidence；自動測試全綠不能取代人工確認。

**BE-3.1 全域 Stop conditions：** DB-backed test skipped、target/migration 不符；非法 transition 成功或 terminal 可 reopen；close commit 後仍可 join/reconnect/submit；active cancel 未經 policy decision；CSRF/Origin/auth/ownership 可繞過；envelope/code 漂移；event 在 commit 前發布或 publish failure 使已 commit mutation 失敗；authority rows 出現 duplicate；把 manual close 當 auto-close、把 lite event bus 當 durable replay。

**風險與 rollback：** 中高。先採文件／contract test／negative test additive 修正；runtime 分小切片 forward-fix。不得修改已套用 migration、清除 `smartlearning_dev` 或以 rollback 恢復已接受 Submission、撤銷 token、已終止 session。若 auto-close 不安全，停用 scheduler/feature flag 並保留 manual close；若 active cancel policy 改為允許，必須同步所有權威文件與測試。

### BE-3.2 Teacher projections

- [ ] BE-3.2.1 Session detail 顯示 joined count
- [ ] BE-3.2.2 Session detail 顯示 voted count
- [ ] BE-3.2.3 Teacher result projection
- [ ] BE-3.2.4 Teacher-only counts 不廣播到 participant room
- [x] BE-3.2.5 Post-commit realtime event 不影響已提交 mutation

> **BE-3.2.5 evidence（2026-09-06）：** backend commits `d78cae9`、`0e0cb50`、`34ec33a` 分別補強 terminal event delivery 與 HTTP/realtime response-loss failpoint；FE-4.2 real-backend acceptance 以同一 idempotency key 驗證 response loss 後可取得 authority replay（`1 passed / 0 failed / 0 skipped`）。此項僅關閉 post-commit／response-loss 不回滾已提交 mutation 的行為，不代表 BE-3.3 submit／close race 已完成。

### BE-3.3 Submit／close race

- [x] BE-3.3.1 Submit 先取得 lock 時可成功
- [x] BE-3.3.2 Close 先取得 lock 時 submit 被拒絕
- [x] BE-3.3.3 Commit 作為 session/question close 線性化點
- [x] BE-3.3.4 Race test 查詢 DB authority 驗證結果

> **BE-3.3 closeout（2026-09-11 WBS sync；證據 2026-08-27，`smartlearning_test` 授權 run）：** `test/poll-submission.integration-spec.ts` 以 PostgreSQL `live_session` row lock 讓兩個真實 transaction 並發排隊（`holdSessionRowLock` 先取得 authority row，release 後 submit 與 close 同時進入 lock queue），結果 **1 suite / 8 tests，0 failed / 0 skipped**：
>
> - **BE-3.3.1／3.3.2：** `proves submit-first commit ordering before close` 與 `proves close-first commit ordering before a blocked submission` 各別驅動兩種 lock 勝者——submit 勝時恰好 1 筆 persisted submission、close 勝時 submit 以 `CONFLICT` 拒絕且 0 筆。測試刻意接受任一 PostgreSQL lock winner，不以 JavaScript promise 建立順序宣稱 DB queue ordering 為 deterministic。
> - **BE-3.3.3：** authority 以 commit 後的 persisted rows 判定，而非 client/socket 或 promise 順序；配套 runtime 修正：`SubmissionService.submit()` 改為先鎖 `live_session` 再鎖 `session_question`，與 `closeSession()` 相同 lock protocol（消解原本相反的 lock order），submit/close 無 deadlock 或 timeout 收斂。此 lock-order 同時是 BE-6 auto-close／BE-7 durable lifecycle 共用 `closeSessionInTransaction()` 的基準。
> - **BE-3.3.4：** 測試以 authority query 收斂——`submission.count({ where: { liveSessionId } })` 限 0 或 1、`sessionQuestion.status = 'closed'`、重複 close 的 `closedAt` 不被改寫（stable conflict）。
> - **人工 sign-off：** 使用者已於 2026-08-27 確認 **`Checkpoint 5 verified`**（BE-3.1 CP5 concurrent submit/close race evidence + authority-consistency review）；該簽核僅涵蓋 CP5 race 部分，不構成 BE-3.1 最終 release sign-off。同一 suite 亦涵蓋 concurrent same-participant submission serialization（只接受 1 筆）與 close-before-cancel lock ordering。
> - **靜態 gates：** typecheck、lint:check（移除未用 helper 後 recheck）、format:check、build、`git diff --check` 全數 PASS；無 schema/migration/env 變更。**邊界：** 本項不含 auto-close 參與的 race（BE-6.5 controlled-clock chain 仍缺，見 BE-6 狀態）；BE-3.1 CP5 其餘未勾項與 BE-3.1.8 final sign-off 不因本項自動勾選。

---

## BE-4 Student 課堂四題型契約

### BE-4.1 Poll single

- [ ] BE-4.1.1 Join → snapshot → submit → result → close 完整 E2E
- [ ] BE-4.1.2 Same-key replay idempotency
- [ ] BE-4.1.3 Different-payload same-key conflict

### BE-4.2 Poll multiple

- [ ] BE-4.2.1 多選完整 lifecycle E2E
- [ ] BE-4.2.2 Permuted refs 視為相同 submission
- [ ] BE-4.2.3 Response refs 正規化為 formal option UUID

### BE-4.3 Quiz

- [ ] BE-4.3.1 Exact-set correctness
- [ ] BE-4.3.2 Reveal gate 前不暴露 correctness
- [ ] BE-4.3.3 Close/reveal 後 participant-safe correctness

### BE-4.4 Open text

- [ ] BE-4.4.1 Open-text 完整 lifecycle E2E
- [ ] BE-4.4.2 `textAnswer` 與 refs 互斥
- [ ] BE-4.4.3 DB 使用 `Prisma.DbNull`／SQL NULL 語意
- [ ] BE-4.4.4 結果不含 display name、accountId 或 token linkage

---

## BE-5 Archive 與資料治理

### BE-5.1 Archive domain

- [x] BE-5.1.1 定義 close-to-archive command boundary
- [x] BE-5.1.2 新增 additive ArchivedResult schema/migration
- [x] BE-5.1.3 建立 immutable archive projection
- [x] BE-5.1.4 建立 teacher/admin archive query
- [x] BE-5.1.5 維持匿名化與 open-text privacy
- [x] BE-5.1.6 Active/waiting session 禁止 archive

### BE-5.2 Retention

- [x] BE-5.2.1 新增 `purgeAt`
- [x] BE-5.2.2 建立 90-day retention selection
- [x] BE-5.2.3 建立 bounded、idempotent worker
- [ ] BE-5.2.4 建立 dry-run mode
- [ ] BE-5.2.5 建立 retry/restart tests
- [x] BE-5.2.6 建立 retention metrics/alerts

> **BE-5.2 partial closeout（2026-09-12；guarded build＋tests 證據，非 production-ready）：** 勾選依 BE-5 CP1/CP2 evidence matrix 與 Checkpoint G steps 3–4（見下方 BE-5.2 CP2 進度與 Checkpoint G 紀錄）。此勾選只表示「建立該能力並有 guarded 證據」，**不自動宣稱 production 營運就緒、不勾 BE-5／BE-5.3、不解除 FE-6／QA-2.7 gate**。
>
> - **BE-5.2.1** — `purgeAt TIMESTAMPTZ`、close + 90 days、due index、guarded `smartlearning_test` migration evidence、exact-ms deadline E2E（CP2「90-day deadline／`purgeAt`」）。
> - **BE-5.2.2** — `status=active`、`purgeAt<=now`、oldest-first、deterministic tie、bounded、guarded DB E2E（CP2「Due selection」）。
> - **BE-5.2.3** — `take: 1–100` bounded、`FOR UPDATE … SKIP LOCKED` single-row claim、transactional tombstone/outbox、repeat idempotency、concurrency canonical-count E2E（CP2「Bounded/idempotent purge worker」「Concurrent claim」）。
> - **BE-5.2.6** — `smartlearning_job_*` run/duration/items metrics、retention purge selected/deleted/failed、manifests lag/dead、reconciliation counter；label 已修正為 `bg_job`（`job`→`bg_job`，`849e6b4`）；Checkpoint G step 4 以 disposable Prometheus v2.53 + Alertmanager v0.27 端到端證明 `OldestDueAgeHigh`／`ManifestDeadRecords` fired、`PurgeNoRecentSuccess` pending→resolved（負向）。
>
> **未勾項與未解除 blockers（維持 BE-5 APPROVAL WITHHELD）：** BE-5.2.4（dry-run 仍缺 execution-equivalent no-delete artifact；`inspectDue()` 非等價、`run-once` 回 `executed:false`）、BE-5.2.5（缺 process restart recovery 專屬測試；CP2「Scheduler overlap/shutdown/restart」仍 PARTIAL）。**production 端亦未證**：migration apply、scheduler multi-replica/restart、dry-run artifact、可部署 dashboard＋Alertmanager routing/on-call、capacity/W1–W8、production purge/object-store/restore——仍待 BE-5 final reconciliation 與 OPS-1。

### BE-5.3 Early deletion／tombstone

- [ ] BE-5.3.1 建立 early deletion request
- [ ] BE-5.3.2 建立 admin step-up confirmation
- [ ] BE-5.3.3 建立 DeletionEvent／tombstone
- [ ] BE-5.3.4 確認 confirm idempotency
- [ ] BE-5.3.5 建立 restore filtering
- [ ] BE-5.3.6 驗證 backup restore 不 resurrect 已刪資料

**風險：** 不可逆資料操作；只能停止 worker 或 forward-fix，不能以 application rollback 恢復已刪資料。

### BE-5 CP0 — Evidence audit／contract reconciliation（2026-09-10）

> **CP0 稽核邊界：** 本輪僅讀取 WBS、backend API reference、BE-5 completion plan、backend task evidence 與目前 implementation/test/migration；未執行 tests、migration、DB query、purge、reconcile、restore、container、network upload 或 cleanup。下列 `EVIDENCE AVAILABLE` 只表示已有可供下一站審查的歷史或靜態證據，**不等於 VERIFIED，也不自動勾選 WBS**。

| WBS item | CP0 disposition                               | 主要證據                                                                                                    | 缺口／限制                                                                                                               |
| -------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| BE-5.1.1 | EVIDENCE AVAILABLE—待 CP1 人工確認            | close transaction 內建立 archive；`liveSessionId` unique；archive E2E                                       | 舊 completion plan 的「after committed close」措辭已與目前 transaction boundary 不一致                                   |
| BE-5.1.2 | EVIDENCE AVAILABLE—待 CP1 人工確認            | additive archive migrations；guarded `smartlearning_test` migration status 曾達 16/18 migrations up to date | 無 production migration 證據；舊 completion plan 的「draft/unrun」已過時                                                 |
| BE-5.1.3 | EVIDENCE AVAILABLE—待 CP1 人工確認            | typed snapshot projection、stable ordering、aggregate-only tests                                            | DB 本身不阻止所有 direct SQL payload update；須以 application boundary 審查 immutable 語意                               |
| BE-5.1.4 | EVIDENCE AVAILABLE—待 CP1 人工確認            | teacher/admin list/detail、owner scope、filter-before-pagination、deterministic ordering E2E                | 正式 WBS 尚未 reconcile；無 student route 是設計限制而非缺口                                                             |
| BE-5.1.5 | EVIDENCE AVAILABLE—待 CP1 人工確認            | identity-free projection、open-text `{ text }`、participant anonymization 與 negative-field tests           | submission 仍連到已匿名化 participant row；須於 privacy review 明確接受此模型                                            |
| BE-5.1.6 | EVIDENCE AVAILABLE—具測試粒度缺口             | service 僅允許 `closed` + `closedAt`；cancel path 不 archive                                                | 缺獨立 waiting 與 active archive-negative test；目前證據部分為組合式                                                     |
| BE-5.2.1 | EVIDENCE AVAILABLE—待 CP2 人工確認            | `purgeAt TIMESTAMPTZ`、due index、close + 90 days；guarded migration evidence                               | 無 production migration/schema probe；最新 dirty tree 未綁定單一 tested revision                                         |
| BE-5.2.2 | EVIDENCE AVAILABLE—待 CP2 人工確認            | exact 90-day boundary、`purgeAt <= now`、oldest-first guarded E2E                                           | 無 production/staging due-population、capacity 或 clock operational evidence                                             |
| BE-5.2.3 | EVIDENCE AVAILABLE—具目前 tree drift          | bounded 1–100、`SKIP LOCKED`、transactional/idempotent worker、concurrency E2E                              | current scheduler metrics calls 與 unit fixture 看似不同步；無 production scheduler/multi-replica evidence               |
| BE-5.2.4 | **BLOCKED**                                   | read-only `inspectDue()` 與 runbook inspection 存在                                                         | 沒有 execution-equivalent no-delete dry-run；`run-once` 仍回 `executed:false`；無 production dry-run artifact            |
| BE-5.2.5 | EVIDENCE AVAILABLE—provenance/ops 待審        | guarded retry/concurrency、local-provider lease tests、reported MinIO restart rehearsal                     | MinIO spec/相關變更未完整 commit；filtered no-resurrection run 有 8 個 name-filter skips；無 production restart evidence |
| BE-5.2.6 | EVIDENCE AVAILABLE—production ops **BLOCKED** | retention/manifest metrics、Prometheus rules、sandbox threshold firing record                               | 未證明 Prometheus/Grafana deployment、routing、on-call ownership；current scheduler test fixture drift                   |
| BE-5.3.1 | EVIDENCE AVAILABLE—待 CP1 人工確認            | teacher-owner request route、CSRF、serialized outstanding-request idempotency、guarded E2E                  | route guard 較廣但 service 僅允許 teacher；須維持分層契約說明                                                            |
| BE-5.3.2 | EVIDENCE AVAILABLE—待 CP1 人工確認            | AdminGuard + StepUpGuard、exact request/session binding、negative/positive E2E                              | exact Origin 依 shared CSRF guard；本輪未重跑各 branch                                                                   |
| BE-5.3.3 | EVIDENCE AVAILABLE—待 CP1/CP2 人工確認        | DeletionEvent/outbox schema、active/deleted invariant、payload null tombstone E2E                           | migration 證據限 `smartlearning_test`；不可宣稱 production deployment                                                    |
| BE-5.3.4 | EVIDENCE AVAILABLE—待 CP1/CP2 人工確認        | sequential replay、retention/admin race、canonical-event uniqueness                                         | 歷史記錄依序為 6/8 tests，目前 source 9 tests；final baseline 尚未凍結                                                   |
| BE-5.3.5 | EVIDENCE AVAILABLE—operational qualification  | manifest-driven reconciliation 可再次移除 restored answer-bearing rows，且 replay idempotent                | 不是透明 DB restore hook；仍需 production backup/restore runbook integration 與 watermark sequencing sign-off            |
| BE-5.3.6 | **BLOCKED—provisional evidence only**         | committed guarded resurrection simulation；另有 reported MinIO + PostgreSQL restart rehearsal               | 完整 rehearsal/spec/修正與紀錄尚未形成可重現 committed baseline；「backup restore」完成邊界尚待人工定義                  |

**CP0 provenance 摘要：**

- CP1 歷史證據主要記錄於 backend commit `02a31bd8780126f8a13ccd63400aa7c6beeee5e6`；較早 archive E2E matrix 來自 `584e6613441bbe5be1207853809718016258574e`。
- 稽核時 backend `HEAD` 為 `e880b0ef69b1116ced44fcbac639458ed5eaba9e`，local `main` ahead of `origin/main` 9 commits，且 governance/retention/S3/metrics/task evidence 含 modified/untracked files。因此最新 `10 suites / 41 tests` 與 MinIO rehearsal 只能列為 reported evidence，不能視為 clean-revision verification。
- 歷史 DB evidence 均指向 guarded `smartlearning_test`；未找到 production migration、production purge、production object-store 或 production restore 證據。
- test counts 是不同 checkpoint 的歷史快照（archive E2E 3 → 6 → 8 tests；目前 source 9 declarations），不得合併成一次 final regression。

**CP0 結論：PARTIAL／NOT READY FOR BE-5 WBS CLOSEOUT。** 最主要 blockers 為 BE-5.2.4 缺 true dry-run、current dirty-tree provenance、scheduler/spec drift、BE-5.3.6 rehearsal 尚未形成可重現 baseline，以及 production operational certification 缺口。所有 BE-5 checkbox 保持未勾。

**STOP／人工確認：** CP0 到此停止；不得進入 CP1、CP2、執行 destructive operation 或開始 FE-6。只有收到使用者明確回覆：

`BE-5 Checkpoint 0 verified; authorize contract evidence review.`

才可進入 BE-5 CP1。任何後續 migration deploy、truncate、purge、early deletion、reconcile-apply、restore rehearsal 或 external upload 仍須另行指定 exact environment/database、run-scoped disposable data 與 exact operation；本 checkpoint 的確認不構成 destructive authorization。

### BE-5.1 Archive-domain Checkpoint E evidence draft（2026-09-11）

> 本節 supersede BE-5.1 的歷史 current-state 解讀，但不改寫 CP0/CP1 provenance。證據基於 backend HEAD `1c841ca` 加目前 dirty working-tree changes；不宣稱新的 clean immutable commit。Gate E 已確認，以下 evidence 作為 BE-5.1 正式 WBS closeout 記錄；最終 regression 與 clean pinned revision 仍由 Gate F 另行記錄。

| WBS item | Candidate disposition | Current evidence                                                                                                                                                                      | Limitation                                                                                                     |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| BE-5.1.1 | VERIFIED CANDIDATE    | Manual/auto close 共用 `closeSessionInTransaction()`；close state、archive、Participant anonymization 與 transactional outbox 使用同一 transaction；replay 回既有 archive             | Atomicity 為 shared transaction call-graph evidence，無 failure-injection runtime rollback proof               |
| BE-5.1.2 | VERIFIED CANDIDATE    | `ArchivedResult.liveSessionId` unique、FK/check/index 與兩個 archive migrations 已 reconciliation；guarded `smartlearning_test` migration evidence 已存在                             | 無 production migration deployment/schema probe evidence                                                       |
| BE-5.1.3 | VERIFIED CANDIDATE    | `projectArchive()` 重用 `aggregateResults()`；stable ordering、strict `schemaVersion: 1` parser、replay 不 create/update                                                              | Application/domain create-once 不阻止 privileged direct SQL                                                    |
| BE-5.1.4 | VERIFIED CANDIDATE    | Teacher owner/admin global/student denied/foreign hiding；Course/LiveSession/status/inclusive `closedAt` filters；filter-before-pagination、`closedAt DESC, id DESC`、OpenAPI schemas | 無新增 index/query-plan/load evidence；current changes 未提交                                                  |
| BE-5.1.5 | VERIFIED CANDIDATE    | poll/quiz aggregate-only、open-text anonymous `{ text }`、nested prohibited-field coverage、close/replay participant unlinking                                                        | Submission 可在 governed purge 前保留 FK 至 anonymized Participant；open-text 本身仍可能含使用者輸入的敏感內容 |
| BE-5.1.6 | VERIFIED CANDIDATE    | waiting/active archive attempts 各有獨立 negative E2E；zero archive、lifecycle unchanged、active refusal 無 anonymization side effect；cancel 不 archive                              | 為 guarded archive E2E focused evidence，非完整 repository regression                                          |

**Recorded verification:** Checkpoint B/C guarded archive E2E `1 suite / 13 passed / 0 failed / 0 skipped`、OpenAPI `1 suite / 5 passed / 0 failed / 0 skipped`；Checkpoint D projection/replay units `2 suites / 16 tests PASS`；typecheck/lint/format/build/diff check PASS。Checkpoint D 未新增 DB-backed replay run。

**BE-5.2／BE-5.3 boundary:** 本次只整理 BE-5.1 evidence；不勾選、不宣稱 retention operational readiness、early-deletion restore/no-resurrection、production migration 或 production operation 已完成。

**CP0 人工確認紀錄（2026-09-10）：** 使用者已明確回覆 `BE-5 Checkpoint 0 verified; authorize contract evidence review.`；此批准僅解除 CP1 read-only contract review gate，未授權 CP2 或任何 destructive operation。

### BE-5 CP1 — Contract evidence review（2026-09-10）

> **審查邊界：** 本輪只做 static/read-only review；未執行 tests、migration、DB、application、container 或 network command。歷史 PASS 僅作 evidence input，不等同 current dirty tree verification。

| Contract area                       | Verdict                                              | 已確認證據                                                                                                     | Blocking gap／decision                                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archive list safe DTO               | PASS implementation／evidence freeze BLOCKED         | `ArchivePageDto` + `ArchiveSummaryDto`；summary 不含 payload/identity linkage                                  | OpenAPI 使用 partial `objectContaining`，未鎖 exact properties、required/nullability/formats                                                                                                                              |
| Pagination/filter/order             | PASS implementation／HTTP evidence incomplete        | `page>=1`、`pageSize 1..100`、course UUID、`active                                                             | deleted`；owner filter/count before pagination；`closedAt DESC,id DESC`                                                                                                                                                   | 缺 invalid query/bounds、combined filters、deleted filter、multi-page boundary HTTP tests；OpenAPI 未鎖 query schema |
| Teacher/admin scope                 | PASS                                                 | Teacher owner scope、admin global scope、foreign detail 404、foreign filter empty page                         | 缺 explicit admin-list-all、student list/detail 403 與「無 student route」regression                                                                                                                                      |
| Active/deleted union                | PASS source／OpenAPI BLOCKED                         | controller `oneOf` + `status` discriminator；deleted wire payload key absent、DB payload null                  | Generated OpenAPI test 未鎖 discriminator、required payload/deletion 與完整 variant schema                                                                                                                                |
| Active payload privacy              | **BLOCKED—correctness/privacy defect**               | 新建 archive 的 `projectArchive()` 為 aggregate-only，open text 為 `{ text }`                                  | `parseArchivedResult()` 驗證部分欄位後直接回傳原 question object；persisted/legacy JSON 的額外 `participantId`、`accountId`、token 等欄位可穿透 active-detail HTTP payload；現有 test 未覆蓋 parser extra-field stripping |
| Participant anonymization           | PASS design／manual model acceptance pending         | archive 後 `accountId=null`、displayName anonymous、token hash rotation；HTTP projection無 identity            | Submission 在 purge 前仍保留到 anonymized Participant 的 FK；需明確接受「projection de-identification，不是立即刪除 linkage row」模型                                                                                     |
| Teacher deletion request            | PASS core／negative matrix incomplete                | teacher-only service check、owner scope、CSRF、reason enum、serialized outstanding request                     | 缺 admin requester、foreign/nonexistent/deleted archive、malformed UUID/invalid reason endpoint-specific tests                                                                                                            |
| Request idempotency                 | PASS implementation／contract clarification required | sequential/concurrent retries 回原 receipt，DB partial unique index                                            | 屬 resource-state idempotency，changed retry body 仍回原 receipt；須明確寫入 API/OpenAPI contract                                                                                                                         |
| Admin pending queue                 | PASS core                                            | admin-only、requested-only、oldest-first、safe non-answer projection；anonymous 401／teacher 403               | 缺 pagination/status-invalid/tie-order tests；必要 session/course metadata 尚無正式 data-classification rationale                                                                                                         |
| Request-bound confirmation          | PASS identity binding／**reason semantics BLOCKED**  | `deletionRequestId` + liveSession binding；mismatch 404；`confirmed:true`                                      | Admin confirmation reason 可與 teacher request reason 不同；需決定「必須一致」或「admin adjudication 並保留 requested/resolved reasons」                                                                                  |
| Step-up                             | PASS core／negative matrix incomplete                | SessionGuard + CSRF + AdminGuard + StepUpGuard；無 step-up 403，step-up 後成功                                 | 缺 expired/other-session/other-account/future timestamp/revocation BE-5-specific evidence；step-up 綁 session，不綁 request                                                                                               |
| CSRF/exact Origin                   | PASS implementation／evidence incomplete             | Shared `CsrfGuard` exact allowlist + cookie/header match；missing CSRF 403                                     | 缺 absent/malicious/deceptive Origin、missing cookie/header、mismatch 與 exact accepted Origin 的 BE-5 matrix                                                                                                             |
| Shared locked transition            | PASS                                                 | Admin delete 與 retention 共用 transition，outer path 採 row lock/`SKIP LOCKED`                                | Private helper interface 本身未強制 lock token；仍依 caller convention                                                                                                                                                    |
| Canonical tombstone                 | PASS core                                            | payload null、answer-bearing rows delete、canonical deletion event + manifest outbox；DB uniqueness/invariants | deletion CHECK 未完全限制 reason、actor nullability 或 exact deleted categories，部分仍是 application invariant                                                                                                           |
| Confirmation replay                 | PASS implementation／**semantic contract gap**       | identical replay 回 canonical result，僅一 canonical event                                                     | resolved request 以 conflicting reason replay 也 silently 回舊結果；須明定 replay-insensitive 或回 409，並補 test                                                                                                         |
| Retention/admin race reconciliation | PASS core／assertions incomplete                     | one canonical event、request 離開 queue、shared transition                                                     | 缺 winner-specific HTTP result、trigger/reason、`resolvedByEventId`、timestamp 與 replay canonical assertions                                                                                                             |
| Additive migration                  | PASS with qualification                              | preflight checks、columns/constraints/indexes、guarded `smartlearning_test` deploy record                      | migration 會 full-table backfill valid archives 並 replace index，不是 metadata-only；無 production deploy evidence                                                                                                       |
| OpenAPI/error contract              | **BLOCKED**                                          | 五個 paths 與部分 DTO/privacy assertions 存在                                                                  | 未完整鎖 methods、request required/enums、query bounds、union、auth/CSRF、envelope、400/401/403/404/409 schemas                                                                                                           |

**CP1 evidence/provenance review：**

- 歷史 CP1 record：targeted units `2 suites / 6 tests, 0 failures`、OpenAPI `1 suite / 5 tests, 0 failures`、archive E2E `1 suite / 6 tests, 0 failures, 0 skips`，migration 僅套用 guarded `smartlearning_test` 並記錄 16 migrations up to date。
- 只有 archive E2E 明確記錄 `0 skips`；unit/OpenAPI 未記 skip count，repository 亦無保存的 machine-readable Jest/JUnit artifacts，因此不能宣稱 CP1 全 bundle `0 failed / 0 skipped`。
- CP1 與後續 CP2 implementation/evidence 同時進入 commit `02a31bd`，沒有可獨立審查的 CP1-only immutable revision；目前 backend `HEAD e880b0e` 又有 governance/retention/S3/metrics dirty/untracked changes。
- Current source counts（archive E2E 9 declarations、兩個 focused unit files 合計 5 declarations）與歷史 CP1 6 E2E／6 unit counts不同；這是 scope 演進訊號，不能用歷史結果證明 current tree。
- `frontend-api-reference.md` 的 §5 contract 大致正確，但其 generated date、scheduler/verification status 已過時；BE-5 completion plan 也仍保留 migration/DB E2E 未執行的歷史敘述。

**CP1 結論：BLOCKED／APPROVAL WITHHELD。** 核心 workflow 與 schema contract 大致成立，但 active-detail strict privacy allowlist、reason/replay semantics、完整 OpenAPI/negative security evidence、全 bundle zero-skip 與 clean immutable provenance 尚未達到 contract freeze／release-grade evidence。所有 BE-5 checkbox 保持未勾，CP2 不得開始。

**CP1 最小 remediation conditions：**

1. 將 `parseArchivedResult()` 改為 nested strict allowlist reconstruction，補 persisted/legacy payload prohibited-extra-field negative tests。
2. 人工決定並凍結 teacher requested reason、admin resolved reason 與 conflicting replay semantics。
3. 擴充 OpenAPI assertions：exact methods/query/body/required/enums、active/deleted discriminator、payload variants、security/error envelopes、no student route。
4. 補 deletion-request existence-hiding、student denial、pagination/invalid query、exact-Origin/CSRF、step-up session/expiry 與 race reconciliation negative matrix。
5. 明確文件化 participant linkage 是 projection-level de-identification，並同步 stale API reference/completion-plan metadata。
6. 在 clean/pinned revision 上重跑 targeted unit、OpenAPI、guarded DB-backed E2E，逐項記錄 `0 failed / 0 skipped`、DB target、migration status 與 machine-produced result artifact。

**STOP／人工確認：** 此 CP1 review 已完成，但目前**不具備授權 CP2 的條件**。下一步僅能在使用者明確回覆下進行 CP1 remediation：

`BE-5 Checkpoint 1 review acknowledged; authorize CP1 remediation only.`

此回覆不授權 CP2、migration deploy、truncate、purge、early deletion、reconcile-apply、restore rehearsal 或 external upload。完成 remediation 並重新提供 clean-revision evidence 後，才會再次要求：

`BE-5 Checkpoint 1 verified; authorize CP2 operational evidence review.`

#### BE-5 CP1 remediation closeout（2026-09-10，等待人工 final sign-off）

**授權與契約決策：** 使用者已回覆 `BE-5 Checkpoint 1 review acknowledged; authorize CP1 remediation only.`，並選擇 strict reason binding：Admin confirmation reason 必須等於 Teacher request reason；initial mismatch 與 resolved conflicting replay 都在 destructive write 前回 HTTP 409 `CONFLICT`、`field:"reason"`。matching replay 回 canonical result，request/session identity mismatch 維持 existence-hiding 404。另已授權只對 guarded `NODE_ENV=test`／`smartlearning_test` 執行 E2E reset/truncate 與 suite-owned destructive fixtures；未授權 dev/staging/production、external S3/MinIO、restore/upload 或手動 migration deploy。

**完成的 remediation：**

- `parseArchivedResult()` 改為 poll/quiz/open-text 全層級 nested strict allowlist reconstruction；persisted/legacy extra fields 不再穿透 active-detail HTTP，known malformed field fail closed。
- Reason equality 在 resolved replay return 與 destructive transition 前檢查；conflict 不會刪除 rows、更新 archive、建立 deletion event 或 manifest outbox。
- OpenAPI 凍結五個 governance paths/methods、integer pagination、filters、required request bodies/enums、active/deleted discriminator、nested result DTO 與 prohibited property names；no student history path。
- Guarded E2E 擴充至 student denial、invalid query、Admin global list、deletion-request existence hiding、CSRF/Origin、session-bound/expired step-up、strict reason replay 與 canonical race reconciliation。
- API reference、結果資料治理、即時同步/結果治理設計與 historical completion plan 已同步同一 404/409/replay/privacy 契約。Schema/migration 不變。

**Machine-readable evidence：**

| Gate                      | Result                                            | Artifact／environment                                                                                                                         |
| ------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Archive parser            | PASS — 1 suite / 10 tests / 0 failed / 0 skipped  | `/home/user/.claude/test-results/archive-projection-20260910065124-68979.json`                                                                |
| Focused governance units  | PASS — 2 suites / 15 tests / 0 failed / 0 skipped | `/home/user/.claude/test-results/governance-focused-20260910065359-70174.json`                                                                |
| OpenAPI                   | PASS — 1 suite / 5 tests / 0 failed / 0 skipped   | `/home/user/.claude/test-results/openapi-e2e-20260910-070409-75506.json`；no DB mutation                                                      |
| Archive governance DB E2E | PASS — 1 suite / 11 tests / 0 failed / 0 skipped  | `/home/user/.claude/test-results/archive-governance-20260910T174401200177123.json`；guarded `smartlearning_test`，migration status up to date |
| Static gates              | PASS                                              | typecheck、lint:check、format:check、build、`git diff --check`                                                                                |

**Provenance／邊界：** backend branch `main`、HEAD `e880b0ef69b1116ced44fcbac639458ed5eaba9e`；本 evidence 精確對應目前 working tree，而非宣稱 clean commit。Pre-existing retention/S3/metrics dirty work被保留且未納入 CP1 acceptance。沒有 commit/stage、CP2、FE-6、production operation、external upload 或 restore。

> **Provenance 更新（2026-09-11，committed）：** 原 CP1 remediation 證據（strict allowlist parser、reason binding、OpenAPI freeze、guarded E2E 與 API reference/docs 同步）現已 commit 於 backend **`1c841ca`**（`feat(governance): harden archive projection, reason binding, and retention observability`）並推至 `origin/main`。此 commit 同時納入 retention/metrics 可觀測性與 S3 sandbox rehearsal 工具；CP1 acceptance evidence 自此可由單一 clean revision（`1c841ca`）重現，不再依賴 dirty working tree。本更新只記錄 provenance 轉為 committed，**不自動勾選 BE-5**；CP2/final reconciliation 的人工 gate 與 STOP 條件維持不變。

**CP1 remediation disposition：EVIDENCE COMPLETE／AWAITING MANUAL SIGN-OFF。** 本 closeout 只解除原 CP1 blockers，不自動勾選 BE-5、FE-6 或 QA-2.7。到此 **STOP**；只有收到使用者明確回覆：

`BE-5 Checkpoint 1 verified; authorize CP2 operational evidence review.`

才可進入 CP2。該回覆亦不自動授權任何新的 migration、purge、restore、reconcile 或 external upload；每個 destructive operation 仍須指定 exact target 與資料範圍。

**CP1 人工確認紀錄（2026-09-10）：** 使用者已明確回覆 `BE-5 Checkpoint 1 verified; authorize CP2 operational evidence review.`；此批准只解除 CP2 read-only evidence review gate，未授權新的 purge、restore、reconcile-apply、migration deploy、external upload、production enablement 或 cleanup。

### BE-5 CP2 — Operational evidence review（2026-09-10）

> **審查邊界：** 本輪只讀取 current source/diff、tests、migrations、runbook、metrics/alerts、task history、Git provenance 與 sandbox narrative；未執行 tests、DB、migration、container、network、purge、restore、reconcile、upload、cleanup 或檔案修改。歷史 PASS 與 dirty rehearsal 只作 evidence input，不等於 current clean-revision／production verification。

| Operational criterion              | Evidence disposition                        | 已確認                                                                                           | Blocking gap／risk                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 90-day deadline／`purgeAt`         | EVIDENCE COMPLETE—guarded contract          | `TIMESTAMPTZ`、`closedAt + 90 days`、due index、exact-ms E2E                                     | 無 production migration/schema/clock evidence                                                                                                                                         |
| Due selection                      | EVIDENCE COMPLETE—guarded DB                | `status=active`、`purgeAt<=now`、oldest-first、deterministic tie、bounded DB E2E                 | 無 production population/query-plan/capacity/backlog-drain evidence                                                                                                                   |
| Bounded/idempotent purge worker    | PARTIAL                                     | limit 1–100、transactional tombstone/outbox、repeat idempotency                                  | Operator `run-once` 仍 no-op；無 production scheduler/multi-replica qualification                                                                                                     |
| Concurrent claim                   | EVIDENCE COMPLETE—guarded DB                | `FOR UPDATE ... SKIP LOCKED`、one-row transaction、concurrent E2E canonical count                | 無 multi-pod pools、lock timeout/failover/high-contention evidence                                                                                                                    |
| Purge poison-row                   | PARTIAL                                     | 單次 run 內排除 failed ID、繼續後續 rows、unit count/metrics                                     | 缺 DB rollback/continuation/retry；每 tick 會重撞 oldest poison row；無 durable backoff/quarantine                                                                                    |
| Execution-equivalent dry-run       | **BLOCKED**                                 | `inspectDue()` 可 read-only 顯示 due count/sample                                                | 與真實 claim/validation path不同；`run-once` 回 `executed:false`；無可批准的 no-delete artifact                                                                                       |
| Scheduler overlap/shutdown/restart | **BLOCKED／PARTIAL**                        | in-process overlap guard、shutdown drain、歷史 6 tests；sandbox 記錄 MinIO/Postgres restart      | Current scheduler 新增 manifest inspection，但 unit fixture 未 mock/assert；無 process crash/rolling/multi-replica restart evidence                                                   |
| Transactional manifest outbox      | EVIDENCE COMPLETE—implementation            | destructive transaction 同時寫 canonical event + unique outbox，FK restrict                      | Production delivery仍未接通，不能把 outbox存在等同 durable external evidence                                                                                                          |
| Export retry/lease/fencing         | EVIDENCE AVAILABLE—committed local-provider | bounded claim、`SKIP LOCKED`、lease token、backoff、attempt exhaustion、ack-loss integration     | Integration suite DB unavailable 時會 early-return 而非 fail/skip；需 machine evidence證明 assertions 真執行                                                                          |
| Controlled local provider          | TEST-ONLY                                   | exact duplicate accepted、conflict rejected、無 network credential                               | Process-local memory不 durable，不能用於 production；outbox可能標 exported但唯一副本在 RAM                                                                                            |
| S3 immutable provider              | **BLOCKED—integrity/security**              | deterministic JSON/key、SHA-256、`If-None-Match:*`、Object Lock、SSE；disposable MinIO narrative | 412 後 write-only GET 403 被當作 replay success，只證明 key存在、不證明 bytes/checksum相同，可能把錯物件標 exported                                                                   |
| S3 encryption/config               | **BLOCKED for production**                  | AES256／aws:kms／none config、sandbox相容性                                                      | `none` 未限 sandbox；KMS key ownership隱含；無 bucket versioning/Object Lock/encryption/prefix readiness check；endpoint無 TLS/host allowlist                                         |
| Manifest exporter operation        | **BLOCKED**                                 | Exporter service存在；untracked `scripts/export-once.ts` 可呼叫                                  | Tracked CLI 明確拒絕 export；scheduler未呼叫 exporter；無 committed/gated worker、pause/health/ownership                                                                              |
| Reconciliation/watermark           | PARTIAL                                     | manifest identity/category validation、locked idempotent apply、guarded no-resurrection          | Watermark是 local JSON rewrite，無 atomic rename/fsync/file lock/CAS/multi-process exclusion；DB apply與watermark非同 transaction                                                     |
| Restore/no-resurrection            | PARTIAL／PROVISIONAL                        | guarded test simulation；dirty narrative稱 S3 fetch/apply/replay + MinIO/Postgres restart        | Filtered run有 8 name-filter skips；完整 spec/runtime未 clean commit；非真實 production backup/restore流程                                                                            |
| Retention/manifest metrics         | **BLOCKED／PARTIAL**                        | purge selected/deleted/failed、backlog/age、lag/dead/reconciliation metric definitions           | Gauges只在 enabled purge後 refresh；lag help「became due」但 implementation用 `createdAt`；critical series無 absent/stale alert                                                       |
| Reconciliation-failure metric      | **BLOCKED—wrong lifecycle**                 | CLI exception會 increment counter                                                                | CLI使用短生命週期 registry後退出，長駐 backend `/metrics`／Prometheus通常看不到該 counter                                                                                             |
| Prometheus alert rules             | STATIC HANDOFF ONLY                         | repeated failure、age、backlog、lag、dead、reconciliation rules存在                              | 無 current promtool/deployed Prometheus evidence；threshold未由容量資料校準                                                                                                           |
| Alert-firing rehearsal             | **BLOCKED—overstated**                      | Dirty task narrative以數值人工比較部分門檻                                                       | Script只 seed SQL／print metrics，未執行 Prometheus rule pending→firing、`for:`、receiver delivery、recovery/resolved；部分 alerts未觸發                                              |
| Dashboard/routing/on-call          | **BLOCKED**                                 | dashboard inventory列 PromQL；runbook有一般 stop boundary                                        | 無 deployable dashboard/UID、Alertmanager route/receiver、owning team/rotation/escalation/notification proof                                                                          |
| Capacity/W1–W8                     | **BLOCKED**                                 | 只有目標與 assumptions                                                                           | 無 batch duration/drain rate、DB/I/O/object-store impact、interactive isolation、multi-worker 或 W1–W8量測                                                                            |
| Production defaults/readiness      | **BLOCKED**                                 | purge default disabled                                                                           | `.env.production.example` 選 volatile local provider；無 staging dry-run/purge、production immutable bucket、canary/ramp/pause/approvers                                              |
| Provenance／cleanup                | **BLOCKED**                                 | committed exporter base + reported dirty MinIO evidence                                          | 24 tracked modified + untracked scripts/spec/generated；broken `.gitignore` rule使 `generated/`暴露；MinIO container/volume/credential與test rows尚未有 owner/expiry/cleanup closeout |

**CP2 critical security finding：** Current dirty `S3ManifestProvider` 對 conditional put 412 後的 verification GET，若 write-only credential 回 403，會直接視為 idempotent success。412 只證明同 key 已存在，不能證明既有 object 與預期 canonical manifest 相同；若 key 被錯誤或惡意內容占用，outbox 可能被標為 `exported`。Production enablement 前必須改為「可驗證既有 checksum/metadata」或 fail closed，不能將 403 視為 equality proof。

**CP2 evidence levels：**

- **Committed/guarded evidence：** transactional outbox、exporter retry/lease/fencing、controlled local-provider integration、guarded `smartlearning_test` retention/concurrency/no-resurrection。
- **Dirty/untracked disposable evidence：** MinIO upload、encryption option、metrics wiring、alert threshold comparison、restart narrative與 rehearsal scripts/spec。
- **未證明：** production exporter/scheduler、true dry-run、Prometheus/Alertmanager firing、dashboard/routing/on-call、capacity、production migration/purge/object-store/restore。
- Backend 仍為 `main`／HEAD `e880b0ef69b1116ced44fcbac639458ed5eaba9e`，ahead of origin 9 commits；current CP2 tree含大量 dirty/untracked work，不能由單一 immutable revision重現。Historical counters不得跨 revisions彙總。

**CP2 結論：PARTIALLY COMPLETE／OPEN—NOT PRODUCTION READY；APPROVAL WITHHELD。** Deadline、due selection、transactional outbox與guarded concurrent claims有強證據；但 dry-run、scheduler/spec、S3 replay integrity、export wiring、metrics lifecycle、genuine alert delivery、capacity、production defaults、provenance及cleanup均有 blockers。所有 BE-5 checkbox 保持未勾；不得進入 BE-5 final reconciliation或FE-6。

**CP2 最小 remediation groups：**

1. **Provenance/safety：**凍結 clean reviewable revision；修正 generated ignore；區隔/commit或明確捨棄 rehearsal tools；記錄版本、migration checksums、commands、zero-skip artifacts；完成 MinIO credential/container/volume/test-row owner/expiry/cleanup plan。
2. **Worker/dry-run：**建立與 destructive claim/validation等價但no-write的 dry-run artifact；補 purge poison-row DB rollback/retry/backoff；修 scheduler fixture、process restart/multi-replica ownership。
3. **Exporter/S3：**只保留一個 gated operator interface；接上 committed exporter worker/scheduler；412後無法驗證 object時 fail closed；production禁止未證明 encryption；加 bucket/TLS/endpoint/prefix readiness。
4. **Reconciliation：**使watermark durable/atomic/single-writer；把 reconciliation failure變成長駐可 scrape signal；凍結 lag semantics與missing/stale series handling。
5. **Observability/ops：**以 disposable Prometheus + receiver 真正驗證 syntax、ingestion、pending→firing、notification、recovery/resolved及全alerts；提供deployable dashboard、Alertmanager routing、owner/escalation與alert-specific runbook。
6. **Capacity/rollout：**完成batch/drain/DB/I/O/object-store/multi-worker與W1–W8 evidence；staging dry-run/bounded purge、production immutable provider、canary/ramp/pause與approvers。

**STOP／人工確認：** CP2 review 已完成，但目前**不具備授權 final reconciliation 或 production operation 的條件**。下一步只能在使用者明確回覆後規劃／執行 CP2 remediation：

`BE-5 Checkpoint 2 review acknowledged; authorize CP2 remediation planning only.`

此回覆不授權任何 code edit、migration、purge、restore、reconcile、external upload、container/credential cleanup、production/staging operation、commit或FE-6。完成 remediation plan 後仍須逐個高風險操作另行確認 exact target／scope。

> **CP2 remediation 進度更新（2026-09-11，已 commit）：** CP2 remediation groups 1（provenance/safety）與 3（Exporter/S3 integrity 部分）已有 committed 進展，backend `main` 已與 `origin/main` 同步、working tree clean：
>
> - **Checkpoint A provenance baseline（`9fc65b1`）：** 恢復 `/generated/` ignore 覆蓋；凍結 baseline 紀錄（main @ `e880b0e`、locked 版本 Nest 11.2.0／Prisma 7.9.1／TS 5.9.3、18 個 tracked migrations 的 SHA-256 manifest）；dirty work 與 rehearsal tooling（`alert-rehearsal-seed`、`export-once`、`sweep-and-scrape`、S3 sandbox spec）分類為 deferred promotion candidates；cleanup owner/expiry register 記為明確 blockers。
> - **Checkpoint B fail-closed S3 replay（`aec12a9`）：** 關閉 CP2 critical security finding——`S3ManifestProvider.put()` 的 412 後 403 GET 不再視為 idempotent success；replay 須由 `HeadObject` 證明 `ContentLength` 與 equality metadata（`manifest-sha256`／`deletion-event-id`／`contract-version`）一致，任何不可驗證狀態 fail closed。另加 `S3_KMS_KEY_ID` env 驗證與 5 條 production cross-field checks（拒絕 local provider、`none` encryption、non-https S3 endpoint、無 durable provider 的 purge）。
> - **Checkpoint C retention/metrics observability（`1c841ca`，同時承載 CP1 remediation）：** archive strict allowlist projection、deletion reason binding（409 `CONFLICT` `field:"reason"`）、retention manifest lag/dead gauges 與 reconciliation failure counter、OpenAPI integer pagination 凍結。
>
> **未解除的 CP2 blockers（維持 APPROVAL WITHHELD，2026-09-12 更新）：** true execution-equivalent dry-run（BE-5.2.4）、scheduler fixture/process restart/multi-replica evidence、exporter worker/scheduler wiring、watermark durability、dashboard/routing/on-call（routing/on-call 仍未證明）、capacity/W1–W8、production migration/purge/object-store/restore 證據、sandbox credential/container/volume cleanup owner 與 expiry。**genuine Prometheus/Alertmanager firing rehearsal 已由 Checkpoint G step 4 解除（見下方 Checkpoint G 紀錄），並因此發現並修正 `job`→`bg_job` label collision。** 所有 BE-5 checkbox 仍保持未勾。

> **BE-5.2 Checkpoint G status（2026-09-12）：** Checkpoint G 為 BE-5 CP2 remediation group 2（worker/dry-run）與 group 5（observability/ops）的後續推進。目前 steps 3 與 4 已 GREEN 並 commit；steps 5 起仍各自置於授權 gate 之後，不得自動解鎖。
>
> - **Step 3 — S3 sandbox upload rehearsal：GREEN（`6a21de7`，工具層 `a1bbdbb`）。** 以 disposable MinIO（`ops/minio-rehearsal/`，throwaway container+volume、prefix-scoped write-only user、credentials 寫入 gitignored `.env.minio-rehearsal`，teardown prompt-guarded）對 guarded `smartlearning_test` 執行 `test/s3-sandbox-rehearsal.integration-spec.ts`，PASS 1/1。人工核對 canonical body、checksum metadata、object-lock COMPLIANCE +90d。此屬 BE-5 retention 證據，非 FE-6 implementation。
> - **Step 4 — Prometheus/Alertmanager firing rehearsal：GREEN（`849e6b4` label-fix＋rehearsal toolkit、`0b928cf` evidence、`63bc03d` canary isolation）。** 以 disposable Prometheus v2.53 + Alertmanager v0.27（`ops/prom-rehearsal/`）對 guarded `smartlearning_test` backend 端到端驗證規則 → Alertmanager → webhook：`OldestDueAgeHigh` 與 `ManifestDeadRecords` fired、`PurgeNoRecentSuccess` pending→resolved（negative case）；**發現真 production defect——app metric 的 `job` label 與 Prometheus external scrape `job` label 衝突（scrape 改名 `exported_job`），導致 `smartlearning_job_*` 上所有 `job="retention_purge"` 等 alert rule 永不觸發**；已把 `metrics.service.ts`／`prometheus-alerts.yml`／`dashboard-inventory.md` 上的 label 改名為 `bg_job`（`bg_job=` 為正確 selector，不得改回）。`63bc03d` 另把 recurring scheduler activation 與 one-shot retention commands 分離、以 master/operation/scheduler gates 管控背景 worker、force operator CLI 抑制 scheduler 啟動，並把 step 5 標為 blocked 直到有可識別的 staging 目標與 immutable provider。
> - **Step 5（staging canary）與其後（capacity／production rollout／WBS closeout）：PENDING**，各需獨立使用者授權 gate；不得以 sandbox/dirty rehearsal 宣稱 production readiness。此紀錄不自動勾選 BE-5、FE-6 或 QA-2.7。

---

## BE-6 Auto-close Scheduler

- [x] BE-6.1 定義 8 小時 hard limit
- [x] BE-6.2 Manual／auto close 共用 application service
- [x] BE-6.3 建立 bounded scheduler claim
- [ ] BE-6.4 建立 idempotent retry
- [ ] BE-6.5 建立 clock-controlled deterministic tests
- [ ] BE-6.6 建立 process restart recovery test
- [x] BE-6.7 建立 submit／auto-close race matrix
- [x] BE-6.8 建立 job lag、failure、retry metrics

> **BE-6 status（2026-09-11 WBS sync；implementation commit `144da34` 2026-08-28）：**
>
> - **BE-6.1／6.2／6.3 已關閉：** `LIVE_SESSION_AUTO_CLOSE_MS`（預設 8h）與 `LIVE_SESSION_AUTO_CLOSE_TICK_MS` 經 `env.validation.ts` 驗證；`LiveSessionService.autoCloseExpiredSessions()` 與 manual close 共用 `closeSessionInTransaction()`（同 close service、lock protocol、question cascade、post-commit governance/event boundary、`autoClosed=true`＋archive follow-up）；scheduler 以 row-lock serialized、`take: 50` bounded claim、per-candidate failure isolation（單一 candidate 失敗不阻斷其餘）、overlap guard、shutdown cleanup、startup sweep，註冊於 `LiveSessionsModule`。scheduler unit spec 3 tests（成功記數、failure 保留 swallow 行為、destroyed/overlap early-return）。
> - **BE-6.7 已關閉（與 BE-3.3 共享證據）：** `test/poll-submission.integration-spec.ts`（guarded `smartlearning_test`，2026-08-28 授權 run 8 tests PASS）涵蓋 submit-first／close-first commit ordering（以 authority row lock 序列化兩個真實 transaction，斷言 commit 而非 client 順序為 authority）、concurrent submissions 只接受一筆、close 先於 cancel 取得 lock、DB authority row 查證。此 race matrix 同時對應 BE-3.3.1–BE-3.3.4 與 BE-3.1 CP5 的 submit/close race 項目；WBS BE-3.3 與 BE-3.1 CP5 的勾選仍以各自的人工 checkpoint 為準，不因本項自動勾選。
> - **BE-6.8 已關閉（經 BE-8.7 CP7）：** auto-close scheduler/service 已納入 metrics instrumentation（`recordJobItem('live_session_auto_close', ...)`；instrumentation-boundary specs 5 suites / 35 tests PASS，含 readiness 與 alert inventory 的 auto-close 項目），CP7 manual verifier 2026-09-01 由使用者確認 `Checkpoint 7 verified`。job lag 語意與 retention lag 同樣採 `createdAt` 口徑，alert 門檻容量校準仍屬 OPS-2／BE-5 CP2 remediation 範圍。
> - **BE-6.4 未關閉：** per-candidate 失敗後下一 tick 自然重試、close 為 stable conflict（重複 close 不改寫 `closedAt`）已有間接證據，但缺 dedicated idempotent-retry/restart 測試（含 retry 期間 duplicate close side effect 查證）。
> - **BE-6.5 未關閉（主要缺口）：** service 已支援 injected `Clock`，但缺 controlled-clock deterministic test 證明「滿 8 小時 → closed、active question 同步 closed、`autoClosed=true`」完整 chain；現有 E2E 只斷言 manual close `autoClosed=false`。此缺口同時讓 BE-3.1 CP7（8 小時 auto-close handoff）維持 `DEFERRED/BLOCKED`——不得以 manual close 證據代替 auto-close 證明。
> - **BE-6.6 未關閉：** 缺 process restart recovery（crash／rolling restart 後 scheduler 重掃描、lease/claim 不產生 duplicate close side effect）的專屬測試。
> - **歷史邊界更正：** BE-6 slice 當時 BLOCKED 的 `live-session-close-cancel.e2e-spec.ts`（`Missing __Host-csrf cookie` fixture）已在後續 BE-3.1/BE-7 checkpoint run 中修復並通過（12 tests、lifecycle matrix 65 tests 等）；但這些 run 只覆蓋 manual close，未覆蓋 scheduler 觸發的 auto-close E2E。**BE-6 整體 disposition：PARTIAL — 不得宣稱完成；CP7 handoff 與 BE-6.4/6.5/6.6 專屬證據仍待人工 checkpoint。**

---

## BE-7 Durable Realtime

### BE-7.1 Outbox

- [ ] BE-7.1.1 設計 outbox schema
- [ ] BE-7.1.2 Domain mutation 與 outbox append 同 transaction
- [ ] BE-7.1.3 建立 `eventSeq`
- [ ] BE-7.1.4 建立 `aggregateVersion`
- [ ] BE-7.1.5 建立 publisher claim/retry/backoff
- [ ] BE-7.1.6 建立 outbox cleanup/retention

### BE-7.2 Replay／recovery

- [ ] BE-7.2.1 Reconnect 接受 `lastEventSeq`
- [ ] BE-7.2.2 建立 ordered replay
- [ ] BE-7.2.3 Sequence gap 觸發 `sync.required`
- [ ] BE-7.2.4 Snapshot 帶 authority watermark
- [ ] BE-7.2.5 驗證 duplicate、亂序、publisher crash、API restart

### BE-7.3 Redis multi-instance

- [ ] BE-7.3.1 導入 Socket.IO Redis adapter
- [ ] BE-7.3.2 Redis 不承載 domain authority
- [ ] BE-7.3.3 定義 Redis outage/degraded readiness
- [ ] BE-7.3.4 驗證 multi-instance fan-out
- [ ] BE-7.3.5 驗證 reconnect 時重新授權

---

## BE-8 Backend 工程與營運基準

**目標：** 補齊 auth/session 契約、帳號管理、CLI 生命週期、rate limit、redaction、observability 與 production topology 的工程基準；每個工作群組以「contract freeze → runtime 驗證 → 人工確認」收斂，全數以現有 v1 contract、DB-backed tests 與 OpenAPI 為證據，不新增課堂功能。

**依賴與前置：**

- BE-1／BE-2 完成後才可凍結 auth/session 契約；DB-backed 驗證僅限 `smartlearning_test`，先唯讀 `prisma:migrate:status`，隱式 migrate/truncate 邊界須記錄。
- BE-8.7 依賴 Redis 導入（BE-7.3 或 OPS-1.5）；Redis 未落地前本項標 `BLOCKED`，不得以 in-memory 實作冒充 multi-instance 驗證。
- BE-8.9／BE-8.10 與 OPS-1 分工：BE-8 只交付 backend 端 metrics endpoint／readiness 行為／topology 相容性，Nginx/Next 服務與 W1–W8 留 OPS-1／OPS-2。
- 生命週期與撤銷類項目（8.3、8.4）屬高風險（憑證／帳號不可逆操作），須獨立人工 Checkpoint。

### BE-8.0 Contract freeze 與人工授權（Checkpoint 0）

- [ ] 凍結 `GET /auth/session` 回應：`expiresAt` 為 UTC ISO 8601（結束空字串語意）、無 session＝401、envelope 形狀不變。
- [ ] 凍結錯誤契約：expired cookie／idle timeout／absolute timeout → 401 `AUTH_SESSION_EXPIRED`；其他未認證 → 401 `UNAUTHORIZED`；client 可依 code 區分但不影響 HTTP status。
- [ ] 凍結 account update scope：admin 可更新哪些欄位（displayName／role／canCreateCourse／mustChangePassword 等）、不可更新欄位、disabled／restore 交互行為、不洩漏 hash/credential。
- [ ] 凍結 CLI 憑證模型：key 版本、rotation 產生 successor 的語意（新 key 啟用、舊 key 寬限或立即失效——於 CP3 前由使用者決定）、expiry 欄位與計算、無法撤銷已提交 mutation 的邊界。
- [ ] 凍結 rate limit 契約：429 `RATE_LIMITED` + `retryAfterSeconds`、bucket 觸發條件（per-account / per-source / per-credentials）、CLI 與 batch 的 bucket 歸屬；沿用 US-F7 invariant（env 值必須 coerce 為 Number）。
- [ ] 確認 observability 目標：metrics 暴露端點（`/metrics` 或等價）、redaction review 的範圍清單（log sink、例外訊息、OpenAPI、Swagger 範例）。
- [ ] **人工 Checkpoint 0：** 使用者確認上述 contract 決策（尤其 CLI successor 寬限政策與 account update 欄位清單）、測試 DB target 為 `smartlearning_test`，並授權本輪 DB-backed 驗證（含 setup 內部 migrate/truncate 邊界）。未確認前不得進入 CP1。

**Stop：** contract 文件間矛盾、DB target/migration 不明、Redis 服務存在性不明、或 DB-backed suite 可能靜默 skipped。

### BE-8.1 CP1 — Session expiry 契約（8.1、8.2）

- [ ] `GET /auth/session` 回真實 `expiresAt`；idle 與 absolute timeout 到期前後值正確；未登入仍 401。
- [ ] expired session 觸發 401 `AUTH_SESSION_EXPIRED`；缺／壞 cookie 維持 `UNAUTHORIZED`；error envelope `error.code` 可區分。
- [ ] E2E 覆蓋：fresh session、idle-expired、absolute-expired、logged-out、malformed cookie；確認 8 個既有 auth 行為（login/logout/CSRF/step-up）不回歸。
- [ ] 同步 `docs/frontend-api-reference.md` 與 OpenAPI e2e assertions（FE-8.3／FE-8.4 由此消費）。
- [ ] **人工 Checkpoint 1：** 使用者抽查各案例的 response status／code／`expiresAt` 值，確認區分語意不是前端判斷。

### BE-8.2 CP2 — Account management update（8.3）

- [ ] 實作 update route／DTO，欄位範圍與 CP0 凍結一致；`forbidNonWhitelisted` 邊界驗證。
- [ ] E2E：admin update 成功、student/self 越權 403、未知 id 404 existence-hiding、disabled 帳號 update 行為、must-change-password 與 update 交互。
- [ ] 負向斷言：回應與 log 不含 password/hash/session/CLI key；`canCreateCourse=false` 不影響 CLI credential（M2 red card #8）—disable 仍撤銷。
- [ ] **人工 Checkpoint 2：** 使用者核對 update 前後 account rows 與 response DTO，確認欄位範圍與撤銷行為符合凍結契約。

### BE-8.3 CP3 — CLI key rotation／expiry／successor（8.4，高風險）

- [ ] 實作 rotation：產生 successor key、raw key 僅 issuance 時回傳一次、DB 只存 hash；新舊 key 切換語意依 CP0 決策（寬限或立即失效）。
- [ ] 實作 expiry：過期 key 驗證拒絕、邊界時間行為明確；rotation／expiry 不影響既有 batch idempotency 序列化。
- [ ] E2E：rotate 前後舊 key 行為、過期 key 401/403、disabled account 撤銷 CLI、非 admin 不可 rotate、CSRF/CLI auth guard 組合正確。
- [ ] 不可逆操作邊界：rotation 失敗時不得導致兩個 key 同時失效；確認 rollback 策略（保留 predecessor row 直到驗證通過）。
- [ ] **人工 Checkpoint 3：** 使用者親自以新舊 key 呼叫 CLI endpoint，核對 rotation 前後 DB rows 與 raw key 一次性回傳；任何雙 key 同時失效即停止。

### BE-8.4 CP4 — CLI courses 與 CLI/batch rate limit（8.5、8.6）

- [ ] `CLI courses list/create`：route、guard（`X-CLI-Key`）、DTO、envelope、course ownership 歸屬（CLI 建課的 owner account）凍結並驗證。
- [ ] CLI/batch rate limit：bucket 歸屬依 CP0、429 + `retryAfterSeconds`、window 過期真實失效（沿用 US-F7 real-clock tripwire 模式）。
- [ ] E2E 覆蓋 list 分頁、create 權限（`canCreateCourse` 語意）、rate limit 觸發／恢復、與 web session path 不互相污染。
- [ ] **人工 Checkpoint 4：** 使用者檢視 rate limit evidence（觸發、window 到期恢復）與 CLI course rows 的 owner 歸屬。

### BE-8.5 CP5 — Redis multi-instance login rate limit（8.7，依賴 Redis）

- [ ] 確認 Redis 服務已由 BE-7.3／OPS-1.5 導入；否則本 Checkpoint 標 `BLOCKED`，不阻塞 CP6 起的項目。
- [ ] 以 Redis 實作 per-account/per-source login bucket，multi-instance 行為驗證（兩個 backend instance 共用 bucket）。
- [ ] 驗證 Redis outage 的 degraded 行為：fail-open 或 fail-closed 須與 CP0／安全性文件一致，錯誤不洩漏內部細節。
- [ ] **人工 Checkpoint 5：** 使用者確認 multi-instance 驗證證據與 outage 行為決策。

### BE-8.6 CP6 — Redaction review（8.8）

- [ ] 逐項審閱 `pino-redaction.ts` 覆蓋新增欄位（本 WBS 各 slice 引入的 `expiresAt`、CLI successor key、account update 欄位、rate limit key 等）。
- [ ] 審計例外訊息／validation details／OpenAPI schema 範例不含敏感值；新增敏感欄位全數加入 redaction 清單並有 spec 防護（tripwire test）。
- [ ] **人工 Checkpoint 6：** 使用者抽查 log 輸出與 error envelope 實例，逐項比對 redaction 清單。

### BE-8.7 CP7 — Metrics 與 observability（8.9）

- [ ] 交付 metrics 暴露（login rate limit 命中數、realtime publish 失敗數、scheduler/retention job 指標、request 維度基礎指標），不引入高基數 label。
- [ ] dashboard/alert 最低集：5xx rate、DB unreachable、rate limit 持續命中、publish failure；readiness probe 在 Redis outage 時語意明確。
- [ ] 指標不含 sensitive 值（帳號、token、題目內容）；確認 metrics endpoint 在 production topology 的存取控制。
- [ ] **人工 Checkpoint 7：** 使用者檢視實際 metric 輸出與 alert 規則清單。

### BE-8.8 CP8 — Production-like topology 相容性（8.10）

- [x] 驗證 backend 在反向代理（Nginx TLS）後的行為：`X-Forwarded-*`／secure cookie／Origin 判斷／Socket.IO handshake 於 proxy 後正常；已於隔離 verifier network 驗證，host-loopback curl 受 Rancher Desktop WSL 環境限制。
- [x] 驗證 Redis 導入後的 Socket adapter 與 graceful shutdown（連線 drain、post-commit publish 不得因 shutdown 遺失 commit）；已驗證 required-mode readiness、teacher/participant projection、WebSocket upgrade 與 retryable shutdown signal。
- [x] 記錄 topology 環境變數與 rollout/rollback 步驟；已於 `ops/topology/README.md` 完成與 OPS-1 交接邊界，未重複 OPS-1 驗收。
- [x] **人工 Checkpoint 8：** 使用者於 2026-09-01 確認 `Checkpoint 8 verified`；隔離 production-like Compose topology 已完成登入／作答／連線驗證，proxy 後 cookie、CSRF、realtime 均正常。Redis automatic recovery 未於 30 秒內自行恢復，已保留為 follow-up，不宣稱該行為已證明。

### BE-8.9 CP9 — Final release evidence

- [ ] 建立 BE-8.1～BE-8.10 逐項對應表：每項標示 `runtime verified`／`BLOCKED（原因與依賴）`／`contract decision confirmed`。
- [ ] targeted DB-backed suites 0 failure、0 skipped；記錄 branch、HEAD、working tree、Node/npm/Prisma、DB target/migration status、每 suite test/skip count、最小失敗證據。
- [ ] quality gates：typecheck、lint:check、format:check、build、`git diff --check` 全數通過；`prisma:migrate:status` 僅讀核對。
- [ ] **人工 Final sign-off：** 使用者逐項回覆「Checkpoint X verified」；自動測試全綠不能取代人工確認。Redis 未落地時 CP5 須明確標示 BLOCKED，不得宣稱 BE-8 完成。

**BE-8 全域 Stop conditions：** DB-backed suite 靜默 skipped；raw CLI key／session token 進入 log 或二次回傳；rotation 造成雙 key 同時失效；`AUTH_SESSION_EXPIRED` 誤用於其他未認證情境或反之；rate limit 因 env 字串未 coerce 而永不過期；Redis outage 行為未經決策即上線；metrics 含高基數或敏感 label；proxy 後 cookie/CSRF/realtime 任一失效。

**風險與 rollback：** 8.1／8.2 為中風險（公開契約，additive 修正＋forward-fix）；8.3／8.4／8.6 為高風險（憑證／redaction，錯誤可能鎖死存取或洩漏）——rotation 以保留 predecessor row 為可逆邊界，redaction 變更附 spec tripwire；8.7／8.8 中高風險——feature flag／停用 Redis adapter 回退到 in-process rate limit 與單 instance；不得清除 `smartlearning_dev` 或以資料操作恢復已撤銷憑證。

**依賴：** BE-1／BE-2（auth 契約）、BE-7.3 或 OPS-1.5（Redis，僅 CP5）、OPS-1（topology 交接）；CP6 起不依賴 CP5，Redis 未就緒時可先推進。

---

# 3. 前端 WBS

## FE-1 Student 基礎與「我的課程」

### FE-1.1 Transport

- [x] FE-1.1.1 新增 student role types
- [x] FE-1.1.2 更新 account creation transport 支援 student
- [x] FE-1.1.3 新增 `GET /me/courses` transport
- [x] FE-1.1.4 新增 query keys 與 hooks
- [x] FE-1.1.5 統一 envelope unwrap 與 error mapping

### FE-1.2 Routing／authorization

- [x] FE-1.2.1 Student 登入導向 `/student`
- [x] FE-1.2.2 建立 Student route group/layout
- [x] FE-1.2.3 Session gate
- [x] FE-1.2.4 Student role gate
- [x] FE-1.2.5 `mustChangePassword` gate
- [x] FE-1.2.6 Logout 清除 query cache

### FE-1.3 我的課程

- [x] FE-1.3.1 Course list UI
- [x] FE-1.3.2 Loading state
- [x] FE-1.3.3 Empty state
- [x] FE-1.3.4 Error state
- [x] FE-1.3.5 Responsive layout
- [x] FE-1.3.6 Real-backend browser smoke

**依賴：** BE-1、BE-2 contract freeze。

**Closeout（2026-09-03）：** 使用者接受 FE-1.3 CP4 驗收結果；isolated real-backend browser run 為 1 Chromium test、0 skipped、aggregate cleanup PASS。FE-1.3.1–FE-1.3.6 僅依本次前端 task log 的 static/unit/browser evidence 關閉；BE-1／BE-2 formal contract freeze、QA-2.1 broader browser acceptance 與 FE-2 以後項目仍獨立未關閉。

---

## FE-2 Teacher Enrollment Roster

### FE-2.1 Transport

- [x] FE-2.1.1 Enrollment list/pagination transport
- [x] FE-2.1.2 Student search transport
- [x] FE-2.1.3 Add enrollment mutation
- [x] FE-2.1.4 Remove enrollment mutation
- [x] FE-2.1.5 Query invalidation strategy

> **FE-2.1 closeout（2026-09-03，使用者授權）：** BE-2 student-search contract 已由 backend commit `1c38d9c` 凍結並以 DB-backed e2e（enrollments+OpenAPI，2 suites / 7 tests）驗證；FE-2.1 五項 transport 依凍結契約完成並由 UI commit `025e794` / `045ef09` 交付（focused 3 files / 45 tests、full 19 files / 138 tests、typegen/typecheck/lint/build/prettier/diff check 全綠）。含 review hardening：login 清除 enrollments/studentSearch cache roots、role gate 關閉時隱藏快取 data、typed `ApiRequestError`、mutation onSuccess await invalidation。FE-2.2 UI 與 real-backend acceptance 已於 2026-09-06 後續 browser regression 關閉，詳見 FE-2.2 closeout。

### FE-2.2 UI

- [x] FE-2.2.1 Course detail roster section
- [x] FE-2.2.2 Search/select student
- [x] FE-2.2.3 Enroll action
- [x] FE-2.2.4 Remove confirmation
- [x] FE-2.2.5 Duplicate/reactivation feedback
- [x] FE-2.2.6 Archived course error state
- [x] FE-2.2.7 Permission/not-found state
- [x] FE-2.2.8 Keyboard與 accessibility 驗證
- [x] FE-2.2.9 Real-browser acceptance

**依賴：** BE-2 enrollment API。

> **FE-2.2 closeout（2026-09-06，使用者授權）：** FE-2.2.1–FE-2.2.9 已完成。UI commit `7cbcc46` 交付 roster UI；後續 UI commits `f7b1dfe`／`31858d5` 完成 real-backend browser fixture 穩定化。`test/browser/fe-2-2-roster.spec.ts` 已納入 2026-09-06 fresh isolated full regression，結果 `8 passed / 0 failed / 0 skipped`（整體 8 specs），因此原先 FE-2.2.9 的 BLOCKED 狀態已解除。功能包含 paginated roster、student search、enroll/remove、duplicate/reactivation、archived 409 `COURSE_NOT_EDITABLE`、404/403 stable-code 狀態、keyboard／dialog 行為與 real-backend acceptance；screen-reader sanity 仍留 QA-2.2。

---

## FE-3 Teacher Live Classroom

### FE-3.1 Routes／transport

- [x] FE-3.1.1 Session list/detail transport（detail 完成；list transport 因後端無 session-list endpoint 仍 BLOCKED，未以 mock 取代——本項標記指 detail 部分已交付，list endpoint 落地後需補）
- [x] FE-3.1.2 Start/cancel/close mutations
- [x] FE-3.1.3 Open/close question mutations
- [x] FE-3.1.4 Teacher result transport
- [x] FE-3.1.5 Joined/voted count transport

### FE-3.2 Realtime adapter（Lite）

- [x] FE-3.2.1 建立 Socket.IO client wrapper
- [x] FE-3.2.2 Web Session handshake
- [x] FE-3.2.3 Teacher room subscription
- [x] FE-3.2.4 Snapshot on connect/reconnect
- [x] FE-3.2.5 Stale-state refetch
- [x] FE-3.2.6 Error/disconnect state

### FE-3.3 Teacher UI

- [x] FE-3.3.1 Session control view
- [x] FE-3.3.2 Question queue/list
- [x] FE-3.3.3 Open/close controls
- [x] FE-3.3.4 Joined/voted indicators
- [x] FE-3.3.5 Teacher result dashboard
- [x] FE-3.3.6 Close/cancel confirmation
- [x] FE-3.3.7 Responsive與 keyboard walkthrough
- [x] FE-3.3.8 Real-backend browser acceptance

**依賴：** BE-3。

> **FE-3.3.8 closeout（2026-09-11，real-backend browser acceptance verified）：** 新增 `test/browser/fe-3-3-8-teacher-classroom.spec.ts`（UI commit `9cf7c5d`），以 FE51 real-backend fixture 於 Chromium 執行單一 serial scenario → **1 passed / 0 failed / 0 skipped**（2.4 min，`--workers=1`，`NODE_OPTIONS=--dns-result-order=ipv4first`）。涵蓋 teacher deep-link 課堂生命週期（start/open/close/cancel，以 `sessionQuestion.id` 而非 question 定義 ID 呼叫 lifecycle routes）、獨立 student context join＋作答、teacher joined/voted counts、quiz correctness、close/cancel confirmation dialogs、Origin/CSRF header 斷言、not-found 處理、mobile/desktop horizontal overflow 與 identity-validated account/course cleanup。期間修正：lifecycle 等待改用 session-question ID（避免 `waitForRequest` 吞掉 timeout）、finalizer 不再對 cancelled/waiting session 呼叫 close 以免 cleanup 遮蔽 primary failure、以 `test.step()` 分段並保留 failure traces、FE51 teacher credentials 必須成對提供。Static gates：Prettier/ESLint PASS、typecheck PASS、Playwright discovery PASS、`git diff --check` PASS。**邊界：** FE-3.1.1 session-list transport 仍 BLOCKED（後端無 session-list endpoint）；QA-2.3 teacher classroom、QA-2.6 privacy/reveal、FE-7、BE-4 與整體 release 維持未關閉。

> **FE-3 closeout（2026-09-03，使用者授權）：** FE-3.1 transport（commit `b8b5b6b`）、FE-3.2 realtime adapter（Lite）與 FE-3.3 teacher UI（commit `9e4121a`）依凍結的 BE-3 contract 交付並關閉。FE-3.1 以 `lib/api/live-sessions.ts` 提供 detail/counts query、lifecycle 與 open/close question mutations、per-question results discriminated union（poll/quiz+correctness/open_text），全數 `mutate:true`（CSRF/Origin）並 await invalidation。FE-3.2 新增 `socket.io-client@4.8.3`（exact，對齊後端 `socket.io@4.8.3`）與 `lib/live/{realtime-types,socket-client,use-live-session-events}.ts`：`createLiveSocket`（`auth.liveSessionId` + websocket + `withCredentials`）、`useLiveConnection`（status/errorCode/snapshot fetch）、事件映射以 `(liveSessionId, eventSeq)` 去重、永不 optimistic。FE-3.3 新增受保護 deep-link route `app/(teacher)/live/[liveSessionId]/`（page/loading/error/not-found）與 `features/live-teacher/`（LiveClassroomView、QuestionQueue、ResultPanel、CloseCancelDialog），並抽取共用 `components/ui/ConfirmDialog`（roster removal 改為重用，行為不變）。驗證：`npm test` 27 files / 199 tests PASS（新 realtime-adapter 10、confirm-dialog 6、question-queue 5、result-panel 5、live-classroom-view 5、live-classroom-route 1）、typegen/typecheck/lint/build/prettier/diff check 全綠。**FE-3.1.1 session-list 與 FE-3.3.8 real-backend browser acceptance 仍 BLOCKED**（前者無後端 list endpoint；後者需隔離 real backend 且需 F9 question authoring 才能建立 live session），未以 mock/placeholder 取代。

---

## FE-4 Student Classroom — Poll Single 薄片

### FE-4.1 Entry／join

- [x] FE-4.1.1 從我的課程進入 active session
- [x] FE-4.1.2 Cookie-based join transport
- [x] FE-4.1.3 Learner snapshot transport
- [x] FE-4.1.4 Waiting／active／closed state
- [x] FE-4.1.5 Not enrolled／disabled／forbidden 錯誤頁

### FE-4.2 Poll single

- [x] FE-4.2.1 Question renderer
- [x] FE-4.2.2 Single choice answer state
- [x] FE-4.2.3 Submission idempotency key
- [x] FE-4.2.4 Submitted／retry state
- [x] FE-4.2.5 Result/reveal state
- [x] FE-4.2.6 Formal option UUID comparison

### FE-4.3 Participant realtime

- [x] FE-4.3.1 Student Web Session handshake
- [x] FE-4.3.2 Participant-safe session events
- [x] FE-4.3.3 Snapshot recovery after reconnect
- [x] FE-4.3.4 不顯示 teacher-only counts
- [x] FE-4.3.5 Enrollment/account revoke 時離線與錯誤狀態

> **FE-4.3 closeout（2026-09-05，CP5 real-backend acceptance verified）：** 以隔離 CP5 fixture 執行 `test/browser/fe-4-3-participant-realtime.spec.ts`，結果為 `1 passed / 0 failed / 0 skipped`（8.9s，`--workers=1`）。證據涵蓋 student Web Session cookie-based handshake、Socket.IO `/live` participant namespace（瀏覽器 transport URL 為 `/socket.io/`）、waiting → active → closed 無 refresh transition、snapshot／response-loss same-key recovery、participant-safe projection、不回傳 teacher-only counts、terminal join race、not-enrolled、wrong-role、account disable 後 access loss、missing session redirect，以及 aggregate cleanup。UI 以同一 `FE42_API_BASE` 啟動並通過 typecheck、lint（0 errors；既有 warnings）、`git diff --check`。測試觀測修正已提交於 UI commit `5db32e6`；`/live` 是 Socket.IO namespace，不應以 raw WebSocket URL path 判斷。FE-4.4 anonymous fallback 已於同日以 FE44 fixture 關閉；FE-5 其餘題型仍未完成。

> **Frontend real-browser regression closeout（2026-09-06）：** 以 fresh isolated FE44 session、CP5 backend 與 same-host UI 執行 `npx playwright test --workers=1`，8 個 browser specs 全部通過（8 passed / 0 failed / 0 skipped，36.7s）：FE-1.3、FE-2.2、FE-4.1、FE-4.2、FE-4.3、FE-4.4、US-F0、US-F16。驗證包含 account-bound learner flow、teacher roster、participant realtime terminal transition、response-loss replay、anonymous fallback 與 permission/access-loss 負向路徑；fixture credentials 僅存於 disposable `/tmp` env，未觸碰 development DB。

### FE-4.4 Anonymous fallback

- [x] FE-4.4.1 Session code join UI：trim／uppercase、join failure 與 server-ID navigation
- [x] FE-4.4.2 Participant token lifecycle：session-scoped storage、reload reuse 與 credential clearing
- [x] FE-4.4.3 Anonymous snapshot/submit/result：participant-safe auth、idempotent submit 與結果可見性
- [x] FE-4.4.4 Browser regression：isolated real backend、Socket.IO transport 與 fail-closed negative path

**依賴：** BE-1、BE-3、BE-4.1。

> **FE-4.4 closeout（2026-09-06，real-backend acceptance verified）：** FE-4.4.1–FE-4.4.4 已完成。以隔離 `smartlearning-fe44` Compose fixture（migration exit `0`、backend API `localhost:3003`、UI `localhost:3001`）執行 `test/browser/fe-4-4-anonymous-fallback.spec.ts --workers=1`，結果為 `1 passed / 0 failed / 0 skipped`（1.8s）。證據涵蓋 session code trim／uppercase join、匿名 join request 不帶 CSRF／participant token／idempotency header、server-ID navigation、sessionStorage 僅保存 session-scoped participant credential、reload 不重複 join、Socket.IO transport URL 不洩漏 token，以及新 context 無 credential 時的 fail-closed 狀態。另修正 `AnonymousLiveSessionEntry` 不穩定 `useSyncExternalStore` snapshot 造成的 React route crash，改以 hydration-safe local state 讀取 credential。驗證：learner live unit 25 tests passed、typecheck passed、lint 0 errors（僅既有 warnings）、edited file Prettier check passed、`git diff --check` passed。FE-4.4 已關閉，並納入 2026-09-06 frontend full regression（8 passed / 0 failed / 0 skipped）；FE-5 其餘題型與 QA-2.4 broader browser matrix 仍未完成。

> **FE-4.2 CP5 closeout（2026-09-05，real-backend acceptance verified）：** FE-4.2.1–FE-4.2.6 已完成。隔離 HTTPS UI/API runtime 及 FE42 fixtures 下，`test/browser/fe-4-2-poll-single.spec.ts` 執行結果為 `1 passed / 0 failed / 0 skipped`（20.8s，`--workers=1`）。證據涵蓋 isolated teacher 與 two-student contexts、poll-single renderer/UUID option identity、submission response-loss fixture、same-key authoritative replay、participant flow、cleanup 與 credential-safe HTTPS transport。FE-4.3 participant realtime 已於 2026-09-05 以 CP5 real-backend acceptance 關閉；FE-4.4 anonymous fallback 已於同日以 FE44 fixture 關閉。

> **FE-4.1 closeout（2026-09-04，CP5 acceptance verified）：** FE-4.1.1–FE-4.1.5 已依 CP1–CP4 完成 learner entry/join、cookie-based transport、snapshot、waiting／active／closed 狀態與 not-enrolled／disabled／forbidden 負向狀態。CP5 fail-closed real-backend Playwright acceptance 已於隔離 fixture 實際通過：`1 passed / 0 failed / 0 skipped`（8.1s），涵蓋 My Courses discovery、join、CSRF／exact Origin、server-ID navigation、learner states、terminal race、not-enrolled、wrong-role、disabled、expired/missing session 與 aggregate cleanup；此前 close-state、strict locator 及 revoked-session cleanup 問題已修正並重跑通過。FE-4.2 作答控制與 FE-4.3 participant realtime 已完成；FE-4.4 anonymous fallback 已完成。

---

## FE-5 Student Classroom — 其餘題型

### FE-5.1 Poll multiple

- [x] FE-5.1.1 Multiple selection UI
- [x] FE-5.1.2 Set-based submitted comparison
- [x] FE-5.1.3 Permutation idempotency UI regression
- [x] FE-5.1.4 Result projection

> **FE-5.1 closeout（2026-09-07，CLOSED）：** FE-5.1 Poll multiple learner flow 已完成並通過 isolated real-backend Playwright acceptance。先前 2026-09-06 的 learner join timeout／Chromium TLS handshake failure 已由 durable-attempt、permutation-stable option-set fingerprint、same-key replay 與 HTTPS same-origin proxy/runtime 修正消除；不得再保留為 current blocker。UI commits `7907a35`、`4e1a129`、`4f64579` 及既有 FE-5.1 implementation commit `8ec85d3` 對應本 slice；backend commits `5ac94fc`／`0e0cb50`／`34ec33a` 提供 isolated runtime 與 failpoint 驗證邊界。驗證：`fe-5-1-poll-multiple.spec.ts` **1 passed / 0 failed / 0 skipped**；targeted Poll Multiple `2 files / 16 tests passed`；frontend full unit `40 files / 329 tests passed`；typecheck、lint:check（0 errors；既有 warnings）、production build、browser discovery 與 `git diff --check` 全部通過。功能涵蓋 multiple selection、set-based comparison、permutation idempotency、response-loss 後 reload／same-key replay、participant-safe result projection 與 malformed／duplicate／missing-extra／stale／cross-actor attempt fail-closed。FE-5.1 已關閉；FE-5.2、FE-5.3、FE-5.4 已關閉（FE-5.4.2/5.4.3 dedicated evidence 於 2026-09-10 補齊）；QA-2.4 broader browser matrix 與 QA-2.6 privacy/reveal matrix 仍未完成。

### FE-5.2 Quiz

- [x] FE-5.2.1 Quiz answer UI
- [x] FE-5.2.2 Reveal 前不顯示 correctness
- [x] FE-5.2.3 Reveal 後顯示 participant-safe correctness
- [x] FE-5.2.4 Result state

> **FE-5.2 status（2026-09-07，CLOSED）：** FE-5.2 Quiz learner 端已依 `50_實作與測試/FrontEnd5.2/FE-5.2 Quiz 實作計畫.md` 完成並通過 real-backend browser acceptance，FE-5.2.1–FE-5.2.4 全數勾選。此輪證據對應 UI commits `4e1a129`（quiz learner flow）、`7907a35`（FE-5.1 gate 前置修復）、`4f64579`（fixture env gitignore 防護）及 backend commit `4a2480c`（`docs/frontend-api-reference.md` quiz 段 exact-set 語意同步，含 authoring `correctOptionRefs` 由「恰一」修正為「至少一」）。實作內容：`useSubmitQuiz`（`lib/api/participant-live-sessions.ts`）、`quiz-submission-attempt.ts`（storage namespace `smartlearning:v3:quiz:{actor}:{session}:{question}`，permutation-stable fingerprint，malformed/stale/cross-actor fail-closed）、`QuizQuestion.tsx`（exact-set 多選、reveal 前 strict allowlist 不渲染任何 correctness、reveal 後 participant-safe correctness、不做個人答對/答錯判定）、`LearnerLiveSessionView.tsx` dispatch 修正（先依 `snapshotType` 分流，消除 quiz 落入 single-choice renderer 的錯誤路徑）。驗證結果：`node test/browser/run.mjs test/browser/fe-5-2-quiz.spec.ts --workers=1` → **1 passed / 0 failed / 0 skipped**（17.9s test，2.6m total）；FE-5.1 gate 前置重跑 **1 passed / 0 failed / 0 skipped**（30.0s test，2.8m total）；full unit `40 files / 329 tests PASS`；typecheck／lint:check（0 errors；13 pre-existing warnings）／production build／`git diff --check` 全綠。FE-4.2/4.3/4.4 browser regressions 未執行（BLOCKED：缺 FE42__/FE44__ env + `http://localhost:3001` origin，pre-existing fixture boundary，非 FE-5.2 回歸）。fixture 邊界：HTTP-proxy 不 proxy `/socket.io`，故 reveal 的 realtime DOM 更新由 unit/component 覆蓋，browser 於可靠 API boundary 斷言 closed results 的 correctness 欄位；run log 中 `socket hang up` 為預期 response-loss failpoint。cleanup 已關閉 session 後 archive course（waiting/active session 無法 archive）。詳細 checkpoint 記錄見 `smartLearning-ui/tasks/todo.md`（CP0–CP4）。

### FE-5.3 Open text

- [x] FE-5.3.1 Multiline text input
- [x] FE-5.3.2 Length/validation feedback
- [x] FE-5.3.3 Safe plain-text rendering
- [x] FE-5.3.4 Anonymous result list
- [x] FE-5.3.5 不顯示 identity linkage

> **FE-5.3 status（2026-09-07，CLOSED）：** FE-5.3 Open text 已依 `50_實作與測試/FrontEnd5.3/FE-5.3 Open text 實作計畫.md` 完成，並通過 isolated real-backend Playwright acceptance。實作涵蓋 multiline `<textarea>`、NFC／Unicode whitespace normalization 與長度／unsafe-text validation feedback、strict text-only result parser、anonymous aggregate result list，以及 identity linkage fail-closed 邊界。驗證命令 `npm run test:browser -- --workers=1 test/browser/fe-5-3-open-text.spec.ts` → **1 passed / 0 failed / 0 skipped**（約 2.5 分鐘）；測試亦驗證 response-loss 後同一 idempotency key replay 與 anonymous result privacy，預期的 transient `socket hang up` failpoint 已正確恢復。最終 UI commits `d7b007d`、`6e4b551`、`38d01a9`、`7789279` 完成 learner flow、acceptance 與 renderer regression coverage；CP5 evidence 已記錄於 `smartLearning-ui/tasks/todo.md`。本次同步僅更新 FE-5.3 evidence 與相鄰 FE-5 狀態，未連帶宣稱 FE-5.4、QA-2.4、QA-2.6 或整體 release 完成。

### FE-5.4 四題型共用驗收

- [x] FE-5.4.1 Loading/error/closed/stale states
- [x] FE-5.4.2 Keyboard navigation
- [x] FE-5.4.3 Screen-reader sanity check
- [x] FE-5.4.4 Mobile/responsive smoke
- [x] FE-5.4.5 Real-backend browser matrix

**依賴：** BE-4。

> **FE-5.4 closeout（2026-09-08，CP6）：** FE-5.4.1、FE-5.4.2、FE-5.4.4 與 FE-5.4.5 已完成；FE-5.4.3 screen-reader sanity check 仍保留。`test/browser/fe-5-4-four-question-matrix.spec.ts` 載入 `test/browser/FE51.env` 後，以 Chromium 實際通過 **1 passed / 0 failed / 0 skipped**，涵蓋 mobile 390×844 與 desktop 1280×800、四題型、loading／error／closed／stale submission、鍵盤送出、request Origin／CSRF／Idempotency-Key／body shape、participant-safe result 與 cleanup。驗證同時通過 targeted learner tests **42 passed**、`npm run typecheck` 與 `git diff --check`。修正已提交於 UI commit `8620bb2`：密碼變更後重新讀取 CSRF token；學員 submission 的 HTTP 409 `CONFLICT` 限域正規化為 `SUBMISSION_CONFLICT`，避免顯示帳號重複訊息。此 closeout 不連帶宣稱 screen-reader、QA-2.6 privacy/reveal matrix、FE-7、BE-4 或整體 release 完成。

> **FE-5.4 closeout（2026-09-10，FE-5.4.2/5.4.3 dedicated evidence）：** FE-5.4.2 與 FE-5.4.3 的 dedicated component-level evidence 已補齊並提交於 UI commit `a9760b3`。FE-5.4.2：`test/fe-5-4-four-question-acceptance.test.tsx` 新增 table-driven keyboard-only 流程（Tab/Shift+Tab 往返 + no-trap sanity、native radio Arrow/Space、checkbox Space 獨立切換、open-text 輸入 + Enter），並斷言 answer labels 的 `focus-within` ring 與 submit button 的 `focus-visible` ring。FE-5.4.3（screen-reader sanity，依計畫界定為 semantic sanity check，非完整 WCAG audit）：aria-describedby help text、fieldset legend 作為 control group name、submission error 以 `role="alert"` 呈現 curated message 且保留可重試輸入、closed state 以 disabled fieldset + 狀態文字呈現，並對 accessibility tree 做 correctness/identity leakage 負向檢查。Production 僅做計畫允許的 focus-visible 修正（PollSingleQuestion labels 補 `focus-within` ring；Poll multiple/Quiz/Open text submit buttons 補 `focus-visible` ring），無 schema/query-key/attempt-storage/lifecycle-gate 變更。驗證：acceptance suite **38 passed**、targeted FE-5.4 regression **7 files / 109 passed**、full unit **43 files / 388 passed**、typecheck PASS、edited-file eslint clean、prettier PASS、`git diff --check` PASS、production edits 後 real-backend Chromium matrix **1 passed / 0 skipped**。同 commit 記錄 tripwire：user-event 鍵名大小寫敏感，`keyboard("{Space}")` 不會觸發 toggle，須用 `keyboard(" ")`。此 closeout 不連帶宣稱 QA-2.4、QA-2.6、FE-7、BE-4 或整體 release 完成。

---

## FE-6 Archive／History UI

- [ ] FE-6.1 Archive/history transport
- [ ] FE-6.2 Teacher course/session history list
- [ ] FE-6.3 Archived result detail
- [ ] FE-6.4 Empty／expired／deleted states
- [ ] FE-6.5 Early deletion request UI
- [ ] FE-6.6 Admin step-up confirmation UI
- [ ] FE-6.7 Tombstone/deleted record state
- [ ] FE-6.8 Privacy-focused browser acceptance

**依賴：** BE-5 完成後才開始，不做 mock。

> **FE-6 status（2026-09-11 WBS sync）：FE-6.1～FE-6.8 全部未開始（dependency-gated）。**
>
> - **Dependency gate 未解除：** FE-6 依 BE-5 CP3 final sign-off（`BE-5 final verified and formally closed; authorize FE-6 Checkpoint 0.`）才可啟動。目前 BE-5 CP2 維持 APPROVAL WITHHELD（見 BE-5 CP2 remediation 進度更新），FE-6 CP0 尚未授權，全部 8 項不得開始。
> - **後端契約已凍結（供未來 FE-6 CP0 intake，不解除 gate）：** BE-5 CP1 remediation 已 commit 於 backend `1c841ca` 並可在單一 clean revision 重現——archive list/detail、deletion request、admin step-up confirmation 五個 governance paths 已凍結 OpenAPI（integer pagination、`active|deleted` discriminator、required enums、prohibited properties、no student history route）；`docs/frontend-api-reference.md` §5 為前端消費文件。Machine-readable evidence：governance units 2 suites / 15 tests、OpenAPI 1 suite / 5 tests、guarded `smartlearning_test` archive governance E2E 1 suite / 11 tests，全部 0 failed / 0 skipped。
> - **前端目前無 FE-6 實作：** UI repo 無 archive/history route、feature 或 transport（`app/` 僅 live/join/courses 等既有功能；`lib/api/` 無 archive endpoints）。依 Option B 不得以 mock/placeholder 提前實作。
> - **Checkpoint 結構（依 `50_實作與測試/FrontEnd6/FE-6 Archive History UI 實作計畫.md`）：** CP0 frozen contract intake → CP1 transport（FE-6.1）→ CP2 teacher history/read UI（FE-6.2–FE-6.5）→ CP3 admin governance/tombstone UI（FE-6.6–FE-6.7）→ CP4 real-backend privacy acceptance（FE-6.8／QA-2.7 evidence）；每個 CP 以使用者明確回覆解鎖，不得跳站。
> - **證據歸屬：** backend S3/retention/restore/outbox 與 sandbox rehearsal 證據屬 **BE-5 CP2**，不是 FE-6 implementation evidence；下方 historical handoff 僅為 provenance 記錄。FE-6.8 與 QA-2.7 需真實 backend browser acceptance，backend/sandbox evidence 不可替代。

> **BE-5 CP2 historical evidence handoff（2026-09-09，尚待 CP0/CP2 reconciliation）：** 初次 S3 sandbox preflight 因 fixture env 不存在而 fail-closed，未連線或 upload；後續另有 disposable MinIO + guarded `smartlearning_test` rehearsal，記錄 S3-compatible manifest upload、selected alert threshold firing，以及 manifest-driven restore/restart no-resurrection。演練同時回報 UUID validation、production category fixture 與 S3 encryption/idempotency 修正，並記錄 focused **10 suites / 41 tests**、S3 integration 1/1。這些屬 **BE-5 archive governance／retention evidence**，不是 BE-8.2 account-management CP2，也不是 FE-6 implementation。
>
> **證據邊界（2026-09-10 CP0 稽核）：** 上述 rehearsal 僅涵蓋 disposable sandbox，沒有 production endpoint、production DB migration/purge、deployed alert routing/on-call 或 production backup restore 證據；相關最新程式、spec 與 task record 位於 dirty/uncommitted working tree，尚未形成可由單一 commit 重現的 baseline。故此段只保留為 reported historical evidence；不得據此勾選 BE-5、FE-6.1～FE-6.8 或 QA-2.7，也不得授權新的 destructive operation。正式 disposition 以 BE-5 CP0 evidence matrix 與後續人工 checkpoint 為準。

---

## FE-7 Durable Realtime Client

- [ ] FE-7.1 定義 `LiveSessionChannel` adapter
- [ ] FE-7.2 保存 `lastEventSeq`
- [ ] FE-7.3 Event deduplication
- [ ] FE-7.4 Gap detection
- [ ] FE-7.5 `sync.required` recovery
- [ ] FE-7.6 Snapshot replacement
- [ ] FE-7.7 Aggregate version／watermark handling
- [ ] FE-7.8 Stale event discard
- [ ] FE-7.9 Reconnect burst test
- [ ] FE-7.10 API restart／Redis outage UI behavior

**依賴：** BE-7 contract freeze。

---

## FE-8 前端工程基準

- [ ] FE-8.1 Next.js route type generation納入 verification
- [ ] FE-8.2 集中 typed API transport
- [ ] FE-8.3 Session expiry UI 對接真實 `expiresAt`
- [ ] FE-8.4 區分 session expired 與 generic unauthorized
- [ ] FE-8.5 建立全角色 browser acceptance matrix
- [ ] FE-8.6 Accessibility regression
- [ ] FE-8.7 Error observability與 request ID 顯示策略
- [ ] FE-8.8 Production Nginx/API/Socket base URL 設定

---

# 4. 文件、QA 與平台 WBS

## DOC-1 權威文件同步

- [ ] DOC-1.1 P0 核心需求基線
- [ ] DOC-1.2 Web Auth 與安全設計
- [ ] DOC-1.3 API 與共用 Schema
- [ ] DOC-1.4 資料模型與 ER 設計
- [ ] DOC-1.5 即時同步與結果治理設計
- [ ] DOC-1.6 Backend NestJS 實作規劃
- [ ] DOC-1.7 Authorization matrix
- [ ] DOC-1.8 Frontend API reference
- [ ] DOC-1.9 明確標示 current、target、deferred

## QA-1 Phase B release evidence

- [ ] QA-1.1 保存命令與 commit
- [ ] QA-1.2 保存 DB target 與 migration status
- [ ] QA-1.3 保存 suite/test/skip count
- [ ] QA-1.4 保存最小失敗證據與修復紀錄
- [ ] QA-1.5 Phase B release sign-off

## QA-2 Browser acceptance

- [x] QA-2.1 Student account/login/my courses
- [x] QA-2.2 Teacher roster

> **QA-2.1／QA-2.2 closeout（2026-09-06）：** fresh isolated frontend real-browser regression 共 `8 passed / 0 failed / 0 skipped`，包含 `fe-1-3-my-courses.spec.ts` 與 `fe-2-2-roster.spec.ts`。已覆蓋 student account/login/my courses、teacher roster、權限負向路徑與 aggregate cleanup；不代表 QA-2.3 teacher classroom、QA-2.4 四題型課堂或 QA-2.6 privacy/reveal matrix 已完成。

- [ ] QA-2.3 Teacher classroom
- [x] QA-2.4 Student four-question classroom

> **QA-2.4 closeout（2026-09-10）：** 學員四題型課堂已由 isolated real-backend Chromium matrix `test/browser/fe-5-4-four-question-matrix.spec.ts` 覆蓋：FE51 env + fe53 runtime 下 **1 passed / 0 failed / 0 skipped**（2.4 min，`--workers=1`），涵蓋 mobile 390×844 與 desktop 1280×800、四題型 join→answer→submit→result、request Origin/CSRF/Idempotency-Key/body shape、participant-safe result 負向檢查、close-first stale-submit、重複送出與帳號 disable cleanup（UI commit `a9760b3`；同日含 focus-visible production 修正後 rerun）。本 closeout 僅依 FE-5.4 已驗證證據勾選 QA-2.4，**不連帶宣稱** QA-2.3 teacher classroom、QA-2.6 privacy/reveal matrix、FE-7、BE-4 或整體 release 完成。

- [x] QA-2.5 Anonymous fallback
- [ ] QA-2.6 Privacy/reveal negative cases
- [ ] QA-2.7 Archive/history/deletion

## OPS-1 Production topology

- [ ] OPS-1.1 Nginx TLS termination
- [ ] OPS-1.2 Next.js service
- [ ] OPS-1.3 NestJS + Socket.IO service
- [ ] OPS-1.4 PostgreSQL authority
- [ ] OPS-1.5 Redis auxiliary services
- [ ] OPS-1.6 Health/readiness
- [ ] OPS-1.7 Graceful shutdown
- [ ] OPS-1.8 Metrics/log/alert pipeline

## OPS-2 W1–W8

- [ ] OPS-2.1 300 learners + 1 teacher fixture
- [ ] OPS-2.2 Join burst
- [ ] OPS-2.3 Submit burst
- [ ] OPS-2.4 Result fan-out
- [ ] OPS-2.5 Reconnect burst
- [ ] OPS-2.6 30-minute sustained session
- [ ] OPS-2.7 Scheduler/retention load
- [ ] OPS-2.8 DB/Redis/API failure drills
- [ ] OPS-2.9 Zero-loss／zero-duplicate authority queries

---

# 5. 前後端依賴矩陣

| 前端工作                   | 必要後端前置       | 可否提前開始                                                                                                                                   |
| -------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-1 Student 我的課程      | BE-1、BE-2         | 可先設計，contract freeze 後實作                                                                                                               |
| FE-2 Teacher roster        | BE-2               | 不應以 mock 實作                                                                                                                               |
| FE-3 Teacher classroom     | BE-3               | 已交付（FE-3.1/3.2/3.3 含 FE-3.3.8 real-browser acceptance，2026-09-11）；僅 FE-3.1.1 session-list transport 因後端無 list endpoint 仍 BLOCKED |
| FE-4 Poll-single classroom | BE-1、BE-3、BE-4.1 | 後端 E2E 通過後                                                                                                                                |
| FE-5 其餘題型              | BE-4.2～BE-4.4     | 各題型 lifecycle 通過後逐題型實作                                                                                                              |
| FE-6 Archive/history       | BE-5               | 不可提前做 placeholder；backend 契約已凍結（`1c841ca`），FE-6 CP0 仍須待 BE-5 final sign-off                                                   |
| FE-7 Durable realtime      | BE-7               | 可先設計 adapter，不可假設 event schema                                                                                                        |

---

# 6. 建議 Iteration 排程

## Iteration 1：Phase B 封板

**後端**

- BE-1.1～BE-1.4
- BE-2 contract freeze

**文件／QA**

- DOC-1
- QA-1

**出口條件**

- Phase B backend sign-off
- DB-backed tests 0 skipped
- 權威文件同步完成

## Iteration 2：Student 基礎 UI

**前端**

- FE-1

**後端支援**

- BE-2 contract issue 修正

**出口條件**

- Admin 建 Student → Student login → 我的課程 → logout 真實流程通過

## Iteration 3：Roster 與課堂基礎

**後端**

- BE-3
- BE-4.1

**前端**

- FE-2
- FE-3 基礎
- FE-4 poll-single

**出口條件**

- Teacher roster + open/close + Student poll-single 端到端通過

## Iteration 4：四題型完整課堂

**後端**

- BE-4.2～BE-4.4

**前端**

- FE-3 完成
- FE-5

**出口條件**

- 四題型、匿名 fallback、reveal/privacy browser matrix 通過

## Iteration 5：Archive 與治理

**後端**

- BE-5

**前端**

- FE-6

**出口條件**

- Archive、90-day retention、early deletion、tombstone、restore no-resurrection 通過

## Iteration 6：可靠性與容量

**後端／平台**

- BE-6
- BE-7
- BE-8
- OPS-1
- OPS-2

**前端**

- FE-7
- FE-8

**出口條件**

- Durable realtime、scheduler、W1–W8、故障恢復與 production gates 通過

---

# 7. Release Stop Conditions

發生以下任一情況時停止擴充功能並回到診斷：

- DB-backed test 被 skipped。
- Enrollment/account 撤銷後仍可 join 或 submit。
- 出現 duplicate Participant 或 Submission。
- Quiz correctness 在 reveal gate 前外洩。
- Open-text 結果可連結到身份。
- Close commit 後仍接受 submission。
- Socket 失敗導致已 commit REST mutation 回報失敗。
- Retention/deletion 可能造成部分刪除或資料復活。
- Load test 出現 submission loss、duplicate acceptance 或 post-close acceptance。
