# BE-5 Archive Governance — Completion Plan

日期：2026-08-28  
範圍：Backend Phase B — closed LiveSession archive、retention、early deletion、privacy governance

## 目前已完成

- 新增 `ArchivedResult` 與 `DeletionEvent` additive Prisma model/migration draft。
- `LiveSession.closeSession()` committed close 後觸發 archive finalization。
- archive 以 `liveSessionId` 唯一化，重試回傳既有 archive。
- archive list/detail 已加入 teacher course-owner scope 與 admin 全域 scope。
- archive list 使用既有 `Page<T>` pagination contract。
- teacher deletion request 已加入 owner authorization 與 outstanding request deduplication。
- admin early deletion 保留 CSRF、AdminGuard、StepUpGuard、explicit confirmation，並要求先存在 deletion request。
- purge 保持 bounded（1–100）、oldest-first、retention deadline 檢查與已刪除重試冪等。
- purge 會移除 archive payload、submissions、participants、session questions/options，保留 closed LiveSession shell 與最小 deletion event。
- 新增 `GovernanceService` unit tests：pagination scope、purge limit/order。

## 尚待完成

1. **Aggregate/privacy projection**
   - 重用 `src/modules/live-sessions/domain/question-results.ts` 的 `aggregateResults()`。
   - archive payload 改為 typed anonymous projection，包含 question/option ordering 與 aggregate counts。
   - 禁止 participant/account/displayName/token/sessionCode 及 answer-to-person linkage。

2. **Deletion contract hardening**
   - 補齊 request/confirmation response DTO、Swagger metadata、HTTP status contract。
   - 確認重複 request/confirmation 不會產生重複 destructive tombstone。
   - 明確化 purgeDue concurrency 下的 selected/deleted 計數。

3. **Regression tests**
   - 新增 `test/archive-governance.e2e-spec.ts`。
   - 覆蓋 close→single archive、aggregate parity、privacy redaction、owner/admin isolation、pagination、cancelled/non-closed exclusion、request/confirmation authorization、CSRF/step-up、atomic purge、90-day boundary、bounded/repeated/concurrent purge。
   - DB-backed test 僅可對受保護的 `smartlearning_test` 執行，且需先取得資料庫操作授權。

4. **Documentation and verification**
   - 更新 `smartLearning-backend/docs/frontend-api-reference.md`。
   - 更新 backend `tasks/todo.md` results/checklist。
   - 執行 Prisma validate/generate、client normalization、typecheck、lint、format、build、targeted unit/e2e 與 `git diff --check`。
   - migration deploy、truncate、retention/early-delete destructive execution 未授權前不得執行。

## 風險與回滾

此功能涉及 additive schema、匿名化結果、不可逆刪除與 close/submit race，屬 high-risk。回滾以 revert application code 為主，保留 additive tables；不得嘗試恢復已刪除 answer-bearing data。上線前需核對 archive/live-result parity、tombstone 數量、due/retry 指標及 archive payload 無 identity-bearing fields。

## 靜態驗證紀錄

已通過：

```text
npm test -- --runInBand src/modules/governance/application/governance.service.spec.ts
npm run typecheck
npm run lint:check
npm run format:check
npm run build
```

尚未執行：migration deployment、DB-backed e2e/integration、destructive purge。 
