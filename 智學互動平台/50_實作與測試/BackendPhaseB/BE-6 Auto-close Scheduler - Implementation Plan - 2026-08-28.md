# BE-6 Auto-close Scheduler — Implementation Plan

日期：2026-08-28  
範圍：Backend Phase B — LiveSession 八小時自動關閉、submit/close race、archive/realtime governance

## Context

目前 `LiveSession` 僅能由老師透過 close endpoint 結束；BE-6/R-4 需要補上 M2 定義的八小時 hard limit。既有程式已具備 `LiveSessionService.closeSession()`、PostgreSQL row lock、`Clock`/`FakeClock`、`autoClosed` 欄位，以及 commit 後 archive/realtime 流程，但尚無 scheduler、auto-close 設定或自動關閉測試。

## Acceptance criteria

- `startedAt + auto-close duration <= clock.now()` 的 active session 會自動關閉；waiting、closed、cancelled 不受影響。
- 自動關閉在同一 transaction 內關閉 open `SessionQuestion`，設定 `status=closed`、`closedAt`、`autoClosed=true`。
- 自動關閉沿用 manual close 的 post-commit archive 與 realtime publication；archive/realtime 失敗不回滾已提交的 close。
- Scheduler 可重複執行、可重啟、tick 不重疊；多 instance 由 row lock 避免重複 transition/archive。
- submit、manual close、auto-close 維持既有 `live_session → session_question` lock order，結果由 PostgreSQL commit order 決定。
- 使用 `FakeClock` 驗證邊界，不依賴等待八小時或 real-clock sleep。
- 既有 manual close/cancel、submission、realtime、governance 與 HTTP contract 不變。

## Recommended implementation

### 1. Configuration and clock

- 在 `src/config/env.validation.ts` 新增：
  - `LIVE_SESSION_AUTO_CLOSE_MS`：預設 `8 * 60 * 60 * 1000`。
  - `LIVE_SESSION_AUTO_CLOSE_TICK_MS`：正數且設合理下限，避免 busy loop。
- 對 environment string 做明確 `Number(...)`/finite/range validation，不依賴 `ConfigService.get<number>()` 自動轉型。
- 重用 `src/common/clock/clock.ts` 的 `Clock`、`SystemClock`、`FakeClock`。Scheduler 與 lifecycle service 必須共用同一 clock abstraction。
- 更新 `.env.example` 及適用的 environment 文件；不要把 auth 的 `SESSION_ABSOLUTE_MS` 誤當成 LiveSession auto-close 設定。

### 2. Scheduler provider and module wiring

- 新增 `src/modules/live-sessions/application/live-session-auto-close.scheduler.ts`（或同 bounded context 的 infrastructure path）。
- Scheduler 實作 Nest module lifecycle：啟動時可先執行一次 bounded scan，之後按 tick interval 執行；shutdown 時清除 timer。
- 不新增 `@nestjs/schedule`，除非現有架構需要；優先使用 lifecycle-managed native timer。
- 使用 in-process `running` guard 避免同一 instance tick overlap；timer 可 `unref`，避免測試/程序無法結束。
- 每次 tick 捕捉錯誤並記錄 sanitized metrics/log；單一候選失敗不可阻止其餘候選處理。
- 在 `src/modules/live-sessions/live-sessions.module.ts` 註冊 provider；不要透過 controller 暴露 scheduler。

### 3. Shared close operation

- 在 `src/modules/live-sessions/application/live-session.service.ts` 抽出共用 internal close operation：
  - manual path 維持 owner/admin authorization，傳入 `autoClosed=false`。
  - scheduler path 為 trusted internal maintenance，不偽造 teacher/admin caller，傳入 `autoClosed=true`。
- `autoCloseExpiredSessions(now)` 只掃描：`status=active`、`startedAt IS NOT NULL`、`startedAt <= now - duration`；使用 bounded batch。
- 每個候選在 transaction 中：
  1. `lockLiveSessionForUpdate(tx, id)`。
  2. 重新讀取 session 與 open questions。
  3. 重新確認 status/deadline，避免候選查詢後狀態已改變。
  4. 關閉 open questions。
  5. 更新 session 為 closed、`closedAt=now`、`autoClosed=true`。
  6. commit 後呼叫既有 `GovernanceService.archiveSession()`。
  7. commit 後發出每個 `question.closed` 及一個 `session.state_changed`。
- 不使用無 row lock 的 unconditional `updateMany` 作為 lifecycle transition。若新增 `(status, started_at)` index，採 additive migration 並記錄 query/rollback 考量。
- 已 closed/cancelled 的 session 不再 transition；`closedAt` 保持首次 close 的值；archive 依既有 idempotent 語意處理。

### 4. Regression and race coverage

新增 focused scheduler/config tests，至少覆蓋：

- deadline 前一毫秒不關閉、恰好 deadline 關閉、deadline 後關閉。
- startedAt null、waiting、closed、cancelled 被忽略。
- auto close 結果為 `closed`、`autoClosed=true`，open question 同步 closed。
- 重跑不會重複 mutation、archive 或 terminal events。
- timer start/shutdown、tick overlap、FakeClock determinism。
- archive/realtime follow-up 失敗不回滾已提交 close。
- 一個候選失敗不阻斷後續候選。

延伸既有 `test/poll-submission.integration-spec.ts` 的 PostgreSQL race pattern，新增 scheduler-vs-submit 與 scheduler-vs-manual-close：

- scheduler 先取得 lock 時，後續 submit/manual close 看到 closed boundary。
- manual/submit 先 commit 時，scheduler 重新讀取後 skip 或依既有狀態拒絕。
- 最終 accepted submission 為 0 或 1，且只存在一個 archive/terminal transition。
- 測試透過 transaction lock holder 控制 commit order，不使用 wall-clock sleep。

如 test harness 可 deterministic invoke scheduler operation，再補 focused e2e 驗證 automatic `session.state_changed`/`session.closed` 外部行為。

## Critical files

- `src/modules/live-sessions/application/live-session.service.ts`
- `src/modules/live-sessions/application/live-session-auto-close.scheduler.ts`（新增）
- `src/modules/live-sessions/live-sessions.module.ts`
- `src/config/env.validation.ts`
- `src/common/clock/clock.ts`
- `src/prisma/transaction.service.ts`
- `prisma/schema.prisma`（若新增 scheduler scan index）
- `test/poll-submission.integration-spec.ts`
- 新增 `test/live-session-auto-close.e2e-spec.ts` 或等價 focused integration suite

## Risk & rollback

**風險：high** — 涉及 lifecycle timing、submit/close concurrency、archive trigger 與 background execution。  

Rollback 以停用 scheduler 設定或 revert application code 為主；若新增 index，保留 additive schema 不做 destructive down migration。不得恢復已提交的 close、archive 或 submission data。上線監控至少包含 auto-close success/failure、oldest due session age、archive failure、duplicate/conflict 與 post-close submission rejection。

## Dependencies and safety

- Runtime：Node 24+、NestJS 11、Prisma 7、PostgreSQL。
- DB-backed integration/e2e setup 會隱式 migration/truncate `smartlearning_test`；執行前需取得明確資料庫操作授權。
- 不執行未授權的 migration deploy、db push、truncate 或 destructive governance 操作。
- 保持 lite in-process realtime 與 deferred durable outbox/replay/Redis boundary 的區分。

## Verification

依序執行：

```text
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint:check
npm run format:check
npm test -- --runInBand <targeted scheduler/config tests>
NODE_ENV=test npm run test:integration -- --runInBand <targeted race tests>
NODE_ENV=test npm run test:e2e -- --runInBand <targeted lifecycle tests>
npm run build
npm run prisma:migrate:status
git diff --check
```

待取得 DB 授權且 targeted checks 通過後，再擴大執行完整 unit/e2e/integration suites。完成證據必須包含 FakeClock boundary tests 與 PostgreSQL commit-order race evidence，不以等待八小時作為驗證。
