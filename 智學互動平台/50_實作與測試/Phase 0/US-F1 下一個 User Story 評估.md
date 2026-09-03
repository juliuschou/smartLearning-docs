# US-F1 下一個 User Story 評估

- 評估日期：2026-08-22
- 評估範圍：`smartLearning-ui` 完成 US-F0 CP5 static implementation 後的下一個 user story

## 結論

Roadmap 上的 canonical next story 是 **US-F1：老師管理 Course 生命週期**。

但目前不應直接開始 F1 frontend implementation。正確順序是：

1. 先完成 US-F0 CP5 real-backend Playwright acceptance。
2. 再由 backend 補齊 F1 所需的歷史查詢與結果治理契約。
3. Backend contract 通過後，才開始 F1 frontend。

## US-F0 CP5 現況

- Static implementation：**PASS**。
- Playwright spec 已加入並提交於 `128e9b5`。
- Real backend acceptance：**BLOCKED**。
- 尚未完成 authenticated mutating browser flow。
- 所需 `F0_*` fixtures 與完整 runtime gate 尚未通過。
- 因此不能將 CP5 宣稱為完整 real-E2E success。

證據：`smartLearning-ui/tasks/todo.md` 的 US-F0 CP5 section。

## US-F1 的前置條件與 backend gap

F1 需要完整、可依賴的 backend contract，至少包括：

- teacher-owned Course lifecycle/history 查詢
- LiveSession list/history
- session-wide results
- ArchivedResult
- archive 與 active/waiting LiveSession 的阻擋與競態語意
- archived Course 的 server-side write rejection

目前 Course API 主要已有：

- `GET /courses`
- `GET /courses/:id`
- `POST /courses/:id/archive`

但尚未形成 F1 所需的完整歷史 session/result contract。不得自行推導 DTO 或以 frontend local state 取代 backend authority。

## 不應採取的 workaround

依專案 Option B frontend strategy：

- 不使用 frontend mock 或 placeholder 繞過 backend gate。
- 不自行推導 archived history/result response。
- 不用 local-only archived state 取代 server state。
- 不跳過 F0 CP5 real acceptance。
- 不把 F9 提前視為 F1 前的 canonical successor。

## 建議 checkpoint

### CP0 — 關閉 F0 CP5 acceptance gate

確認以下條件：

- isolated admin/teacher fixtures
- migrated isolated DB
- backend `3000`
- UI `3001`
- `CORS_ORIGIN=http://localhost:3001`
- 所有 `F0_*` fixture variables

先執行 non-mutating health/OpenAPI/migration checks；取得明確授權後執行：

```bash
node test/browser/run.mjs test/browser/us-f0-course-flow.spec.ts
```

若任一 fixture 或 runtime 條件不足，維持 **BLOCKED**，不要開始 F1。

### CP1 — Backend 完成 F1 contract

同步完成：

- controller / DTO / service
- OpenAPI
- `docs/frontend-api-reference.md`
- unit / integration / e2e tests
- migration status 與真實 history/result query 驗證

### CP2 — UI contract mapping

確認 pagination、archive response、session history、archived result、authorization 與 CSRF/Origin 語意。

### CP3 — F1 frontend implementation

預期範圍：

- teacher Course list
- Course detail lifecycle state
- archive confirmation flow
- archived read-only detail
- session/history/result projections
- query invalidation/refetch
- stable error handling

不加入未確認的 Course delete、restore、name PATCH 或 F9 題目入口。

### CP4 — 完整驗證

```bash
npx next typegen
npm run typecheck
npm run lint:check
npm run build
npm test
git diff --check
```

另需完成 backend integration/e2e 與真實 browser acceptance。

## 最終判定

> **下一個 user story：US-F1。**
>
> **目前 readiness：BLOCKED。**
>
> **立即可執行的下一步：先完成 US-F0 CP5 real-backend acceptance；之後等待或推進 F1 backend contract，不能先做 F1 frontend。**

## 依據

- `docs/智學互動平台/50_實作與測試/SPEC F0-F17 前端實作計畫.md`
- `smartLearning-ui/tasks/todo.md` 的 US-F0 CP5 結果
- `smartLearning-ui/CLAUDE.md` 的 Option B frontend strategy
- `smartLearning-backend/src/modules/courses/api/courses.controller.ts`
- `smartLearning-backend/docs/frontend-api-reference.md`
