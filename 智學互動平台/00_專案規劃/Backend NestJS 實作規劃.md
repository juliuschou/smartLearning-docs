# Context

目前 backend 只有 NestJS 11、全域 `ValidationPipe`、Pino 與 Prisma/PostgreSQL 連線骨架；尚無 controller、domain module、Prisma model、migration、auth、WebSocket、scheduler 或可驗證的 API 測試。`功能需求規格 SPEC.md` 是 P0-01～P0-05 與補充功能的單一功能規格來源，但明確要求 Red cards 在實作前由 M2 設計文件定案；結果保留/刪除與 300 人效能則分別以 `結果資料治理.md`、`MVP 效能目標.md` 為權威。

目標是建立一份涵蓋完整 SPEC 的分階段 NestJS backend 藍圖：先關閉設計紅卡，再以可驗證的垂直切片完成帳號安全、Course/LiveSession、題目、匿名參與、提交競態、即時結果與資料治理，最後證明 300 位學員＋1 位老師的正確性與效能。

## 成功條件

- 每個 SPEC/P0 acceptance criterion 可追蹤到 API、資料表/約束、transaction、event/job 與測試。
- PostgreSQL 是 Account、Session、Course、LiveSession、Submission、結果與稽核的唯一權威；Redis 僅用於 rate limit 與多 instance Socket.IO adapter。
- 競態、idempotency、權限、90 天刪除均由 DB 約束與 transaction 守護，不依賴「先查再寫」。
- HTTP、Socket.IO 與 CLI/Agent 共用同一 application/domain validation 與 authorization path。
- 全部 targeted tests、DB integration、HTTP/Socket e2e、安全/排程/治理測試通過；W1～W8 壓測達成既定門檻且零遺失、零重複有效 Submission、零錯誤彙總。

# Recommended Architecture

採單一 Nest application、依 bounded context 分模組，不導入重型 DDD framework。每個 feature 以 `api/`（controller/gateway/DTO）、`application/`（use case/transaction orchestration）、`domain/`（純規則、state transition、validator）、`infrastructure/`（Prisma query/repository）分層；只有需要替換、鎖定或獨立測試的邊界才建立 interface。

代表性目錄：

```text
src/
  bootstrap/configure-app.ts
  config/{env.validation.ts,configuration.ts}
  common/{errors,http,security,observability,clock,crypto}/
  prisma/{prisma.module.ts,prisma.service.ts,transaction.service.ts}
  modules/
    identity/        # Account、bootstrap、password、admin lifecycle
    auth/            # Web Session、step-up、guards、CSRF、CLI credential
    courses/
    questions/       # shared deterministic validator + batch preview/confirm
    live-sessions/   # code、state machine、snapshot、question control
    participants/    # join、participant token、reconnect snapshot
    submissions/     # answer validation、idempotency、race authority
    realtime/        # Socket.IO rooms/events/replay
    results/         # aggregate、vote-to-reveal、archive query
    governance/      # early delete、retention/tombstone
    jobs/            # auto-close、retention、outbox delivery
```

保留並強化現有能力：

- 重用 `src/main.ts` 的 Pino 與 global validation，但抽成 `configureApplication(app)`，讓 production 與 e2e 使用相同設定。
- 保留 global `ConfigModule` 與 `PrismaModule`；`PrismaService` 改用已驗證的 `ConfigService`、啟用 graceful shutdown，並集中提供 transaction/raw SQL lock helpers 與 Prisma error mapping。
- 題目 validation 寫成無 Nest/HTTP 依賴的純 TypeScript domain service，DTO、Web batch、CLI command 與 final create 全部呼叫同一實作。
- application service 是唯一寫入入口；controller/gateway 不直接操作 Prisma。

# Phase 0 — M2 Design Gate（高風險，未完成不得開始 feature code）

在既有 `docs/智學互動平台/30_系統設計/` 文件中定案並交叉驗證：

1. **資料識別與 schema**：採 M2 計畫建議的 UUID 作 API/DB identity；修正 `PostgreSQL 資料庫綱要設計.md` 仍採 BIGINT 的衝突後，才建立 Prisma schema。狀態採可逆的 text/check 或 Prisma enum 必須一致定案。
2. **Auth**：一次性 bootstrap command/secret 傳遞；Argon2id 參數與 benchmark；PostgreSQL-backed opaque Web Session（cookie 只放高熵 token、DB 只存 hash）、`__Host-` Secure/HttpOnly/SameSite cookie、CSRF token + Origin 驗證、30m idle/8h absolute、10m step-up。
3. **Wire contract**：REST `/api/v1`、ID/UTC timestamp/pagination 格式、穩定 error envelope/code、OpenAPI；Socket event v1、room、sequence/version、reconnect snapshot/replay/backpressure。
4. **Question batch**：使用無 pending payload 儲存的短效 signed validation token（account/course/payload hash/expiry/key version），confirm 時重送 payload、重驗 hash/授權/validation；idempotency record 只在正式 command 建立，取消不留下待處理資料。
5. **Participant/Submission**：participant token 的 entropy/hash/TTL/revocation；idempotency key scope 與 answer fingerprint；`UNIQUE(participant, session_question)`；`READ COMMITTED` + 明確 lock order。以既有 `FOR UPDATE` 方案為基線，先做 contention benchmark；若無法達 submit p95，再於設計階段改採經驗證的 advisory shared/exclusive lock 或 optimistic version，不能在實作中臨時改語意。
6. **Scheduler/governance**：8h auto-close claim/retry/idempotency；90d retention、early deletion、backup expiry/restore filter；刪除 job dry-run、告警與防復活策略。
7. **產品決策**：open text MVP backend 固定回傳安全的 plain-text list projection；文字雲只屬 frontend/後續產品能力。移除 `can_create_course` 預設只阻止新建 Course，不撤銷既有 Course 管理權；是否撤銷 CLI credential 由 Auth matrix 明文定案。

交付物須包含：context map、角色/授權矩陣、狀態轉移表、ERD、API/OpenAPI、Socket event catalog、transaction/lock table、AC→API→DB→event→test traceability matrix。完成三方審查後才進 Phase 1。

# Implementation Phases

## Phase 1 — 可重現的工程與資料基礎（中風險）

**行為成果**：fresh checkout 可用單一文件化流程啟動、migrate、health check、執行測試。

- 統一 `src/app.module.ts` 與 `prisma.config.ts` 的 `.env.<NODE_ENV>`/`.env` fallback；新增 env schema，缺少 `DATABASE_URL`、secret、cookie/URL 設定時 fail fast。
- 在 `src/bootstrap/configure-app.ts` 設定 `/api/v1`、versioning、global validation/error envelope、request ID、Pino redaction、CORS/Origin、安全 header、shutdown hooks。
- 新增 `/health/live` 與 `/health/ready`（DB；Redis 啟用時一併檢查）。
- 建立 Prisma 初始 additive migrations、partial unique/check/raw SQL migration 規則、seed/test fixture；加入 `prisma:generate/validate/migrate:deploy/seed`、`typecheck`、非 mutating `lint:check`/`format:check` scripts。
- 建立共用 clock、token hash、domain error、pagination 與 transaction helper；不要先建立泛用 repository framework。
- e2e app factory 必須重用 production bootstrap，測試 DB 獨立且每個 suite 可重置。

**關鍵檔**：`package.json`、`.env.example`、`README.md`、`src/main.ts`、`src/app.module.ts`、`src/bootstrap/configure-app.ts`、`src/config/*`、`src/common/*`、`src/prisma/*`、`prisma/schema.prisma`、`prisma/migrations/**`、`test/setup/**`。

## Phase 2 — Identity、Web Auth 與管理員控制（高風險；SPEC-003、US-F16）

**行為成果**：可安全 bootstrap 首位 admin；admin 可管理帳號與 `can_create_course`；teacher/admin 可登入、登出、改密碼、step-up，停用/重設立即撤銷 credential。

- Models：`Account`、`PasswordCredential`/password metadata、`WebSession`、`CliCredential`、`LoginAttempt`、`AuditEvent`、bootstrap consumed state。
- APIs：bootstrap（CLI command 優先）、login/logout/current session/change password/step-up；admin create/reset/disable/restore account、toggle course permission、create/rotate/revoke CLI credential。
- Argon2id、一次性 temp password、首次登入強制改密碼、12–128 Unicode、common/breached 檢查；generic login failure、防 enumeration。
- account+source 雙 rate limit；session hash、idle/absolute expiry、session rotation、全 session revocation transaction；高風險 admin/CLI key operation 驗證最近 10m step-up。
- 測試 cookie attributes、CSRF/Origin、expiry fake clock、revocation、concurrent bootstrap only-one-wins、disabled account 與 audit redaction。

## Phase 3 — Course 與題庫垂直切片（中高風險；SPEC-001 F0/F1、SPEC-004、CLI 邊界）

**行為成果**：授權 teacher 可建立/封存自己的 Course，並以 Web 單題 CRUD 或 Web/CLI batch preview-confirm 管理 poll/open_text/quiz。

- Models：`Course`、`QuestionDefinition`、`QuestionOption`、`QuestionBatchCommand`（只記正式 idempotency/result，不保存取消中的 payload）。
- DB invariants：Course draft/archived terminal；owner immutable；position indexes；append/reorder 採 course-scoped advisory lock/optimistic version；archived 不可寫。
- 實作完整題型與 answer schema、Unicode normalize/trim/collapse/case-fold、穩定 validation codes、all-errors-at-once、warning、batch 1–50、client_ref uniqueness。
- APIs：Course create/list/detail/archive；question CRUD/reorder；batch validate/preview/confirm。confirm 必須驗 signed token、payload hash、expiry、owner/狀態，再於單一 transaction revalidate 並依 preview order append；同 idempotency key 回原結果。
- CLI/Agent 僅呼叫同一 API/application service，不建立第二套 validator，也不提供 `--yes/--force` bypass。

## Phase 4 — LiveSession、session code 與 immutable snapshot（高風險；SPEC-001 F2、SPEC-002）

**行為成果**：teacher 可建立 waiting 場次、選題啟動、逐題 open/close、結束/取消；題目內容在 activation 後固定。

- Models：`LiveSession`、`SessionQuestion`、`SessionQuestionOption`、可重試 job/outbox 基礎。
- Partial unique：每 Course 至多一個 waiting/active；每 LiveSession 至多一題 open；code 全域唯一、8 碼 non-confusable uppercase，輸入 canonical uppercase，終止後永不再映射。
- create/archive/start/open/close/cancel/manual close 都在 transaction 中重查 owner、Course/Session 狀態；activation 在單一 transaction 建立完整 snapshot/order。
- 所有 transition 使用集中 state machine，記錄 actor、version、timestamps、穩定 error、成功 event；8h auto-close 與 manual close 共用同一 application command，並一併 close 當時 open question。
- 測試第二場競態、code collision retry、active 後不可改 snapshot、terminal 不可逆、archive guard、scheduler fake clock/retry/duplicate execution。

## Phase 5 — Anonymous join 與權威 reconnect（中高風險；SPEC-005 F12/F13）

**行為成果**：learner 可用 code + display name 加入 waiting/active 場次，取得場次限定 opaque token，並恢復同一 Participant 的權威狀態。

- Models：`Participant`（display name 與 token hash 可在歸檔清除）、token lifecycle metadata。
- Join 驗證 trim 後 1–40 safe Unicode，拒絕 newline/control/bidi；允許重名，display name 不作 identity/authorization。
- Reconnect 回傳 LiveSession、目前題目、本人 submitted state、依 vote-to-reveal 可見的 aggregate 與 state/event version；closed/cancelled/expired 拒絕加入與重連。
- Token lookup 必須 constant-time-safe、場次限定且不在 log/error/event 中輸出。

## Phase 6 — Submission correctness 與競態權威（最高風險；SPEC-005 F14/F15）

**行為成果**：每人每題只有一筆不可變有效答案；安全重送；submit/close/autoclose 依 server transaction commit order 決定。

- Model/constraints：`Submission`、scoped idempotency key、answer fingerprint、`UNIQUE(participant_id, session_question_id)`；poll/quiz option refs 與 open_text 互斥，quiz exact-set scoring、無 partial score。
- Submit application command 於同一 transaction 驗 participant/session/question、題型答案、open/active 狀態、idempotency，並使用 Phase 0 定案的 lock protocol；不同 payload 重用 key 或第二答案回 conflict，絕不覆寫第一筆。
- close question、manual/auto-close 使用相同 lock order；transaction commit 後才寫 outbox/發布 event。權威 HTTP snapshot/query 永遠可修正 stale/missed Socket event。
- 必測：相同 key 重送、不同 key/不同答案、兩分頁 concurrent submit、submit-before-close、close-before-submit、timeout retry、auto-close race、DB constraint/error mapping；以真 PostgreSQL 多連線測試，不用 mock 證明競態。

## Phase 7 — Realtime aggregate 與 vote-to-reveal（高風險；US-F17、P0-07 realtime）

**行為成果**：teacher 看到匿名即時彙總與 joined/voted counts；learner 作答後可看 open 題彙總，題目 close 後全班可看最終結果。

- Nest Gateway + Socket.IO；以 authenticated Web Session 或 participant token join server-controlled rooms，不信任 client room/actor claims。
- 事件包含 schema version、session/question ID、state/aggregate version、server timestamp；reconnect 先取權威 snapshot，再 replay 有界事件，超出窗口重新 snapshot。
- poll/quiz 回 option counts，quiz 標正確答案；open_text 僅回安全 plain-text list，不回 participant/display name。
- 採 transactional outbox/after-commit dispatcher，避免 rollback 後廣播；Redis adapter 只協調多 instance，不保存權威 aggregate。
- WebSocket integration 驗證 unauthorized room、未作答資料遮蔽、close publish-all、duplicate/out-of-order/missed event、reconnect reconciliation。

## Phase 8 — Archive、查詢、90 天 retention 與提前刪除（最高資料風險；P0-06）

**行為成果**：closed 場次形成匿名可查結果；90 天後不可逆刪除；teacher 只能查自己的 Course，admin 可管理全平台；學員沒有歷史入口。

- Models：`ArchivedResult`/tombstone、`DeletionRequest`、`DeletionEvent`；歸檔 aggregate 與 immutable Submission/SessionQuestion 必須可交叉驗證。
- close transaction 或 idempotent follow-up job 建立 archive、`retention_expires_at = closed_at + 90d`，解除 display name/token 與答案的可查關聯；cancelled 且無 Submission 不建立 archive。
- APIs：teacher/admin archive list/detail/filter/page；teacher early-delete request；admin step-up preview/confirm/execute。刪除永遠以整個 LiveSession 為範圍，不提供 export/restore/participant lookup。
- Retention worker 使用 claim/lock、bounded batch、retry/backoff、dead-letter/alert；刪除內容後只留不含題幹/答案/token/aggregate的 tombstone + minimal event。
- 在啟用 destructive job 前先於 staging 執行 dry-run/count/sample；測試 Course archived/account disabled 不延長期限、job 重跑 idempotent、提前刪除權限、event 無敏感欄位、restore filter 不讓已刪內容復活。

## Phase 9 — Production readiness、容量與驗收（高風險；P0-07）

- Docker Compose/Nginx/Nest/PostgreSQL/Redis 的 near-production topology；固定 Node 版本、DB pool、timeouts、Socket limits、Redis memory/eviction、graceful drain。
- Metrics/alerts：HTTP p50/p95/p99/error、auth/rate-limit、DB pool wait/lock/transaction retry、Socket connection/reconnect/event lag、outbox backlog、scheduler lag/failure、retention pending/failure、deletion count。
- Artillery/等效 Socket.IO harness 覆蓋 W1～W8：300/120s join、300/10s 各題型 submit、broadcast、30 reconnect/10s、30m/10 題 sustain、race、retry、8h fake-clock auto-close。
- 驗收門檻：join p95≤1s、submit p95≤500ms、broadcast p95≤2s/p99≤5s、reconnect p95≤3s、功能錯誤率<1%，且有效資料遺失/重複/彙總不一致/closed 後接受答案皆為 0。
- 每次 release 保存 build/commit、拓撲、硬體、版本、初始資料量、p50/p95/p99/max、資源趨勢與最終 PASS/FAIL 報告。

# Dependencies（僅於對應 phase 加入）

- Auth：`argon2`、cookie parser；Web Session/CSRF 以本地 application code + PostgreSQL 實作，無需 JWT/Passport。
- API：`@nestjs/swagger`；tests 使用 `supertest`。
- Realtime：`@nestjs/websockets`、`@nestjs/platform-socket.io`、`socket.io`、測試用 `socket.io-client`。
- Jobs：`@nestjs/schedule` 或單一受 DB lock 保護的 scheduler；不引入 queue 直到 outbox/backlog 證明需要。
- Redis/metrics/load-test client 僅在 Phase 7/9 加入；不得讓 Redis 成為 domain state source。

# Verification

每個 phase 完成時至少執行：

```bash
npm ci
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint:check
npm run format:check
npm run build
npm test -- --runInBand
npm run test:integration -- --runInBand
npm run test:e2e -- --runInBand
```

Schema phase另執行 `npm run prisma:migrate:status`，以空白 test DB 執行 `prisma migrate deploy` 後再跑 suite。Phase 6 起加入 concurrency suite；Phase 7 加 Socket suite；Phase 8 加 governance/restore suite；Phase 9 加 W1～W8。任何 test failure 先停止擴充、保留最小 repro，再修正 root cause。

# Risk, Rollout, and Rollback

- **總風險：高**，因包含 auth、credential revocation、競態一致性、不可逆刪除與 realtime。
- Migration 一律 expand-first/additive；先部署 schema/index，再啟用讀寫路徑。production 不依賴 down migration，回滾以關閉 feature/job、回退 app、保留向後相容 schema，必要時以 forward-fix migration 修正。
- Auto-close/retention/outbox worker 皆需獨立 enable flag；先單 instance、staging dry-run，再啟用 production。Retention/early delete 啟用前必須有 backup expiry/restore filter 證據；執行後不可宣稱可 rollback 內容。
- Realtime 可降級為權威 HTTP snapshot/reconnect，不可為降低 latency 犧牲 Submission durability 或 aggregate correctness。
- 每個 vertical slice 保持 API backward-compatible；若 wire contract 必須改動，新增 v2/event version，不原地破壞已發布 v1。

# Deferred / Out of Scope

- learner account、SSO、MFA、email self-service reset、共同授課/所有權移轉、Course delete/restore。
- 結果 export、legal hold、自訂 retention、學員歷史查詢、刪除後復原、永久 aggregate。
- Markdown/HTML/附件/圖片/rich content、AI 內容品質判斷、quiz partial/weighted/semantic scoring。
- Open text 文字雲、完整 CLI key lifecycle/跨 OS 安裝矩陣、進階 telemetry/offline queue；除非後續規格另行升級。
