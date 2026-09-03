# BE-8.5 CP5 — Redis multi-instance login rate limit

> 本文件僅規劃 BE-8.5 CP5；尚未開始 backend 實作。Redis outage 政策已確認採 fail-closed 503。

## Context

現有登入限流是 `RateLimiterService` 的單程序 `Map` fixed-window counter；多個 backend instance 會各自擁有 budget，使有效上限變成 `limit × instanceCount`。CP5 要把**登入**的 per-account／per-source bucket 移至 Redis，保留 US-F7 已凍結的 429、anti-enumeration、TTL 與成功清除語意，並以兩個真正 backend instance 證明共享 bucket。

本計畫已凍結 Redis outage 政策為：**fail-closed**。Redis 不可用時，登入在查帳號／驗證密碼前回穩定 503；`/health/ready` 回 503、`/health/live` 維持 200；不切回每 instance 記憶體 bucket，Redis 恢復後自動恢復。

CP5 僅處理 login limiter；CP4 的 CLI/batch `OperationRateLimiterService` 維持 in-memory，不擴張範圍。PostgreSQL 仍是 Account、Session 與 domain state 的唯一權威。

## Acceptance criteria

- Redis 以 atomic fixed-window 實作 per-account／per-source bucket，兩個 backend instance 共享 count 與 TTL。
- 保持既有行為：
  - account key 正規化為 NFKC + trim + lowercase；
  - limiter pre-check 不消耗 attempt，且位於 account lookup／Argon2 前；
  - 每次已分類的認證失敗，account/source 各增加一次；
  - 前 `max` 次失敗仍回 generic 401，下一次 pre-check 才回 429；
  - 任一 scope 達限即阻擋，兩者皆達限時 `retryAfterSeconds` 取較長 TTL；
  - 成功只清 account bucket，source bucket 留待 TTL 到期；
  - missing／disabled／wrong-password 維持相同 generic 與 `RATE_LIMITED` 契約。
- Redis key 不含 raw username、IP 或可逆 identifier，且不進 response/log/metrics。
- Redis unavailable 時：登入回 503 `AUTH_RATE_LIMIT_UNAVAILABLE`；readiness 503、liveness 200；回應不含 Redis URL、host、driver message 或 stack。
- 真實 Redis integration 與雙 backend E2E 必須 fail-fast，Redis/DB 不可用時不得 early-return 假綠。
- 人工 Checkpoint 5 檢視 multi-instance 與 outage/recovery 證據後才標記完成。

## Implementation plan

### 1. 建立 CP5 工作紀錄與凍結契約

- 在 `tasks/todo.md` 新增 CP5 checklist、acceptance criteria、Working Notes、Dependencies & Environment、Risk & Rollback、Results 區塊；一次只標一個 in-progress 項目。
- 記錄已決策的 fail-closed 契約：503 `AUTH_RATE_LIMIT_UNAVAILABLE`、readiness 503、liveness 200、自動 recovery、禁止 local fallback。
- 記錄 DB-backed 測試需另行取得 `smartlearning_test` migrate/truncate 授權；未授權前只執行 DB-free/unit/Redis-only 驗證。

### 2. 擴充設定與 fail-fast validation

修改 `src/config/env.validation.ts` 及其 spec：

- 新增 `LOGIN_RATE_LIMIT_MODE=memory|redis-required`。
- 新增獨立設定：
  - `LOGIN_RATE_LIMIT_REDIS_URL`
  - `LOGIN_RATE_LIMIT_KEY_SECRET`
  - `LOGIN_RATE_LIMIT_CONNECT_TIMEOUT_MS`
  - `LOGIN_RATE_LIMIT_COMMAND_TIMEOUT_MS`
- 將既有四個 `LOGIN_RATE_LIMIT_*MAX/*WINDOW_MS` 明確以 `Number()`／`optionalNum()` 轉換，不再只依賴 implicit conversion。
- 建議預設：development/test=`memory`；production=`redis-required`。production 明確拒絕 memory mode。
- `redis-required` 必須有 Redis URL 與至少 32 字元獨立 HMAC secret；timeout、max、window 均驗證合理正值。
- 更新 `.env.example`、`.env.production.example`；不修改或提交真實 secret-bearing env。

### 3. 保留 façade，拆出 memory／Redis store

在 `src/modules/rate-limit/` 內以現有命名風格新增：

- `login-rate-limit-store.ts`：async store contract 與 availability/policy type。
- `memory-login-rate-limit.store.ts`：搬移現有 `Map` + `Clock` fixed-window 演算法，保留 deterministic unit tests。
- `login-rate-limit-key.factory.ts`：產生 Redis key。
- `redis-login-rate-limit.store.ts`：Redis command client、Lua scripts、availability 與 lifecycle。

調整 `rate-limiter.service.ts`：

- 保留 `normalizeRateLimitAccountKey()`、`RateLimitConfig`、`RateLimitDecision` 與對 `AuthService` 的 façade 角色。
- API 改為 async：`check()`、`recordFailure()`、`clearOnSuccess()`。
- 依 mode 選擇 memory 或 Redis store；Redis 錯誤統一轉為穩定 domain error。
- CP4 operation limiter providers 與行為不變。

### 4. 隱私安全的 Redis key

在 key factory 使用 HMAC-SHA-256 與 domain separation：

- account digest：`HMAC(secret, "account\0" + normalizedIdentifier)`
- source digest：`HMAC(secret, "source\0" + source)`

使用獨立、版本化 namespace，例如：

- `smartlearning:login-rate-limit:v1:{login}:account:<digest>`
- `smartlearning:login-rate-limit:v1:{login}:source:<digest>`

`{login}` 讓兩個 key 在 Redis Cluster 落於相同 slot，支援雙 key Lua 原子操作。raw identifier 與 digest 均不寫入 log/metrics。新增 unit tripwire 驗證 raw username、IPv4/IPv6 不出現在 key，且 namespace 不與 `smartlearning:socket.io` 混用。

### 5. 用 Lua 保證 fixed-window 原子性

在 Redis store 實作兩個 script 與單一 `DEL`：

1. **Pre-check script**
   - 一次讀取 account/source count 與 `PTTL`；
   - 判斷各自是否 `count >= max`；
   - 回傳 limited 與較長剩餘 TTL；
   - 缺 key／過期 key 視為空；偵測 count 存在但無 TTL 的 corrupt key，回傳安全錯誤而非永久鎖死或靜默放行。

2. **Record-failure script**
   - 對兩個 scope 在同一 script 內執行；
   - 首次以 `SET key 1 PX window` 原子建立 count + TTL；
   - 後續只 `INCR`，不延長原始 TTL；
   - 若遇無 TTL key，原子重建為 `1 + fresh TTL`，避免永久 lockout；
   - 不自動 retry mutation，避免 command timeout 後重複增加。

3. **Success clear**
   - 僅 `DEL accountKey`，不得更動 source key。

保留既有 pre-check-then-authenticate concurrency boundary；不改成 reservation/sliding-window 演算法。

### 6. Redis client lifecycle 與 fail-closed mapping

參考 `src/modules/realtime/realtime-redis.service.ts` 的 bounded timeout、reconnect、sanitized logging、shutdown pattern，但使用**獨立 command client**，不借用 Socket.IO pub/sub client。

- Startup：bounded initial connect；失敗時 process 仍存活、store 標記 unavailable、readiness 503、login 503，並進入 capped reconnect backoff。
- Runtime：client 未 ready 時立即 fail closed；command 套 bounded timeout；connection/timeout error 標記 unavailable，不重試同一 mutation。
- Recovery：`ready` 後重設 backoff並恢復 availability，不清除既有 bucket。
- Shutdown：`OnModuleDestroy` 設 stopped flag、取消 timer、禁止再 reconnect、idempotently 關閉 client。
- 只記錄低基數 reason category（如 `connect_timeout`、`connection_error`、`not_ready`），不得記錄 URL、host、username、IP、key 或 Redis raw message。

### 7. 穩定 outage error 契約

修改：

- `src/common/errors/error-codes.ts`
- `src/common/errors/domain-error.ts`
- 對應 exception/envelope specs

新增 append-only `AUTH_RATE_LIMIT_UNAVAILABLE`：

- HTTP 503
- message：`Authentication is temporarily unavailable. Please try again later.`
- `blocking: true`
- 不提供偽造的 bucket retry TTL；`retryAfterSeconds` 維持 null/省略，依既有 envelope 規則處理。

不得把 Redis outage 偽裝為 429 `RATE_LIMITED` 或 raw 500。

### 8. 更新 login orchestration，維持 transaction truth

修改 `src/modules/identity/application/auth.service.ts`：

- await pre-check 與每個 failure-recording branch。
- Redis pre-check／record failure 失敗時回穩定 503，不繼續帳號查詢或回未被計數的 401。
- 不對 DB/session infrastructure failure 增加 bucket。
- session transaction commit 後再清 account bucket；若 clear 失敗：
  - 已 commit 的登入仍回成功；
  - 僅記 sanitized warning；
  - account bucket 靠 TTL 到期。

此例外避免「session 已建立但 client 收到失敗」造成重試與重複 session；安全後果是暫時 over-limit，而非 bypass。

### 9. 整合獨立 readiness check

修改 `src/modules/health/readiness.service.ts` 與 specs：

- 新增 `checks.loginRateLimit`，與 realtime `checks.redis` 分離。
- memory mode：healthy、接受流量。
- redis-required available：healthy。
- redis-required unavailable：`error: login_rate_limit_unavailable`、overall readiness 503。
- `/health/live` 不變，維持 200。
- 健康回應只含 mode/readiness/low-cardinality error，不含 URL、host、DB number、reconnect count 或 exception message。

初始化掛入共用 bootstrap（優先以 rate-limit module lifecycle/provider 完成；若需顯式等待 initial bounded connect，再在 `configureApplication()` 附近加入窄初始化入口），production 與 test app factory 必須走相同路徑。

### 10. 調整 module wiring 與現有測試

修改 `src/modules/rate-limit/rate-limit.module.ts`：

- 註冊 façade、memory store、Redis store、key factory；
- 保持 global module 與 CP4 providers；
- 不 export Redis client。

更新現有：

- `src/modules/rate-limit/rate-limiter.service.spec.ts`
- `test/auth-rate-limit.e2e-spec.ts`
- `src/config/env.validation.spec.ts`
- readiness/error specs

將 synchronous assertions 改為 async，並保留 US-F7 的 real-clock expiry tripwire、anti-enumeration、disabled account、source aggregation、success-clear 行為。

### 11. 新增真實 Redis integration suite

新增 DB-free `test/login-rate-limit.redis.integration-spec.ts` 與安全 fixture/helper：

- 只在顯式 opt-in 且提供 test Redis URL 時執行；缺設定、Redis unreachable 或 unsafe prefix 必須 hard fail，不得 return/skip 假綠。
- 每次 run 使用唯一且具硬編碼 `smartlearning:test:login-rate-limit:` 前綴。
- cleanup 只可 `SCAN` + `UNLINK/DEL` 該唯一 prefix；禁止 `FLUSHDB`／`FLUSHALL`。
- 使用真實 Redis 驗證：
  - count + positive TTL 原子建立；
  - increment 不延長 fixed window；
  - concurrent increments 無 lost update；
  - account/source 各增加一次；
  - clear account 保留 source；
  - longest retry；
  - real TTL expiry 後恢復；
  - no-TTL corruption repair；
  - 兩個獨立 store/client 共享 bucket；
  - outage、reconnect、shutdown 不留 timer/open handle。

不新增 Testcontainers dependency；優先重用已有 Redis 7 Compose service，降低依賴與 CI 慣例變更。

### 12. 建立真正雙 backend CP5 topology 與 verifier

新增專用 `docker-compose.cp5.yml`（或最小 override，依實作時可讀性決定）：

- PostgreSQL test DB、one-shot migrate、Redis、`backend-a`、`backend-b`；
- 兩 backend 使用同 DB、同 Redis URL、同 HMAC secret、同低測試 threshold；
- 綁定不同 host ports；realtime Redis mode 保持 off，避免混淆 CP5；
- 不用同 process 的兩個 service instance 冒充 multi-instance。

新增 `test/manual-cp5-verify.e2e-spec.ts` 或等價 fail-fast verifier，執行：

1. A/B 交錯失敗，共享 account threshold，下一次任一 instance 回 429。
2. 不同 identifier 經 A/B 交錯，共享 source threshold。
3. 成功登入跨 instance 清 account，但 source 歷史保留。
4. normalization variants 共用 account bucket；存在／不存在帳號的 429 envelope 不洩漏存在性。
5. 停 Redis：兩 instance readiness 503、liveness 200、login 503 `AUTH_RATE_LIMIT_UNAVAILABLE`，response 無內部資訊。
6. 重啟 Redis：bounded timeout 內 readiness 恢復，未到期 bucket 仍有效。
7. 受控 `SCAN` 證明 key 為 opaque、namespace 隔離且每個 bucket `PTTL > 0`。

DB fixture/migrate/truncate 前解析 `DATABASE_URL` 並只允許明確授權的 test DB；未授權時 fail-fast，不執行任何 DB mutation。

## Verification

依最小範圍逐步擴大，verbose 測試交給 test subagent 執行並回傳 structured report。

### DB-free / safe checks

```bash
npm run format
npm test -- --runInBand src/config/env.validation.spec.ts
npm test -- --runInBand src/modules/rate-limit/rate-limiter.service.spec.ts
npm test -- --runInBand src/modules/health/readiness.service.spec.ts
npm test -- --runInBand src/common/http/global-exception-filter.spec.ts
npm run prisma:validate
npm run typecheck
npm run lint:check
npm run format:check
npm run build
git diff --check
```

### Real Redis integration

以專用 CP5 Compose Redis 或明確 test Redis URL 執行；不得 against production Redis：

```bash
docker compose -f docker-compose.cp5.yml up -d redis
RUN_LOGIN_RATE_LIMIT_REDIS_TESTS=1 \
LOGIN_RATE_LIMIT_TEST_REDIS_URL=redis://127.0.0.1:<mapped-port> \
npm run test:login-rate-limit:redis
```

### DB-backed auth regression（另取得明確授權後）

先唯讀確認 test DB target/migration status，再執行：

```bash
NODE_ENV=test npm run test:e2e -- --runInBand test/auth-rate-limit.e2e-spec.ts
NODE_ENV=test npm run test:e2e -- --runInBand test/manual-cp5-verify.e2e-spec.ts
```

若擴大回歸：

```bash
npm test -- --runInBand
NODE_ENV=test npm run test:e2e -- --runInBand
NODE_ENV=test npm run test:integration -- --runInBand
NODE_ENV=test npm run prisma:migrate:status
```

所有 DB-backed/Redis-required suite 必須記錄 tests passed/failed/skipped；CP5 evidence 要求 0 failure、0 skipped。

## Manual Checkpoint 5 evidence

完成自動驗證後停下，不自行進入 CP6。向使用者提供：

- branch、HEAD、working tree；Node/npm/Redis image 版本；
- Compose service list，清楚顯示 backend-a/backend-b；
- A/B 共享 account/source bucket 的 request/response 序列；
- outage 前／中／後 readiness、liveness、login response；
- recovery 時間與未到期 bucket 行為；
- sanitized Redis namespace／positive TTL 證據；
- 測試命令、pass/fail/skip count；
- 無 URL credential、cookie、password、raw identifier 或 HMAC secret 的證據包。

等待使用者明確回覆 `Checkpoint 5 verified` 後，才更新 `tasks/todo.md` Results 並標記 CP5 完成。

## Risk & rollback

- **Risk level：高**（auth abuse prevention、multi-instance consistency、dependency outage）。
- 主要風險：非原子 `INCR/EXPIRE` 產生無 TTL 永久鎖死；Redis timeout mutation 狀態不明；key/log 洩漏 identifier；proxy source identity 分裂；outage 誤回 401/429 或靜默 fail-open；DB/Redis 測試假綠。
- 防護：Lua atomic scripts、明確 Number coercion、opaque HMAC keys、bounded timeout 且 mutation 不 retry、fail-fast test harness、prefix-scoped cleanup、real-clock TTL、雙 instance/outage drill。
- Rollback：回退應用 image，保留 Redis 運行，讓 `v1` namespaced keys 自然 TTL 到期；禁止 `FLUSHDB/FLUSHALL`。若必須回 in-memory，production topology 必須同時回到**單 instance**，並視為需明確批准、限時的安全降級，不能在 multi-instance 下宣稱限流有效。

## Critical files

- `src/modules/rate-limit/rate-limiter.service.ts`
- `src/modules/rate-limit/rate-limit.module.ts`
- `src/modules/rate-limit/redis-login-rate-limit.store.ts`（新增）
- `src/modules/rate-limit/login-rate-limit-key.factory.ts`（新增）
- `src/modules/identity/application/auth.service.ts`
- `src/config/env.validation.ts`
- `src/modules/health/readiness.service.ts`
- `src/common/errors/error-codes.ts`
- `src/common/errors/domain-error.ts`
- `test/login-rate-limit.redis.integration-spec.ts`（新增）
- `test/manual-cp5-verify.e2e-spec.ts`（新增）
- `docker-compose.cp5.yml`（新增）
- `tasks/todo.md`
