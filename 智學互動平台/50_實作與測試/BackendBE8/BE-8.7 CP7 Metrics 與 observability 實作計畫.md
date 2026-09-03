# BE-8.7 CP7 — Metrics 與 observability 實作計畫

> 核准後先將本計畫原文保存至 `../docs/智學互動平台/50_實作與測試/BackendBE8/BE-8.7 CP7 Metrics 與 observability 實作計畫.md`，再開始任何 backend 實作。該文件是 CP7 的可稽核執行基線；後續若發現需求或架構證據使計畫失效，先更新此文件並重新取得確認。

## Context

CP7 要在既有 NestJS/Pino/readiness 基礎上交付可抓取、可告警且不洩漏敏感資料的 backend metrics。CP0 已凍結 `/metrics` 契約：root-level、`VERSION_NEUTRAL`、Prometheus text、無 API envelope、無 application/session guard；production 存取控制由 Nginx／network topology 隔離。最低範圍為 request、login rate-limit、realtime publish failure、scheduler/retention job 指標，以及 5xx、DB unreachable、持續 rate-limit hit、publish failure 的 dashboard/alert 清單。

目前沒有 metrics library 或 endpoint；CP6 已完成但仍在 working tree，且修改了 observability、package 與部分預定 instrumentation 檔案。CP7 必須採 additive、小範圍變更，保留 CP6 的 redaction/error-shape 修正並可分開檢閱。此工作不新增 schema/migration、不建立 retention scheduler、不部署 Prometheus/Grafana/Nginx，也不改變既有 Redis fail-closed／degraded readiness 語意。

## Acceptance criteria

- 匿名 `GET /metrics` 回傳 Prometheus text；不是 `/api/v1/metrics`，不受 session/CSRF 保護，也不被 envelope 包裝。
- 指標至少包含：HTTP request count/latency、login rate-limit hits、realtime retry/dead publish failures、auto-close/retention job run/duration/items、DB/Redis/login-limiter readiness observations。
- label 僅使用固定 enum 或安全 route template；任何帳號、IP、request/resource ID、token/hash、query、題目/答案、錯誤訊息均不得出現在完整輸出。
- scrape 僅序列化 process-memory registry，不查 PostgreSQL/Redis；metrics 記錄失敗不得改變 HTTP、rate-limit、publisher、scheduler、retention 或 readiness 行為。
- 提供可檢查的 alert rules 與 dashboard inventory；Redis outage 的 optional realtime degradation 與 Redis-required login limiter unready 不混為一談。
- 自動驗證完成後停在人工 Checkpoint 7，呈現實際 metric 輸出與 alert 規則，等待使用者明確回覆 `Checkpoint 7 verified`。

## Recommended implementation

### 1. 建立工作紀錄與凍結 metric contract

先在 `tasks/todo.md` 新增 CP7 區段，記錄既有 CP6 working-tree baseline、acceptance criteria、風險/rollback、依賴/環境、working notes、verification 與 Results 欄位；不覆寫 CP6 結果。

採用 direct `prom-client` production dependency，不引入 Nest wrapper，也不啟用 `collectDefaultMetrics()`。固定 application namespace 與 label allowlist：

- `smartlearning_http_requests_total{method,route,status_class}`
- `smartlearning_http_request_duration_seconds{method,route,status_class}`
  - `method`: 常見大寫 verb，其他折疊為 `OTHER`
  - `route`: Express/Nest matched template；無安全 template 時固定 `__unmatched__`
  - `status_class`: `1xx`～`5xx` 或 `unknown`
- `smartlearning_login_rate_limit_hits_total`（無 label）
- `smartlearning_realtime_publish_failures_total{outcome}`，`outcome=retry|dead`
- `smartlearning_job_runs_total{job,outcome}`
- `smartlearning_job_duration_seconds{job,outcome}`
- `smartlearning_job_items_total{job,result}`
  - `job=live_session_auto_close|retention_purge`
  - 固定 outcome/result 組合：success/failure、closed/failed/selected/deleted
- `smartlearning_readiness_dependency_status{dependency}`（Gauge，1 healthy/0 unhealthy）
- `smartlearning_readiness_checks_total{dependency,outcome}`
  - `dependency=database|realtime_redis|login_rate_limit`

HTTP histogram 使用適合 API 的固定 buckets（5ms～10s）；job histogram 使用固定 buckets（10ms～60s）。數值是 observation/increment，不可成為 label。

### 2. 建立單一 registry owner 與 typed metrics facade

新增 `src/modules/metrics/`：

- `metrics.constants.ts`：metric 名稱、固定 label union/enum、histogram buckets、DI token。
- `metrics.registry.ts`／module provider factory：每個 Nest application 建立自己的 `prom-client.Registry`，所有 collector 明確註冊到該 registry。
- `metrics.service.ts`：唯一寫入入口，提供 typed methods（HTTP、rate-limit、publisher、job、readiness）；不接受任意 metric 名稱或 raw label map。
- `metrics.controller.ts`：`GET /metrics` + `@Version(VERSION_NEUTRAL)`，設定 `registry.contentType` 並回傳 `registry.metrics()`。
- `metrics.module.ts`：`@Global()`，匯出 `MetricsService`，由 `AppModule` 匯入一次。

禁止使用 process-global `prom-client.register`、module-scope Counter/Histogram、`Registry.clear()` 或 default collectors，避免 Jest 多次建立 app 時 duplicate registration／cross-test contamination。

所有 recording method 皆 best-effort/non-throwing：拒絕非有限或負數 duration/count、固定化 enum、捕捉 metrics library 例外；不得把 metrics 變成 domain dependency。

### 3. 接上 root `/metrics` 與安全 HTTP instrumentation

- 在 `src/bootstrap/configure-app.ts` 的 global-prefix exclusions 加入 exact `metrics`，保留 health 行為。
- 在 `src/app.module.ts` 匯入 `MetricsModule`，由 module middleware 套用 HTTP observer。
- 新增 `metrics.middleware.ts`：
  1. 用 `process.hrtime.bigint()` 取得 monotonic duration。
  2. 監聽 response `finish`，以最終 status code 記錄；`close` 僅作未 finish 的 fallback，使用 boolean 防止重複計數。
  3. route label 只從完成 routing 後的 `req.baseUrl` + `req.route.path` 組成；只接受 string template，array/regex/missing/malformed 全部折疊為 `__unmatched__`。
  4. 絕不 fallback 至 `originalUrl`、`url`、`path`、params 或 query。

`/metrics` 本身可以被 request metric 計數；本次 scrape 通常要到下一次才看到自身完成記錄，文件中說明即可，不為此加入特殊行為。

### 4. 在既有語意邊界加入 instrumentation

- `src/modules/rate-limit/rate-limiter.service.ts`
  - `check()` 取得 store decision 後，僅 `limited === true` 時加 1。
  - Redis unavailable／其他 infrastructure failure 不算 hit；回傳與 fail-closed 行為完全不變。
- `src/modules/realtime/live-session-publisher.ts`
  - `markFailure()` 成功將 claim row 持久化為 retry/dead（`updated.count === 1`）後記錄 outcome。
  - lost lease/stale claim 不計；不加入 event/session/error labels；不改 recovery notification、backoff、lease 或 log 語意。
- `src/modules/live-sessions/application/live-session-auto-close.scheduler.ts`
  - 實際 `runOnce()`（排除 destroyed/overlap early return）記錄 run outcome、duration 與 returned closed count。
  - 保留現行 swallow/log failure 與 shutdown/running fence。
- `src/modules/live-sessions/application/live-session.service.ts`
  - 在既有 per-candidate catch 增加 `failed` item counter；保留 CP6 `errorType` log 與繼續處理語意。
- `src/modules/governance/application/governance.service.ts`
  - 只 instrument `purgeDue()`：selection 成功後加 selected；每次成功 `purgeOne()` 加 deleted；完整 return 記 success；任何錯誤記 failure 後原樣 rethrow。
  - 不 instrument interactive early-delete 為 retention job，也不新增 timer/worker。
- `src/modules/health/readiness.service.ts`
  - 在既有 check 結果確定後更新三個 dependency gauges/counters；原本 body、HTTP 200/503 與 policy 判斷仍是唯一 authority。
  - DB unhealthy → overall 503；optional realtime Redis unavailable 可為 degraded 200；Redis-required login limiter unavailable → 503。scrape 不主動執行 readiness check。

### 5. 交付 operational artifacts

新增 `ops/observability/`：

- `prometheus-alerts.yml`：有效 Prometheus rule groups，至少包含：
  - sustained 5xx ratio（5m rate、10m for；初始 threshold 1%）
  - DB unhealthy，以及獨立的 DB metric absent/signal-loss
  - sustained login rate-limit hits（初始 threshold，標示需由 OPS 依流量調整）
  - realtime retry failure 與 dead transition（dead 為高嚴重度）
  - repeated auto-close/retention job failures
  - `login_rate_limit` unhealthy（critical）與 `realtime_redis` degraded（warning）分開規則
- `dashboard-inventory.md`：panel 名稱、PromQL、unit、解讀與 handoff，至少涵蓋 throughput、5xx ratio、p50/p95/p99 latency、dependency readiness、rate-limit hits、publish failures、job runs/duration/items。
- `README.md`：`/metrics` 契約、無 app guard 的原因、production network/proxy isolation、backend port 不可繞過 Nginx 公開、Redis readiness semantics、scrape 無外部 I/O、CP7/OPS 邊界與人工驗證方式。

不新增 Grafana JSON；尚無固定 Grafana deployment/version，inventory 足以作 OPS-1.8 handoff。若環境有 `promtool` 則驗證 rules，否則以 static artifact test 驗證必要規則/欄位並明確記錄工具未安裝。

### 6. 測試與 disclosure/cardinality tripwires

新增/擴充以下測試：

- `src/modules/metrics/*.spec.ts`
  - registry 可重複建立而不衝突；metric 名稱/type/label 固定。
  - typed recorder 正確累加；非法數值忽略；刻意讓 collector throw 也不外洩。
  - middleware：2xx/4xx/filtered 5xx 最終狀態、duration、finish+close 不重複、aborted close、matched template、unmatched constant。
  - 以唯一 sentinel 注入 URL/query/request ID/UUID/帳號/token/題目/答案；序列化完整 registry 後全部不得出現。
- 擴充既有 targeted unit specs：
  - rate limiter：limited/non-limited/unavailable/metrics-failure。
  - publisher：retry/dead/lost-lease/metrics-failure。
  - scheduler + live-session service：success/failure/overlap/destroyed/closed/failed items。
  - governance：empty、success、selection failure、partial deletion failure、原錯誤不被 metrics 取代。
  - readiness：DB outage、optional realtime Redis degraded、required login limiter outage、Redis off、metrics-failure。
- 新增 `test/metrics.e2e-spec.ts`，使用 production `createTestApp()` 證明：
  - exact `/metrics`、anonymous、raw Prometheus content type、無 envelope、version neutral。
  - `/api/v1/metrics` 非 metrics endpoint。
  - parameterized route 只輸出 template；secret unmatched path/query 只輸出 `__unmatched__`。
  - representative status classes 與完整輸出 disclosure sentinel。
  - scrape 不觸發 readiness/Prisma/Redis I/O。
- 新增 lightweight alert artifact spec：檢查必要 alert/metric references、`for`、severity/summary，以及禁止高基數欄位名稱；不為 YAML test 再加 dependency。

如沿用 CP5/CP6 人工驗收慣例，新增 `test:cp7:manual` 與獨立 Jest config；default E2E regex 只排除 manual CP5/CP6/CP7 verifier，不排除一般 `metrics.e2e-spec.ts`。

## Verification

依最小範圍逐步擴大；verbose suites 交由測試 subagent 執行並回傳結構化摘要。

1. Prettier 處理新/修改 TypeScript 與 operational artifacts 可涵蓋的格式。
2. Metrics registry/service/middleware/controller targeted unit tests。
3. RateLimiter、LiveSessionPublisher、auto-close、Governance、Readiness targeted unit tests。
4. `metrics.e2e-spec.ts` 與 alert artifact spec；DB-backed suite 僅在既有 CP0 授權的 `NODE_ENV=test` + `smartlearning_test` setup 邊界執行，禁止其他 DB/migration 操作且不得 silent skip。
5. 重跑 CP6 manual verifier，證明 redaction/error-envelope/OpenAPI 防護未回歸。
6. `npm test -- --runInBand`。
7. `NODE_ENV=test npm run test:e2e -- --runInBand` 與 `NODE_ENV=test npm run test:integration -- --runInBand`；任何 blocked/skipped 明確記錄，不視為成功。
8. `npm run prisma:validate`、`npm run typecheck`、`npm run lint:check`、`npm run format:check`、`npm run build`、`git diff --check`。
9. read-only `NODE_ENV=test npm run prisma:migrate:status`；CP7 不得產生 migration。
10. 若可用：`promtool check rules ops/observability/prometheus-alerts.yml`。
11. 執行 CP7 manual verifier，保存 branch/HEAD/working tree、Node/npm、命令、test/skip count、精選 raw metric lines、readiness policy evidence、alert rule inventory 與 promtool/static validation 結果。
12. 依「既有 CP6 / CP7 dependency+module / instrumentation / tests / ops artifacts」分組審閱 final diff，更新 `tasks/todo.md` Results。

最後停在人工 Checkpoint 7，向使用者展示實際 metric 輸出與 alert 規則；未取得明確確認前不得宣稱 CP7 完成，也不得進入 CP8。

## Risk & rollback

- **風險等級：中高。** 主要風險為 route label 高基數/敏感洩漏、registry 重複註冊、metrics 例外干擾 domain、publish/job 誤計數、Redis readiness 被錯誤簡化，以及與未提交 CP6 diff 混合。
- **防護：** module-owned registry、typed label allowlist、matched-template-only route、serialized-output sentinel、non-throwing recorder、在權威狀態轉換後計數、mode-specific readiness tests、CP6 regression verifier。
- **Rollback：** 此 slice 無 schema/data state；移除 `MetricsModule` import、`metrics` prefix exclusion、typed instrumentation calls、`prom-client` 與 CP7 artifacts 即可。不得清 DB、改 Redis 資料、恢復憑證或改 domain transaction。production 若 endpoint exposure 不符合 topology，先阻止 deployment/收緊 network ingress，不臨時加 web-session guard 改寫凍結契約。

## Critical files

- `package.json`, `package-lock.json`
- `src/app.module.ts`
- `src/bootstrap/configure-app.ts`
- `src/modules/metrics/*`（new）
- `src/modules/rate-limit/rate-limiter.service.ts`
- `src/modules/realtime/live-session-publisher.ts`
- `src/modules/live-sessions/application/live-session-auto-close.scheduler.ts`
- `src/modules/live-sessions/application/live-session.service.ts`
- `src/modules/governance/application/governance.service.ts`
- `src/modules/health/readiness.service.ts`
- `ops/observability/*`（new）
- related colocated specs、`test/metrics.e2e-spec.ts`、CP7 manual verifier/config
- `tasks/todo.md`
