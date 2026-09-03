# US-F0 CP5 isolated stack Playwright 執行方案

## Context

繼續執行既有 US-F0 CP5 真實 backend browser gate。權威 spec：

- `/home/user/projects/smartLearning/smartLearning-ui/test/browser/us-f0-course-flow.spec.ts`

Spec 覆蓋 Course create/detail reload、CSRF/Origin negatives、admin revoke + stale teacher session、archive-only cleanup、permission restore、logout 與 context closure。不修改 product/backend code。

目前已確認的 isolated runtime：

- Compose project：`smartlearning-cp5-20260823`
- Backend：`http://localhost:3000`
- DB host port：`55435`
- Migration：exit `0`
- Network：`smartlearning-cp5-20260823_default`
- Volume：`smartlearning-cp5-20260823_cp5f0_20260823_pgdata`
- UI dev server：`http://localhost:3001`（Playwright config 會 reuse）

UI working tree 有既存的 `smartLearning-ui/tasks/todo.md` 修改，須保留；backend working tree clean。

## 執行範圍與安全邊界

- 只操作 CP5 isolated Compose project；不可操作 `smartlearning-backend`、`f16isolated`、`smart-learning-pg-dev` 或其 volumes。
- 不使用未限定 project 的 `docker compose`。
- 不使用 `down -v`、volume rm/prune、truncate、arbitrary row deletion，亦不停止其他 project 的 container。
- Credentials、cookies、CSRF tokens、raw backend messages 僅留在 provisioning/Playwright process memory，不寫入 source、task log、trace、console 或 chat。
- 不 commit，除非另行明確要求。

## Checkpoint A — runtime preflight

1. Read-only 檢查 UI/backend git status、`docker compose ls --all`，以及只限定 `smartlearning-cp5-20260823` 的 Compose status。
2. 檢查 named backend/DB/migrate containers、ports、network、volume labels；probe：
   - `GET /health/live`
   - `GET /health/ready`
   - UI `http://localhost:3001`
   - migrate exit code
3. 檢查合併後 Compose config；必須只有 backend host `3000`、isolated DB host `55435`，且只指向 CP5 volume/network。
4. 以「只顯示變數名稱、不輸出值」的方式檢查 8 個 F0 variables 是否已存在：
   - `F0_API_BASE`
   - `F0_UI_ORIGIN`
   - `F0_ADMIN_USERNAME`
   - `F0_ADMIN_PASSWORD`
   - `F0_TEACHER_ACCOUNT_ID`
   - `F0_TEACHER_USERNAME`
   - `F0_TEACHER_PASSWORD`
   - `F0_COURSE_NAME_PREFIX`

若 8 個 variables 已存在，沿用目前 CP5 runtime。若不存在，不能猜測或恢復 credentials；須保留目前 CP5 volume，僅針對明確命名的 CP5 containers 做可逆停用，另以新的唯一 CP5 Compose project/volume 建立 fresh fixture。不得觸碰其他 stack/volume。

## Checkpoint B — isolated fixture

1. 只對 CP5 project 使用已檢視的 `/tmp/cp5f0-provision-and-run.sh` provisioning flow。
2. Bootstrap 必須使用 current-source runtime image 內的 compiled entrypoint：
   `dist/src/bootstrap/bootstrap-admin.js`；不可使用 host `tsx` bootstrap workaround。
3. Provision fresh admin，再由真實 admin API 建立唯一 teacher：
   - 初始 `canCreateCourse=false`
   - 完成 forced password change
   - 取得 teacher account ID
4. 8 個 F0 variables 只在 process environment 傳遞；不能輸出 secret。只有 runtime、migration、CORS、source parity 與 fixture checks 全部通過後，才釋放該 flow 的 manual-confirmation marker。
5. 任一 fixture/prerequisite 失敗時，停止在 authenticated mutation 之前並標記 CP5 `blocked`；不可把 skipped test 當作 pass。

## Checkpoint C — existing Playwright spec

從 UI repo 執行：

```bash
node test/browser/run.mjs --list
node test/browser/run.mjs --workers=1 test/browser/us-f0-course-flow.spec.ts
```

Expected targets：

```text
F0_API_BASE=http://localhost:3000/api/v1
F0_UI_ORIGIN=http://localhost:3001
```

其餘 F0 values 由 isolated fixture process-only 傳入，Course prefix 必須是本次 run 唯一值。

實際 browser evidence 必須包含：

- Course create `201`、request body 僅 `name`/`description`、exact Origin/CSRF、server UUID redirect。
- Detail reload `200`，確認 `draft`、owner、唯一老師語意與無 F9 link/button。
- Missing-CSRF 與 blocked-Origin 均為 `403 AUTH_CSRF_INVALID`，Course ID 集合不變。
- Admin revoke 後，stale teacher session create 為 `403 FORBIDDEN`，顯示 curated UI，raw backend message 不可見，且無新 Course。
- `finally` 僅 archive 本次成功建立的 exact UUIDs。
- Restore original permission。
- Teacher/admin logout 均成功（`201`），並關閉 contexts。
- Cleanup failure 必須使 CP5 fail/blocked，不可宣稱成功。

## Checkpoint D — post-run evidence

1. 只收集 sanitized evidence：Chromium pass/fail、HTTP status/error codes、cleanup 結果與不含 secret 的 report path。
2. 再次檢查 named CP5 project health、container/volume/network scope，以及其他 Compose project 未受影響。
3. 若使用 fresh rerun project，原本的 `smartlearning-cp5-20260823_cp5f0_20260823_pgdata` 必須保留；temporary rerun project 如需停止，只能以其 exact project name 執行，亦不刪除 volume。
4. 真實 browser 與 cleanup 完成後，才在 `smartLearning-ui/tasks/todo.md` 追加 sanitized CP5 Results/acceptance entry；保留既有內容與未提交修改。若任何 gate 失敗，記錄 `blocked` 與具體下一步。

## Risk / rollback

- Risk：medium/high；會在 isolated fixture 建立 Course，並暫時切換 teacher `canCreateCourse`。
- Rollback：只可針對 exact CP5 project 做 stop/start；保留所有 volumes。不可 reset repositories、刪 arbitrary rows、刪 volume 或 broad teardown。
- 若需要 fresh fixture，先保存舊 CP5 project/container/volume labels，再操作新的唯一 project；舊 volume 不得被重建或刪除。

## Verification bundle

- Named CP5 Compose status/config、health/live、health/ready、UI 3001、migration exit `0`、source/runtime parity。
- `node test/browser/run.mjs --list` 發現 F0 test。
- Focused Playwright command：Chromium 1 worker，非 skipped。
- Course archive、permission restore、logout 與 cleanup evidence。
- 最終 container/volume scope 與 UI git status/diff review。

不重新宣稱既有 static/unit evidence；本方案只把 real-browser CP5 acceptance 補齊並留下可追溯結果。
