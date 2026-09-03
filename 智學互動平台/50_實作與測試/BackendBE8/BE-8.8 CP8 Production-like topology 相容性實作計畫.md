# BE-8.8 CP8 — Production-like topology 相容性執行計畫

## Context

目標 WBS `../docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md:485-490` 已將 BE-8.8 定義為 CP8（原 backend item 8.10）：驗證 Nest backend 位於 Nginx TLS reverse proxy 後的 cookie／CSRF／Origin／Socket.IO 行為、啟用 Redis Socket.IO adapter 並驗證 graceful shutdown，完成 topology 環境變數與 rollout/rollback 交接，最後由使用者在 production-like Compose topology 親自驗收。

目前基線不是完整 production stack：backend repo 的 `docker-compose.yml` 只有 PostgreSQL、one-shot migrate、backend；`docker-compose.cp5.yml` 已提供兩個 backend instance、Redis 與 Redis-required login rate-limit 的多實例驗證拓撲，但 realtime Redis 預設為 off。Nginx／Next.js 由 OPS-1 負責，W1–W8 由 OPS-2 負責；CP8 不應重複實作或宣稱這些平台／壓測交付。

M2 架構文件將 PostgreSQL 定義為唯一 domain authority，Redis 僅作 rate-limit counter 與 Socket.IO fan-out；`/health/live` 必須為 process-only，`/health/ready` 必須反映 mutation 所需依賴；成功 mutation 只能在 PostgreSQL commit 後產生事件。既有 realtime 已從 in-process lite 逐步加入 durable publisher／Redis 支援，故 CP8 必須以目前 source 實況重新核對，不可把歷史 CP5／CP7 結果直接當成 CP8 topology 證據。

本計畫只可在使用者核准後執行。執行時先保留目前 branch／HEAD／working-tree baseline；不得覆寫未提交的既有 CP6/CP7 變更，不得觸碰 `smartlearning_dev`，也不得未授權執行 migration、`db push` 或資料清除。

## Objective and success criteria

完成 CP8 後，應能以一個隔離、具明確命名的 production-like Compose project 證明：

1. 外部 HTTPS 經 Nginx 到 backend 的 REST 路徑可正常登入、維持 secure session cookie，並正確執行 CSRF + exact Origin mutation。
2. 可信任的 `X-Forwarded-*`／proxy trust 行為不信任任意 client-supplied identity header；direct backend bypass、內部 port、`/metrics` exposure 都符合明訂的 network policy。
3. Socket.IO `/live` 的 WebSocket upgrade、cookie／participant credential handshake、room membership、post-commit realtime event 與 reconnect snapshot／replay 在 proxy 後可用。
4. realtime Redis adapter 真正啟用並完成 outage／recovery 行為驗證；Redis 不會授權 request、替代 PostgreSQL 或製造 domain truth。
5. graceful shutdown 會停止新工作、進入非 ready、排空 bounded in-flight／publisher work、關閉 Socket.IO／Redis／Prisma 資源；已 commit 的 Submission 不遺失、不回報假成功，重啟後可由權威 snapshot／durable publisher 恢復。
6. 產出可交接的 topology/env/rollout/rollback/failure-drill evidence，並明確標記 backend、OPS-1、OPS-2 的責任邊界。
7. 自動證據完成後停在 `PENDING USER INSPECTION`；只有使用者實際回覆 `Checkpoint 8 verified` 才能將 CP8 標記完成。

## Checkpoints and work packages

### Checkpoint A — Baseline、契約與拓撲盤點

- 記錄 branch、HEAD、working tree、Node/npm/Prisma、Docker/Compose、PostgreSQL、Redis、Nginx 版本；確認未提交變更不被混入。
- 讀取並對照 `AGENTS.md`、`tasks/todo.md`、`tasks/lessons.md`、M2 架構／API／realtime 文件、`README.md`、`Dockerfile`、`docker-compose.yml`、`docker-compose.cp5.yml`、`.env.production.example`。
- 盤點 `src/bootstrap/configure-app.ts`、`src/main.ts`、health/readiness、secure-cookie／CORS／CSRF、Socket.IO gateway／adapter／handshake、publisher／scheduler／shutdown hooks、metrics／redaction。
- 確認 OPS-owned Nginx/Next topology 是否已可供驗證。推薦策略：若 OPS-1 topology 已存在，CP8 使用其固定版本；若不存在，只建立明確標示為 verification-only 的 backend Compose override／最小 Nginx fixture，不把其變成正式 OPS-1 交付。
- Stop：proxy ownership、certificate／hostname、external HTTPS origin、Redis realtime mode、metrics access policy、DB target 或 migration status 任一不明時，不進入 runtime smoke。

### Checkpoint B — 凍結 backend topology contract

在 `tasks/todo.md` 與 topology handoff 文件中凍結下列 contract，採 additive config/documentation 優先，不改 domain semantics：

- Nginx TLS termination、API upstream、Socket.IO `/socket.io/` upgrade headers、connection／read／write timeout、request body limit。
- trusted proxy boundary 與 `X-Forwarded-Proto/Host/For` 的設定；Nginx 覆寫並移除不可信 identity headers，backend 不以任意 forwarded identity 建立 actor context。
- 外部 origin（HTTPS）與 backend `CORS_ORIGIN`／Socket.IO CORS allowlist；wildcard Origin 在 credentialed HTTP 與 Socket boundary 均 fail-closed。
- `SESSION_COOKIE_SECURE=true`、`__Host-session`／`__Host-csrf` 的 proxy-terminated HTTPS 行為；不以關閉 Secure cookie 作 workaround。
- `REALTIME_REDIS_MODE`、`REDIS_URL`、login rate-limit Redis 設定及各自 outage/readiness semantics；禁止混淆 realtime Redis 與 login limiter。
- `/health/live`、`/health/ready` 與 `/metrics` 的 public/internal routing policy；readiness 只在必要 dependency 不可安全 mutation 時 fail。
- API direct port、PostgreSQL、Redis、metrics 的 network exposure；優先採 no-public-port 或 loopback-only，並在 rendered Compose config 驗證。
- graceful-shutdown timeout、client retryable close signal、publisher drain／lease release／timer cleanup、restart 後 recovery boundary。

### Checkpoint C — 最小實作與自動 tripwires

只修改實際缺口，預期關鍵檔案如下（以盤點結果為準，不預先承諾所有檔案都要改）：

- `src/bootstrap/configure-app.ts`、`src/main.ts`：proxy／shutdown／websocket bootstrap 的安全邊界與 production/test 共用行為。
- `src/config/env.validation.ts`、`.env.production.example`、`docker-compose.yml`、`docker-compose.cp5.yml`：新增或凍結 topology env；所有 env 需在 read time 明確轉型，secret 只用 placeholder。
- `src/modules/health/readiness.service.ts` 與 health specs：DB、required login Redis、optional/degraded realtime Redis 的狀態語意；liveness 不做 dependency I/O。
- `src/modules/realtime/realtime-redis.service.ts`、`src/modules/realtime/realtime.module.ts`、`src/modules/realtime/live-gateway.ts`、`src/modules/realtime/live-session-publisher.ts`：adapter lifecycle、room/handshake、post-commit publication、drain／cleanup、reconnect/recovery；不得讓 Redis 成為 authority。
- `src/common/security/*`、`src/modules/identity/*`、`src/common/auth/*`：secure cookie、CSRF、Origin、forwarded scheme 的現有 contract；除非測試證明缺口，不做旁路式放寬。
- `Dockerfile` 與 operational docs：以 compiled runtime artifact 啟動，確認 non-root／PID 1／healthcheck；不以 host TypeScript path 代替 image runtime。
- 新增或調整 verification-only `ops/topology/`（若 repo convention／OPS handoff 允許）：Nginx config、Compose override、README、sanitized env matrix；不要把 Next.js 或完整 OPS stack 偷渡到 backend scope。

自動測試／static tripwires：

- rendered Compose config：service、depends_on health、internal/public ports、Redis realtime mode、API bypass、network、migration one-shot 與 exact external origin。
- Nginx config：TLS、forwarded headers、WebSocket upgrade、timeouts、request limits、敏感 access log 禁止項、metrics route policy。
- secure-cookie／CSRF／Origin：HTTPS trusted proxy 可登入；合法 CSRF + exact Origin mutation 成功；missing／wrong CSRF、wrong／wildcard Origin 仍回穩定既有錯誤。
- Socket.IO：proxy origin／cookie handshake、upgrade、teacher／participant projection、room isolation、invalid credential fail-closed；保留 Socket.IO handshake 必須手動解析 raw Cookie header 的既有 invariant。
- shutdown：new work fence、readiness transition、一次性 close、publisher drain／lease release、Redis adapter／subscriber cleanup、timer/listener 無殘留；metrics/log failure 不得改變 domain outcome。
- disclosure：Nginx／application logs、headers、metrics、error envelope 不含 cookie、Authorization、CSRF/session/participant/CLI token、password、raw answer/open text；forwarded identity header 不能繞過 auth。
- 若使用 proxy integration/e2e，測試必須以 production-like compiled image／隔離 test DB 為基礎；不可因 DB 不可用而靜默 skip。

### Checkpoint D — Isolated production-like runtime smoke

使用 unique Compose project name 與明確的 isolated network/volumes，先 `docker compose config`／render review，再 build/up；不可影響現有 dev/test stack。測試順序：

1. 啟動 PostgreSQL、Redis、migration、backend instance(s)、verification Nginx；確認 healthcheck／startup order。
2. 經 HTTPS proxy 驗證 `/health/live`（process-only）與 `/health/ready`（DB／required dependency 語意）。
3. 以外部 HTTPS origin 登入，保存 sanitized status/header evidence，確認 Secure `__Host-session`／`__Host-csrf` 可被後續 proxied request 使用。
4. 以合法 CSRF + exact Origin 執行代表性 mutation；重試缺 token、錯 token、錯 Origin、wildcard Origin，確認 403/stable code/envelope。
5. 建立／加入一個 LiveSession；以 teacher 與 participant credential 走 Socket.IO `/live` WebSocket upgrade；確認 proxy 後 cookie／participant token、session/teacher room 與安全 projection。
6. 開題、提交一次答案、觀察代表性 post-commit event；以 PostgreSQL authority query 確認恰一筆有效 Submission／正確 aggregate，且 teacher-only data 未進 participant room。
7. 切斷或重啟 API／Nginx WebSocket／Redis adapter，驗證 graceful shutdown、retryable disconnect、reconnect snapshot／durable publisher recovery；不可把 lost event 當成 lost commit。
8. 驗證 direct backend port、PostgreSQL／Redis port、`/metrics` external access 與 sanitized proxy/application logs 符合 Checkpoint B policy。

CP8 只產出 topology compatibility evidence；W1–W8 latency／capacity PASS-FAIL、browser matrix、完整 TLS/Next production hosting 仍交 OPS-1／OPS-2。若 runtime 發現現有 lite realtime 尚未具備 durable replay，報告為明確 `DEFERRED/BLOCKED`，不可用 snapshot smoke 冒充 replay proof。

### Checkpoint E — Failure drill、handoff 與人工停止點

至少執行並記錄：

- Redis realtime adapter outage／recovery：依凍結 mode policy degraded 或 stable reject；login limiter 若為 `redis-required` 維持 fail-closed；PostgreSQL reads/writes 不被 Redis 取代。
- API graceful restart during in-flight／post-commit publish：已 commit data 保留；未完成 work 具明確 retry／lease／reconnect 行為；無 duplicate accepted Submission。
- Nginx／WebSocket interruption：client 可受控 disconnect/reconnect；participant identity、session authority、projection visibility 不漂移。
- 若 OPS-2 已授權，將 PostgreSQL outage／saturated pool 交給 OPS failure drill；若未授權，明確列為外部依賴而非 CP8 PASS。

Handoff 文件需包含：service inventory／拓撲圖、safe env table、TLS／hostname assumptions、ports/networks、health/readiness、metrics access、startup/migration、shutdown、rollout、rollback、failure drills、sanitized evidence collection，以及 BE／OPS-1／OPS-2 ownership matrix。

## Critical files and artifacts

### Backend implementation / tests to inspect or update

- `src/bootstrap/configure-app.ts`
- `src/main.ts`
- `src/config/env.validation.ts`
- `src/modules/health/health.controller.ts`
- `src/modules/health/readiness.service.ts`
- `src/modules/realtime/realtime.module.ts`
- `src/modules/realtime/realtime-redis.service.ts`
- `src/modules/realtime/live-gateway.ts`
- `src/modules/realtime/live-session-event-bus.ts`
- `src/modules/realtime/live-session-publisher.ts`
- `src/common/security/*`, `src/common/auth/*`, identity session/cookie services
- relevant colocated specs plus proxy/shutdown/realtime integration/e2e specs

### Deployment / handoff artifacts

- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.cp5.yml`
- `.env.production.example`
- `README.md`
- `ops/observability/*`
- verification-only `ops/topology/*` or OPS-1 supplied topology (decision at Checkpoint A)
- `tasks/todo.md`（執行紀錄與 CP8 results）
- `tasks/lessons.md`（只有本次發現新 failure mode 才追加）

### Authoritative design references

- `docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md:412-503`
- `docs/智學互動平台/30_系統設計/架構、容量與可觀測性設計.md:1-247`
- `docs/智學互動平台/30_系統設計/API 與共用 Schema 設計.md:1-305`
- `docs/智學互動平台/30_系統設計/即時同步與結果治理設計.md`
- `docs/智學互動平台/00_專案規劃/MVP 效能目標.md:47-146`
- `smartLearning-backend/tasks/lessons.md`（Compose、loopback、handshake cookie、adapter lifecycle、shutdown drain lessons）

## Verification plan

### Static / targeted first

- `docker compose -f <absolute-path>/docker-compose.yml ... config`（只讀 render；若有 override，確認 port list replacement semantics）
- `npm run prisma:validate`
- targeted proxy trust／cookie／CSRF／Origin／readiness／realtime Redis／shutdown unit tests
- targeted proxy／Socket.IO／health／metrics e2e；所有 DB-backed suite 前先確認 `NODE_ENV=test npm run prisma:migrate:status` 指向 `smartlearning_test`，並取得測試 setup 內部 migrate/truncate 的明確授權
- 若存在 Nginx config：`nginx -t`；若存在 Prometheus rules：`promtool check rules ...`
- `git diff --check`

### Runtime evidence

- `docker compose config` 的 sanitized output：services、ports、networks、depends_on、healthchecks、env names/modes。
- `docker compose build` 與 compiled container health／startup logs。
- `curl`／`openssl s_client` 的 HTTPS、health、cookie、Origin／CSRF 結果（不保存 raw credentials）。
- Socket.IO client 的 connect／upgrade／event／disconnect／reconnect timeline。
- PostgreSQL authority query：Participant count、valid Submission count、unique constraint、aggregate、LiveSession／SessionQuestion state；不把 logs/cache/client state 當 authority。
- graceful shutdown／restart timeline：readiness transition、drain、publisher/adapter cleanup、reconnect recovery。
- sanitized Nginx/application logs、metrics route/access evidence。

### Final repository gates

依 smallest relevant scope 擴大：

- `npm run typecheck`
- `npm run lint:check`
- `npm run format:check`
- `npm run build`
- `npm test -- --runInBand`
- `NODE_ENV=test npm run test:e2e -- --runInBand`（DB-backed 需授權且 0 skipped）
- `NODE_ENV=test npm run test:integration -- --runInBand`（同上）
- `NODE_ENV=test npm run prisma:migrate:status`（唯讀）
- `git diff --check`

任何 migration target 不符、DB 不可達、suite 靜默 skip、proxy cookie/CSRF/realtime 失效、Redis outage policy 不明、已 commit mutation 受 shutdown 影響、duplicate/lost Submission、或 sensitive disclosure 發生時，立即停止擴充，保留最小失敗證據並重新規劃。

## Risk and rollback

- **風險等級：中高。** 影響 proxy trust、secure cookie、CSRF/Origin、WebSocket handshake、Redis adapter、shutdown 與多 instance delivery；錯誤可能造成全面無法登入、錯誤授權、連線中斷或已 commit work 無法觀測。
- **防護：** verification-only topology；explicit external origin；loopback/no-public internal ports；rendered Compose review；compiled-image verification；mode-specific readiness tests；pre-registered realtime listeners；safe redaction；PostgreSQL authority queries；不以 timeout／平均 latency 取代 correctness proof。
- **Rollback：** 優先停止 rollout、撤回 proxy／Compose／env 變更，或以明確設定退回已驗證的 single-instance/in-process realtime path；保留 PostgreSQL authority 與已提交資料。若 adapter／publisher path 不安全，disable 該 path 並讓 readiness 明確 degraded/reject，不得關閉 authentication、CSRF、Origin、Secure cookie 或把 Redis 當 domain fallback。
- **禁止事項：** 不清除 `smartlearning_dev`、不刪除或恢復已提交 Submission／撤銷 credential、不修改已套用 migration 作 rollback、不以 insecure cookie 或 wildcard Origin 修復 proxy、不宣稱 OPS-2 W1–W8 通過。

## Suggested WBS / execution-record updates after approval

核准後才修改目標 WBS 與 backend `tasks/todo.md`：

- 將 BE-8.8 現有四項 checklist 擴充為「契約凍結 → proxy static/targeted → Redis adapter/shutdown → isolated runtime smoke → failure drill/handoff → manual CP8」的可驗收子項。
- 在 `tasks/todo.md` 新增日期化 BE-8.8 execution log，記錄 baseline、依賴、環境、每個 checkpoint 的 `PASS/BLOCKED/PENDING USER INSPECTION`、命令、版本、test/skip count、authority query 與 sanitized runtime evidence。
- 若新增 topology fixture/config，補 README／OPS handoff；不把 Nginx/Next/W1–W8 的 OPS-owned 工作勾入 backend DoD。
- 自動證據完成時只標 `PENDING USER INSPECTION`；使用者明確回覆 `Checkpoint 8 verified` 後，才更新 WBS／todo 為 `[x]` 並記錄人工實際操作結果。

## Definition of Done

- CP8 backend compatibility checklist 全部有可追溯 runtime 或 static evidence。
- HTTPS proxy 後 login／secure cookie／CSRF／exact Origin／Socket.IO handshake 與代表性 realtime event 通過。
- Redis adapter mode、outage/recovery、graceful shutdown 與 PostgreSQL authority correctness 通過；未具備的 durable replay 明確標記 deferred，不得誤報。
- topology env、rollout/rollback、failure-drill、BE/OPS ownership handoff 文件完成。
- targeted/full relevant checks 的 failure/skip 都有記錄，DB-backed suite 不可靜默 skipped；quality gates 全綠或明確 BLOCKED。
- 人工 CP8 流程完成且使用者明確回覆 `Checkpoint 8 verified`；在此之前不可宣稱 BE-8.8 或 BE-8 完成。
