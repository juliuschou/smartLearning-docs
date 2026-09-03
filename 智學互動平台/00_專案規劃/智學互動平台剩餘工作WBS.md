# 智學互動平台剩餘工作 WBS

- 文件日期：2026-08-25
- 規劃範圍：Phase B 收尾、帳號式課堂 MVP、資料治理、即時可靠性及 production readiness
- 規劃原則：後端契約及 DB-backed 驗收先完成，再開發對應前端；不使用 mock 或 placeholder 取代正式串接
- 估算單位：人日，為區間估算；不含既有回歸問題的大規模修復

## 1. 里程碑摘要

| WBS | 里程碑             | 後端估算  | 前端估算 | QA／文件／平台 | 主要產出                                 | 參考文件                                                                                                                                                                       |
| --- | --------------- | -----:| ----:| --------:| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0 | Phase B 封板      | 5–8   | 0–1  | 3–5      | 學生帳號與加選後端正式簽核                        | [Phase B 後端執行計畫](../50_實作與測試/Phase%20B%20學生帳號與加選名冊%20後端執行計畫.md)、[Web Auth 與安全設計](../30_系統設計/Web%20Auth%20與安全設計.md)、[API 與共用 Schema](../30_系統設計/API%20與共用%20Schema%20設計.md) |
| 2.0 | Student 基礎 UI   | 0–1   | 3–5  | 1–2      | 登入、角色導向、我的課程                         | [Phase B 學員帳號實作計畫](../50_實作與測試/Phase%20B%20學員帳號%20實作計畫.md)、[API 與共用 Schema](../30_系統設計/API%20與共用%20Schema%20設計.md)                                                         |
| 3.0 | Teacher 名冊與課堂控制 | 2–4   | 6–9  | 2–3      | 名冊、開關題、課堂狀態與結果                       | [P0 核心需求基線](../10_需求蒐集/P0%20核心需求基線.md)、[即時同步與結果治理設計](../30_系統設計/即時同步與結果治理設計.md)                                                                                            |
| 4.0 | Student 完整課堂    | 2–4   | 8–14 | 3–5      | 四題型加入、作答、結果與匿名 fallback              | [題目領域契約](../10_需求蒐集/題目領域契約.md)、[API 與共用 Schema](../30_系統設計/API%20與共用%20Schema%20設計.md)、[即時同步與結果治理設計](../30_系統設計/即時同步與結果治理設計.md)                                            |
| 5.0 | Archive 與資料治理   | 8–13  | 2–4  | 4–6      | Archive、90 日 retention、刪除與 tombstone | [結果資料治理](../10_需求蒐集/結果資料治理.md)、[資料模型與 ER 設計](../30_系統設計/資料模型與%20ER%20設計.md)、[即時同步與結果治理設計](../30_系統設計/即時同步與結果治理設計.md)                                                       |
| 6.0 | 即時可靠性與容量        | 15–25 | 5–8  | 8–12     | Scheduler、outbox/replay、Redis、W1–W8  | [MVP 效能目標](MVP%20效能目標.md)、[架構、容量與可觀測性設計](../30_系統設計/架構、容量與可觀測性設計.md)、[即時同步與結果治理設計](../30_系統設計/即時同步與結果治理設計.md)                                                              |

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
- [ ] BE-3.2.5 Post-commit realtime event 不影響已提交 mutation

### BE-3.3 Submit／close race

- [ ] BE-3.3.1 Submit 先取得 lock 時可成功
- [ ] BE-3.3.2 Close 先取得 lock 時 submit 被拒絕
- [ ] BE-3.3.3 Commit 作為 session/question close 線性化點
- [ ] BE-3.3.4 Race test 查詢 DB authority 驗證結果

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

- [ ] BE-5.1.1 定義 close-to-archive command boundary
- [ ] BE-5.1.2 新增 additive ArchivedResult schema/migration
- [ ] BE-5.1.3 建立 immutable archive projection
- [ ] BE-5.1.4 建立 teacher/admin archive query
- [ ] BE-5.1.5 維持匿名化與 open-text privacy
- [ ] BE-5.1.6 Active/waiting session 禁止 archive

### BE-5.2 Retention

- [ ] BE-5.2.1 新增 `purgeAt`
- [ ] BE-5.2.2 建立 90-day retention selection
- [ ] BE-5.2.3 建立 bounded、idempotent worker
- [ ] BE-5.2.4 建立 dry-run mode
- [ ] BE-5.2.5 建立 retry/restart tests
- [ ] BE-5.2.6 建立 retention metrics/alerts

### BE-5.3 Early deletion／tombstone

- [ ] BE-5.3.1 建立 early deletion request
- [ ] BE-5.3.2 建立 admin step-up confirmation
- [ ] BE-5.3.3 建立 DeletionEvent／tombstone
- [ ] BE-5.3.4 確認 confirm idempotency
- [ ] BE-5.3.5 建立 restore filtering
- [ ] BE-5.3.6 驗證 backup restore 不 resurrect 已刪資料

**風險：** 不可逆資料操作；只能停止 worker 或 forward-fix，不能以 application rollback 恢復已刪資料。

---

## BE-6 Auto-close Scheduler

- [ ] BE-6.1 定義 8 小時 hard limit
- [ ] BE-6.2 Manual／auto close 共用 application service
- [ ] BE-6.3 建立 bounded scheduler claim
- [ ] BE-6.4 建立 idempotent retry
- [ ] BE-6.5 建立 clock-controlled deterministic tests
- [ ] BE-6.6 建立 process restart recovery test
- [ ] BE-6.7 建立 submit／auto-close race matrix
- [ ] BE-6.8 建立 job lag、failure、retry metrics

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

> **FE-2.1 closeout（2026-09-03，使用者授權）：** BE-2 student-search contract 已由 backend commit `1c38d9c` 凍結並以 DB-backed e2e（enrollments+OpenAPI，2 suites / 7 tests）驗證；FE-2.1 五項 transport 依凍結契約完成並由 UI commit `025e794` / `045ef09` 交付（focused 3 files / 45 tests、full 19 files / 138 tests、typegen/typecheck/lint/build/prettier/diff check 全綠）。含 review hardening：login 清除 enrollments/studentSearch cache roots、role gate 關閉時隱藏快取 data、typed `ApiRequestError`、mutation onSuccess await invalidation。FE-2.2 UI/browser 與 real-backend acceptance 仍未關閉。

### FE-2.2 UI

- [ ] FE-2.2.1 Course detail roster section
- [ ] FE-2.2.2 Search/select student
- [ ] FE-2.2.3 Enroll action
- [ ] FE-2.2.4 Remove confirmation
- [ ] FE-2.2.5 Duplicate/reactivation feedback
- [ ] FE-2.2.6 Archived course error state
- [ ] FE-2.2.7 Permission/not-found state
- [ ] FE-2.2.8 Keyboard與 accessibility 驗證
- [ ] FE-2.2.9 Real-browser acceptance

**依賴：** BE-2 enrollment API。

---

## FE-3 Teacher Live Classroom

### FE-3.1 Routes／transport

- [ ] FE-3.1.1 Session list/detail transport
- [ ] FE-3.1.2 Start/cancel/close mutations
- [ ] FE-3.1.3 Open/close question mutations
- [ ] FE-3.1.4 Teacher result transport
- [ ] FE-3.1.5 Joined/voted count transport

### FE-3.2 Realtime adapter（Lite）

- [ ] FE-3.2.1 建立 Socket.IO client wrapper
- [ ] FE-3.2.2 Web Session handshake
- [ ] FE-3.2.3 Teacher room subscription
- [ ] FE-3.2.4 Snapshot on connect/reconnect
- [ ] FE-3.2.5 Stale-state refetch
- [ ] FE-3.2.6 Error/disconnect state

### FE-3.3 Teacher UI

- [ ] FE-3.3.1 Session control view
- [ ] FE-3.3.2 Question queue/list
- [ ] FE-3.3.3 Open/close controls
- [ ] FE-3.3.4 Joined/voted indicators
- [ ] FE-3.3.5 Teacher result dashboard
- [ ] FE-3.3.6 Close/cancel confirmation
- [ ] FE-3.3.7 Responsive與 keyboard walkthrough
- [ ] FE-3.3.8 Real-backend browser acceptance

**依賴：** BE-3。

---

## FE-4 Student Classroom — Poll Single 薄片

### FE-4.1 Entry／join

- [ ] FE-4.1.1 從我的課程進入 active session
- [ ] FE-4.1.2 Cookie-based join transport
- [ ] FE-4.1.3 Learner snapshot transport
- [ ] FE-4.1.4 Waiting／active／closed state
- [ ] FE-4.1.5 Not enrolled／disabled／forbidden 錯誤頁

### FE-4.2 Poll single

- [ ] FE-4.2.1 Question renderer
- [ ] FE-4.2.2 Single choice answer state
- [ ] FE-4.2.3 Submission idempotency key
- [ ] FE-4.2.4 Submitted／retry state
- [ ] FE-4.2.5 Result/reveal state
- [ ] FE-4.2.6 Formal option UUID comparison

### FE-4.3 Participant realtime

- [ ] FE-4.3.1 Student Web Session handshake
- [ ] FE-4.3.2 Participant-safe session events
- [ ] FE-4.3.3 Snapshot recovery after reconnect
- [ ] FE-4.3.4 不顯示 teacher-only counts
- [ ] FE-4.3.5 Enrollment/account revoke 時離線與錯誤狀態

### FE-4.4 Anonymous fallback

- [ ] FE-4.4.1 Session code join UI
- [ ] FE-4.4.2 Participant token lifecycle
- [ ] FE-4.4.3 Anonymous snapshot/submit/result
- [ ] FE-4.4.4 Browser regression

**依賴：** BE-1、BE-3、BE-4.1。

---

## FE-5 Student Classroom — 其餘題型

### FE-5.1 Poll multiple

- [ ] FE-5.1.1 Multiple selection UI
- [ ] FE-5.1.2 Set-based submitted comparison
- [ ] FE-5.1.3 Permutation idempotency UI regression
- [ ] FE-5.1.4 Result projection

### FE-5.2 Quiz

- [ ] FE-5.2.1 Quiz answer UI
- [ ] FE-5.2.2 Reveal 前不顯示 correctness
- [ ] FE-5.2.3 Reveal 後顯示 participant-safe correctness
- [ ] FE-5.2.4 Result state

### FE-5.3 Open text

- [ ] FE-5.3.1 Multiline text input
- [ ] FE-5.3.2 Length/validation feedback
- [ ] FE-5.3.3 Safe plain-text rendering
- [ ] FE-5.3.4 Anonymous result list
- [ ] FE-5.3.5 不顯示 identity linkage

### FE-5.4 四題型共用驗收

- [ ] FE-5.4.1 Loading/error/closed/stale states
- [ ] FE-5.4.2 Keyboard navigation
- [ ] FE-5.4.3 Screen-reader sanity check
- [ ] FE-5.4.4 Mobile/responsive smoke
- [ ] FE-5.4.5 Real-backend browser matrix

**依賴：** BE-4。

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

- [ ] QA-2.1 Student account/login/my courses
- [ ] QA-2.2 Teacher roster
- [ ] QA-2.3 Teacher classroom
- [ ] QA-2.4 Student four-question classroom
- [ ] QA-2.5 Anonymous fallback
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

| 前端工作                       | 必要後端前置           | 可否提前開始                         |
| -------------------------- | ---------------- | ------------------------------ |
| FE-1 Student 我的課程          | BE-1、BE-2        | 可先設計，contract freeze 後實作       |
| FE-2 Teacher roster        | BE-2             | 不應以 mock 實作                    |
| FE-3 Teacher classroom     | BE-3             | 後端生命週期與 result contract 通過後    |
| FE-4 Poll-single classroom | BE-1、BE-3、BE-4.1 | 後端 E2E 通過後                     |
| FE-5 其餘題型                  | BE-4.2～BE-4.4    | 各題型 lifecycle 通過後逐題型實作         |
| FE-6 Archive/history       | BE-5             | 不可提前做 placeholder              |
| FE-7 Durable realtime      | BE-7             | 可先設計 adapter，不可假設 event schema |

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
