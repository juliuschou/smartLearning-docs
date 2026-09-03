# BE-8.6 CP6 — Redaction review 計畫

## Context

BE-8.6 CP6 要對 CP1–CP5 累積的新欄位與輸出面做一次跨切片資訊洩漏稽核。WBS 與 CP0 frozen contract 指定範圍為：中央 Pino redaction、例外訊息、validation details、generated OpenAPI schemas 與 Swagger examples/defaults；並特別要求檢查 `expiresAt`、CLI successor/raw key、account update 欄位及 rate-limit key composition。每個新認定的敏感欄位都必須有可執行 tripwire，最後由使用者人工比對實際 sanitized log 與 error envelope；自動測試通過不能取代 Checkpoint 6 簽核。

本次只做 redaction/disclosure hardening，不實作 CP7 metrics，不改 API 契約、Redis bucket/HMAC 演算法、權限、資料模型或 migration。

## Success criteria

- CP1–CP5 的敏感欄位都有明確分類、實際 sink/path 與測試對應。
- log、error envelope、validation details、OpenAPI examples/defaults 不含 credential、token、hash、answer/question content、request PII、rate-limit internal key 或任意 exception message。
- 合約允許回傳的 `expiresAt`、一次性 CLI `rawKey` 等仍保留在正確 API response；redaction 不等同修改 wire contract。
- 必要的 operational IDs 與刻意結構化的安全 metadata 不被 blanket redaction 誤刪。
- 每個新增 redaction/sanitization 規則都有 sentinel-based executable tripwire。
- 產出可供人工抽查的 sanitized log/error-envelope specimens，Checkpoint 6 維持 `PENDING`，直到使用者明確回覆 `Checkpoint 6 verified`。

## Risk, rollback, and boundaries

- **Risk: high**：漏遮罩會洩漏秘密；過度遮罩會破壞可觀測性或誤改公開契約。
- 使用精確 context paths 與 sink-level safe logging，不加入 `*.expiresAt`、`*.displayName`、`*.id` 等全域 wildcard。
- rollback 僅為程式／測試／文件 revert；無 schema/data rollback，不得變更或恢復 credential/rate-limit state。
- DB-free unit/static checks 優先。任何 DB-backed/OpenAPI E2E 執行前須確認 `NODE_ENV=test` 與 `smartlearning_test`；不得碰 `smartlearning_dev`，不得靜默 skip。
- 若實際 Pino/pino-http record shape 與現有測試假設不同、contract 文件衝突、或無法為新敏感欄位建立 tripwire，立即停止並重新規劃。

## Implementation plan

### 1. 建立 CP6 稽核台帳與分類矩陣

先更新 `tasks/todo.md`，加入：來源文件、acceptance criteria、working notes、dependencies/environment、risk/rollback、DB boundary、stop conditions、實作與驗證 checklist、Results placeholder、`Manual Checkpoint 6 pending`。

核准執行後，先將本計畫保存為 `../docs/智學互動平台/50_實作與測試/BackendBE8/be-8-cp6-redaction-review-plan.md`，作為 CP6 的固定執行基線；另新增 `../docs/智學互動平台/50_實作與測試/BackendBE8/be-8-cp6-redaction-review.md` 記錄實際稽核結果與證據：

- 欄位／資料類別：來源、sink、API 是否允許、log 是否允許、現有防護、tripwire。
- 四個必查群組：`expiresAt` context、CLI successor/raw key、account-update values、login/CLI rate-limit keys。
- HTTP、Socket.IO、background/bootstrap console、error/validation、OpenAPI surfaces。
- 僅使用明顯的 synthetic sentinels，不寫入真實秘密、PII、環境值或題目內容。

分類政策：

- **永不入 log**：password/hash、cookie/auth/CSRF/token、CLI raw key、idempotency/payload hashes、submission answers、open-text content、question batch/preview/correctness content、request-body PII、raw/composed rate-limit keys、任意 thrown message/value。
- **context-sensitive**：合法 API response 的 `expiresAt`/`rawKey` 可依契約存在，但若 response body 被序列化進 log，對應 path 必須移除；`req.body.displayName` 遮罩，但不全域遮罩所有 `displayName`。
- **可保留 metadata**：刻意結構化且有營運必要的 stable resource IDs、固定 reason/code、request ID、`errorType`。

### 2. 先新增 failing tripwires，再修 production behavior

所有新增測試使用唯一 sentinel，並對完整 serialized output/envelope 做 `not.toContain`，而非只檢查欄位不存在。代表性 sentinel 包含：exception message、account display name、question prompt/option/correct ref、successor raw key、validation target/value、token expiry context、raw/composed rate-limit key。

### 3. 補齊中央 Pino redaction

修改：

- `src/common/observability/pino-redaction.ts`
- `src/common/observability/pino-redaction.spec.ts`

重用既有 `PINO_REDACT_PATHS`、`PINO_REDACT_REMOVE = true` 與真實 Pino `Writable` serialization pattern。依實際 DTO/envelope shape 加入精確 paths，至少覆蓋：

- account/participant update request PII：`req.body.displayName`；
- question batch request collection：`req.body.questions`；
- batch response 的 `questions`、`preview`、`payloadHash`、validation-token-context `expiresAt`（top-level 與 `data` envelope 形狀）；
- 既有 CLI `rawKey`、validation token、answer/open-text paths 保持有效。

以 collection root 遮罩 question/preview，避免逐一列舉 prompt/options/correct refs。測試同時證明 secret sentinels 全部消失，以及刻意安全的 `accountId`、`username`、structured safe metadata 仍保留。除非實際 record shape 證明必要，不建立大型 AppModule/pino-http harness。

### 4. 移除任意 `error.message`／`String(error)` logging

逐一審閱並修改目前把 arbitrary error message 放入 logger 的 catch paths：

- `src/modules/identity/application/account.service.ts`
- `src/common/auth/account-lifecycle.bus.ts`
- `src/modules/realtime/live-session-event-bus.ts`
- `src/modules/participants/application/participant.service.ts`
- `src/modules/submissions/application/submission.service.ts`
- `src/modules/live-sessions/application/live-session.service.ts`
- `src/modules/realtime/live-gateway.ts`

統一改為 fixed event/reason + safe IDs + `errorType`（`Error.name` 或 `typeof`），不記錄 message、stack、error object 或 non-Error thrown value。保持 post-commit fire-and-forget、listener isolation、socket cleanup 與原控制流程不變。

在既有 colocated specs 中加入最小 logger-spy tests；每個具代表性的 sink 讓 listener/dependency 丟出含 sentinel 的 `Error`，並確認：

- 原本的 isolation/continuation 行為不變；
- logger calls 不含 sentinel；
- 固定 event metadata 與 `errorType: 'Error'` 仍存在；
- 至少一例 non-Error secret string 只記錄 `errorType: 'string'`。

驗證時再以 source search 確認 production logger argument 不殘留 `error.message`、`String(error)` 或 message interpolation；不機械修改用於程式控制流但未寫 log 的 error access。

### 5. 封住 bootstrap console sink

修改 `src/bootstrap/bootstrap-admin.ts`：

- failure output 改為固定訊息加安全 error type，不輸出 `err.message` 或 raw thrown value；
- success output 不輸出 bootstrap username/displayName；保留必要的 admin ID/role 即可；
- 不在 CP6 將整個 bootstrap 重構成 Pino。

若可用極小、import-safe helper 測試 formatter/classifier，加入 colocated unit test；否則以 source tripwire 加 manual synthetic failure specimen 驗證，不為測試擴大 bootstrap 架構。

### 6. 強化 validation details 與 public error audit

修改／測試：

- `src/common/http/validation-exception.ts`
- `src/common/http/validation-exception.spec.ts`
- `src/common/http/global-exception-filter.spec.ts`

保留現有 deterministic field-path 與 target/value 不複製的設計；新增帶 secret sentinel 的 `ValidationError.target`、`value` 與 nested cases，對 flattened issues、exception response、最終 envelope 的完整 JSON 斷言不洩漏。

另外測試 class-validator constraint message 已回顯 rejected value 的情境。只有測試證明目前會洩漏時，才在 shared factory 做窄幅 fail-safe normalization：遇到 message 含該 rejected value 時，以固定 field-scoped invalid message 取代；不以猜測秘密格式的 regex 處理，也不破壞 field path/排序。

稽核所有 `DomainError`/`ValidationError` 動態 message call sites。固定訊息保留；只有確定插入 caller-controlled value 的位置才改為 generic wording（例如 account role validation 保留 `field: 'role'`，不回顯輸入值）。`GlobalExceptionFilter` 的既有 Prisma/framework/unknown generic handling 原則上不改，除非 tripwire 找到實際缺口。

### 7. 固化 rate-limit key 不洩漏規則

不改 `LoginRateLimitKeyFactory` HMAC/domain separation/namespace，也不把 generic `key` 欄位加入 blanket redaction。

擴充：

- `src/modules/rate-limit/login-rate-limit-key.factory.spec.ts`：證明輸出 deterministic/domain-separated，且不含 raw account/source/HMAC secret。
- `src/modules/rate-limit/redis-login-rate-limit.store.spec.ts`：以 logger spies 證明 outage/close failure 只含 fixed reason 與 safe error type/name，不含 username、source IP、digest/full Redis key、Redis URL 或 exception message。

CLI operation limiter 的 `${policy}:${credentialId}` 維持 internal-only；以 source/call-site audit 證明未被 log/response 暴露，而不是變更 bucket semantics。

### 8. Audit generated OpenAPI / Swagger metadata

擴充 `test/openapi.e2e-spec.ts`，直接檢查生成的 `/api/docs-json`：

- `UpdateAccountDto` 僅含 frozen allowlist，無 password/hash/token/credential/internal fields。
- ordinary `CliCredentialDto` 無 `rawKey`/`keyHash`；一次性 create/rotate response 保留 `rawKey` 且無 `keyHash`。
- `rawKey`、participant/validation token、payload/answer/question content、`expiresAt` 不得出現在不應出現的 schema，且敏感 properties 不得附 usable `example`、`examples` 或 `default`。
- `expiresAt` 保留在 session/validation contract，ordinary CLI credential schema 不得新增 expiry/grace/pending fields。

加入小型 test-only recursive walker，回報 JSON-pointer-like path，掃描 `example`/`examples`/`default` 與 secret-shaped literal；用窄 allowlist 保留 pagination defaults、enum/count、generic UUID placeholders 等安全文件值，避免禁用全部 Swagger examples。

### 9. 建立人工 Checkpoint 6 evidence

若現有 unit/OpenAPI tests 無法直接呈現完整可讀 specimens，新增明確排除於 default E2E 的 `test/manual-cp6-verify.e2e-spec.ts`，並依現有 manual checkpoint pattern 更新 Jest exclusion。Verifier 僅使用 synthetic sentinels，輸出：

1. sanitized Pino request/response record；
2. caught-exception log（fixed event + `errorType`）；
3. validation error envelope；
4. unknown/internal error envelope；
5. rate-limit envelope/outage log。

每個 specimen 在 CP6 review doc 記錄：ID、exact command、spec/test、sentinel 類別、sanitized JSON、must-be-absent、must-remain、test count、HEAD/date，以及 `Manual status: PENDING USER INSPECTION`。不得自行標記 verified；展示證據後等待使用者明確簽核，簽核紀錄另一步更新。

## Verification

依 smallest-first 執行，verbose suites 交由 test subagent，回傳 command/scope/result/counts/failures/diagnosis/confidence：

1. **DB-free targeted unit tests**
   - Pino redaction
   - validation exception + global exception filter
   - modified bus/service/gateway logger paths
   - rate-limit key factory + Redis store logging
   - bootstrap helper/spec（若新增）
2. **Static disclosure searches**
   - production logger calls 無 `error.message`、`String(error)`、message interpolation
   - bootstrap output 無 username/raw thrown message
   - 每個新增敏感欄位都有 tripwire 對應
3. **Generated OpenAPI E2E**
   - 先確認 approved test environment/DB boundary，再單獨跑 `test/openapi.e2e-spec.ts`
4. **Relevant negative-disclosure E2Es**
   - account admin/update
   - CLI credential create/rotate
   - question batch validate/confirm
   - auth/login and CLI operation rate-limit envelopes
5. **Manual CP6 verifier**
   - 顯式單獨執行；確認不在 default E2E bundle，記錄 specimens 後停在人工簽核
6. **Quality/regression gates**
   - `npm run prisma:validate`
   - `npm run typecheck`
   - `npm run lint:check`
   - `npm run format:check`
   - `npm run build`
   - `npm test -- --runInBand`
   - default E2E/integration only under confirmed `smartlearning_test`, zero failure/zero skipped
   - read-only `npm run prisma:migrate:status`
   - `git diff --check`
   - final scoped diff review and `git status --short`

所有命令與 suite/test/skip counts 寫回 `tasks/todo.md` Results。任何 silent skip、錯誤 DB target、secret sentinel 出現、正常 suite 被 exclusion 誤排除，均視為 BLOCKED/STOP，不得宣稱完成。

## Critical files

- `tasks/todo.md`
- `../docs/智學互動平台/50_實作與測試/BackendBE8/be-8-cp6-redaction-review.md`
- `src/common/observability/pino-redaction.ts`
- `src/common/observability/pino-redaction.spec.ts`
- `src/common/http/validation-exception.ts`
- `src/common/http/validation-exception.spec.ts`
- `src/common/http/global-exception-filter.spec.ts`
- `src/bootstrap/bootstrap-admin.ts`
- logger call sites listed in step 4 and their nearest existing specs
- `src/modules/rate-limit/login-rate-limit-key.factory.spec.ts`
- `src/modules/rate-limit/redis-login-rate-limit.store.spec.ts`
- `test/openapi.e2e-spec.ts`
- optional `test/manual-cp6-verify.e2e-spec.ts` and Jest exclusion config

## Explicit non-goals / unchanged behavior

- 不新增 `/metrics`、counters、labels、dashboard 或 alerts。
- 不改 API envelope、session expiry semantics、account update allowlist/authorization、CLI one-time `rawKey` contract、question batch contract、rate-limit semantics/outage behavior。
- 不改 Prisma schema/migrations/data，也不改 Redis HMAC key composition/namespace。
- 不把合法 `expiresAt`、所有 `displayName` 或 stable IDs 全域遮罩。
- 不破壞 post-commit publish、listener isolation、socket cleanup 或 graceful failure control flow。
