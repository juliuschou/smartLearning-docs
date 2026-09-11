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

---

## 2026-09-10 CP1 remediation superseding note

上述「目前已完成／尚待完成／尚未執行」是 2026-08-28 的歷史快照，不代表目前 repository 狀態。後續已建立 archive DTO/OpenAPI、guarded `smartlearning_test` migration/E2E 與 retention evidence；但歷史 PASS 不得自動套用到 current dirty tree，CP2 operational evidence 亦不可當成 CP1 contract freeze。

本次 CP1 review 發現並修復：

1. **Persisted archive privacy boundary：**舊 `parseArchivedResult()` 驗證少數欄位後直接回傳原始 question object，legacy/altered JSON 的未知 nested identity fields 可能穿透 active-detail HTTP。修正為 poll/quiz/open-text 全層級 strict allowlist reconstruction；未知欄位丟棄，known malformed field fail closed。
2. **Reason binding：**Teacher request 與 Admin confirmation 都保留 required `privacy|support`，但 Admin reason 必須與 request 完全一致。Initial mismatch 與 resolved conflicting replay 均在 destructive write 前回 HTTP 409 `CONFLICT`、`field:"reason"`；matching replay 回 canonical result，request/session mismatch 維持 404。
3. **OpenAPI contract：**補強 paths/methods、pagination/filter、required request body、active/deleted discriminator、nested archive DTO 與 prohibited-property assertions。Pagination 明示 OpenAPI `integer`；nullable `deletionRequest`/`deletion` 是 wire 上必定存在的 required properties。
4. **HTTP regression：**擴充 student denial、query validation、Admin global list、deletion-request existence hiding、CSRF/Origin、step-up session/expiry、reason mismatch/replay 與 race reconciliation assertions。

Schema／migration 不變。CP1 migration 雖為 additive/forward-compatible，但會 backfill valid archive rows 並 replace index，不能描述為 metadata-only。

驗證必須分層記錄：non-DB unit/OpenAPI、guarded DB E2E、static gates各自保存 machine-readable counters與exact working-tree provenance。只有全部 `0 failed / 0 skipped` 並完成文件同步後才能重新提交 CP1 人工確認；本 note 不授權 CP2、FE-6、production operation、external upload 或 restore。

---

## 2026-09-11 BE-5.1 archive-domain reconciliation note

This note supersedes current-state interpretations of the 2026-08-28 snapshot without rewriting that historical record.

- **Close boundary:** current manual and automatic close paths call archive finalization inside the same PostgreSQL transaction. LiveSession close state, ArchivedResult creation, Participant anonymization and transactional outbox writes commit or roll back together. Socket publication remains post-commit. The earlier phrase “committed close 後觸發 archive finalization” is historical and is not the current contract.
- **Migration state:** archive migrations are additive/forward-compatible; guarded `smartlearning_test` migration/deployment evidence exists, but no production migration deployment is claimed.
- **Projection/privacy:** `projectArchive()` reuses `aggregateResults()`. Persisted archive JSON is reconstructed through a nested strict allowlist. Poll/quiz archives are aggregate-only; open-text responses are anonymous `{ text }`. Poll/quiz raw Submission rows remain in governed source storage until BE-5.2/BE-5.3 purge.
- **Replay/immutability:** existing-archive replay returns the canonical row without rebuilding or replacing payload and re-applies Participant anonymization. Active payload is create-once at the application/domain boundary; normal APIs provide no update route. Privileged direct SQL is outside this guarantee.
- **Query contract:** archive list supports optional `courseId`, `liveSessionId`, `status`, `closedFrom` and `closedTo`; bounds are offset-bearing ISO instants and inclusive, with ownership/filtering before count/pagination and `closedAt DESC, id DESC` ordering. Teacher access is owner-scoped, admin access global, student access denied, and foreign detail existence-hidden.
- **Lifecycle/evidence boundary:** waiting and active archive attempts have independent negative E2E evidence; cancelled sessions do not archive. Checkpoint D projection/replay units passed 2 suites / 16 tests, but no new DB-backed replay run or failure-injection rollback proof was added. Atomicity is supported by the shared transaction call graph.
- **Provenance/scope:** implementation/test changes are based on backend HEAD `1c841ca` plus dirty working-tree changes; this does not claim a new clean immutable revision. This reconciliation concerns BE-5.1 only and does not close BE-5.2, BE-5.3, FE-6, production deployment, or operational readiness.
