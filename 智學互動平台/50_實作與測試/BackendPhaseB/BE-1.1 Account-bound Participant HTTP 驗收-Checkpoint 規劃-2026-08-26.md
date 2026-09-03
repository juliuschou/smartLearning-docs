# BE-1.1 Account-bound Participant HTTP 驗收 — Checkpoint 規劃

- 日期：2026-08-26
- 範圍：WBS `BE-1.1` 驗收（Account-bound Participant HTTP flow），Phase B 封板
- 來源 WBS：`docs/智學互動平台/00_專案規劃/智學互動平台剩餘工作WBS.md` §BE-1.1
- 規劃原則：後端契約及 DB-backed 驗收先完成；高風險 DB/認證/realtime 動作在 checkpoint 停下讓使用者手動確認

## Context

WBS `BE-1.1` 的驗收條件是：`test/participant-account.e2e-spec.ts` 全部通過、0 skipped。
這 8 個子項目驗證「具 active enrollment 的學生可用 Web Session cookie 走完 participant 全流程」。

**關鍵發現：實作已完成，測試檔已存在但覆蓋不全。**

- 實作面（runtime 程式碼）已完整：
  - `prisma/schema.prisma:273` `Participant.accountId String?` + `@@unique([liveSessionId, accountId])` 強制 idempotent join。
  - `src/modules/participants/application/participant.service.ts:111` `joinForAccount` 回傳 `participantToken: null`；`findOrCreateAccountParticipant:153` 採 lock order `liveSession → course → account`，lock 後重驗 enrollment + account status，用 `liveSessionId_accountId` unique 做 upsert。
  - `src/modules/participants/api/participant-token.guard.ts`：`OptionalStudentSessionGuard`（join；cookie 學生強制 STUDENT role + CSRF）、`ParticipantOrSessionGuard`（snapshot/results/submissions；token 或 cookie，學生 cookie 解析 account participant）。
  - `src/modules/submissions/api/*.controller.ts` submissions 用 `ParticipantOrSessionGuard`。
  - `src/common/auth/csrf.guard.ts` mutation 強制 `X-CSRF-Token` + exact Origin，失敗 → 403 `AUTH_CSRF_INVALID`（`domain-error.ts:137`）。
  - `src/modules/live-sessions/application/live-session.service.ts:609` `getResults`：teacher 恆為 `revealCorrectness=true`；participant 只有 `question.status === CLOSED` 才 reveal（vote-to-reveal），open 且未提交會 throw `RESULTS_NOT_REVEALED` 409。

- 測試面：`test/participant-account.e2e-spec.ts` 已有 5 個 `it`，但只覆蓋 8 個子項目中的部分，且有兩個明確缺口。

本任務為 **TEST-ONLY**（除非驗證過程發現實 bug）。目標是把缺口補到 8/8 全覆蓋，並用 checkpoint 讓使用者手動確認後才執行 DB-backed e2e。

## 現有測試 → BE-1.1 子項目對應

| 子項目 | 現有覆蓋 | 狀態 |
|---|---|---|
| BE-1.1.1 active enrollment 學生 cookie join | test 1（正向） | 缺**負向**：未加選學生 join 應 403 |
| BE-1.1.2 Participant 綁 accountId | test 1, test 2 | ✅ |
| BE-1.1.3 重複 join 不建第二筆 | test 5 | ✅ |
| BE-1.1.4 學生 cookie 取得 snapshot | test 1 | ✅ |
| BE-1.1.5 學生 cookie 提交答案 | test 2 | ✅ |
| BE-1.1.6 學生 cookie 讀 participant-safe results | test 2 只驗 `status===200` | **缺口**：未驗 participant-safe 投影 |
| BE-1.1.7 account-bound flow 不回傳 participant token | test 1 斷言 `participantToken===null` | ✅ |
| BE-1.1.8 CSRF token + exact Origin 為 mutation 必要條件 | 僅正向送 token+Origin | **缺口**：缺負向（錯/缺 CSRF、錯 Origin → 403） |

> test 3、test 4（enrollment removal / account disable 後禁止 submit）屬 **BE-1.2** 範疇，不在 BE-1.1 補強範圍，保留不動。

## 待補的測試（3 個新 `it`，全部沿用現有 helpers）

現有 helpers 可直接重用：`loginAs`、`provisionAndLogin`、`setupActiveSession`（建立 course → poll single question → live session → start → open question）、`cookieValue`、`TEST_ORIGIN`。fixture 為 poll single。

### New test A — BE-1.1.1 負向：未加選學生 cookie join 被拒
- 標題：`rejects a cookie-join when the student has no active enrollment`
- 流程：admin/teacher/student fixture → teacher 建立 active session（**不**加選 student）→ student cookie `POST /api/v1/live-sessions/:sessionCode/join` 送正確 CSRF+Origin。
- 斷言：`status === 403`（`ForbiddenError('Active course enrollment required')`，`participant.service.ts:234`/`enrollment.service.ts:264`）。
- 額外：確認 DB 無 participant row（`prisma.participant.count({ where:{ liveSessionId, accountId } }) === 0`）。
- 風險旗標：若實際回 409 或其他狀態，代表 `joinForAccount` 在 lock 前的 `assertActiveEnrollment` throw 點與預期不符 → 視為待確認的實作行為，停下回報。

### New test B — BE-1.1.6：學生 cookie results 為 participant-safe（poll + reveal-gate 負向）
- 標題：`returns participant-safe results through the student cookie (vote-to-reveal)`
- 流程：完整 fixture + 加選 + 開題 + student cookie join + submit（`selectedOptionRefs:['a']`）→ 學生 cookie `GET .../results`（題目仍 OPEN，已提交）。
- 斷言（poll single 的 participant-safe 投影，依 `results.dto.ts` + `getResults:694-695`）：
  - `status === 200`，`data.snapshotType === 'poll'`。
  - `data.options` 每項有 `count`，**poll 不含 `isCorrect`**（poll 的 `OptionCountDto.isCorrect` 僅 quiz 用 → 斷言 `options[0].isCorrect === undefined`）。
  - participant 在 OPEN 已提交可看 aggregate（poll 無 correctness 概念，故 participant-safe 的重點是「沒有 teacher-only 欄位」）。
  - 對照 teacher 同一題 results，確認 teacher 投影也回 200 且形狀相同（poll 無 correctness 差異），用以證明流程正確；quiz 的 reveal gate 已由 BE-4.3 覆蓋，此處不引入 quiz fixture 以維持 BE-1.1 範圍。
- reveal-gate 負向：再斷言「未提交的學生 cookie 在 OPEN 時讀 results → 409 `RESULTS_NOT_REVEALED`」（`live-session.service.ts:711`），證明 participant-safe gate 對未投票者生效。
- 風險旗標：若已提交學生在 OPEN 時拿到 `isCorrect` 或 teacher-only counts 欄位，代表 participant-safe 投影外洩 → 實 bug，停止回報。

### New test C — BE-1.1.8：CSRF/Origin 為 mutation 必要條件
- 標題：`rejects a cookie submission without a valid CSRF token or exact Origin`
- 流程：完整 fixture + 加選 + 開題 + student cookie join。
- 三個子斷言（皆打 `POST /api/v1/live-sessions/:liveSessionId/submissions`）：
  1. 缺 `X-CSRF-Token` header（保留正確 Origin）→ `403` + `error.code === 'AUTH_CSRF_INVALID'`。
  2. 錯誤 `X-CSRF-Token`（保留正確 Origin）→ `403` `AUTH_CSRF_INVALID`。
  3. 正確 token 但 `Origin: http://evil.test`（不在 allowlist；`.env.test` 僅 `http://localhost:3000`）→ `403` `AUTH_CSRF_INVALID`。
- 說明：CsrfGuard 對 GET no-op（`csrf.guard.ts:21`），故負向必須打 mutation（submission）。join 也可順帶驗一筆缺 CSRF → 403，但 submission 已足以關閉 1.1.8；為最小變更僅做 submission。
- 風險旗標：若任一負向回 201，代表 CSRF/Origin 防護失效 → 實 bug，停止回報。

## 不需修改的現有測試
- test 1–5 保留原樣（test 2 的 results 斷言維持 200；1.1.6 的深度斷言由 New test B 承接，避免重複改既有測試增加 diff 風險）。

## 關鍵檔案
- `test/participant-account.e2e-spec.ts` — 唯一要編輯的檔案（新增 3 個 `it`）。
- 參考（唯讀）：
  - `src/modules/participants/api/participant-token.guard.ts`（guard 行為）
  - `src/modules/participants/application/participant.service.ts:111,153,234`（join/lock/enrollment recheck）
  - `src/modules/live-sessions/application/live-session.service.ts:609,694,711`（participant-safe results + reveal gate）
  - `src/modules/live-sessions/api/dto/results.dto.ts`（results DTO 形狀）
  - `src/common/auth/csrf.guard.ts` + `src/common/security/origin.ts`（CSRF/Origin）
  - `src/common/errors/domain-error.ts:137`（`AUTH_CSRF_INVALID` 403）

## Checkpoint 流程（讓使用者手動確認）

### Checkpoint 1 — 確認測試補強範圍（執行前）
- 停下，向使用者展示：8 個子項目對應表、3 個新測試的標題與斷言重點、預期 DB 目標（`smartlearning_test`）。
- 不寫檔、不跑測試。等使用者確認範圍無誤。

### Checkpoint 2 — 寫檔後、跑 DB-backed e2e 前
- 編輯 `test/participant-account.e2e-spec.ts` 新增 3 個 `it`。
- 執行 `npm run typecheck` + `npm run lint:check`（僅針對該檔，快速 gate）。
- 停下，展示 typecheck/lint 結果與新測試 diff 摘要，等使用者確認才跑 DB-backed e2e。

### Checkpoint 3 — 目標 e2e 驗收
- 確認 `smartlearning_test` 已套用 migration（`NODE_ENV=test npm run prisma:migrate:status`）。
- 跑目標 e2e：`NODE_ENV=test npm run test:e2e -- test/participant-account.e2e-spec.ts --runInBand`
- 透過 test subagent 回收結構化報告（命令、scope、PASS/FAIL、每個 it 結果、失敗證據、信心水準）。
- **驗收門檻**：8 個 BE-1.1 子項目全覆蓋、0 skipped、0 failed。任一失敗 → stop-the-line，區分「測試斷言錯」vs「實作 bug」並回報。

### Checkpoint 4 — 廣回歸（通過後可選）
- `npm run typecheck`、`npm run lint:check`、`npm run format:check`、`npm run build`、`npm test`（unit）、完整 `test:e2e`、`test:integration`、`prisma:migrate:status`、`git diff --check`。
- 若 BE-1.2~BE-1.4 尚未驗收，僅記錄 BE-1.1 結果，不越界跑其他 WBS 項目。

## 風險與 Rollback
- 風險等級：低（TEST-ONLY；不動 runtime、不動 migration、不動其他測試）。
- 唯一觸及 DB 的動作是跑既有 e2e（`truncateAll` 清空 `smartlearning_test`，為既有隔離機制）。
- Rollback：`git checkout -- test/participant-account.e2e-spec.ts` 還原新測試。
- 不 down-migrate、不 truncate 其他 DB、不 commit（除非使用者另要求）。

## 成功標準
- `test/participant-account.e2e-spec.ts` 全綠、0 skipped。
- BE-1.1 八項子驗收逐一有對應測試斷言（附對應表）。
- 若發現實 bug，明確標記為「實作缺口」並停止，不擅自修 runtime。
- 記錄 commit hash、DB target、migration status、suite/test count 至 `tasks/todo.md` Results 區。