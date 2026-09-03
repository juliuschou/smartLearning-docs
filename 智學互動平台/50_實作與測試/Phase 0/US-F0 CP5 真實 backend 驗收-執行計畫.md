# US-F0 CP5 — Real-backend Playwright acceptance (isolated fixture)

## Context

US-F0 (teacher creates a Course) frontend is built (CP2 transport, CP3 form/routes, CP4 detail) and has static/unit evidence. The only open acceptance is **CP5 real-backend Playwright gate** — actually driving the UI against a live backend and proving the whole matrix (Course create→server detail, CSRF/Origin no-row invariants, admin revoke → stale-teacher 403, scoped cleanup). This was **BLOCKED** in every prior attempt because the isolated runtime/fixture prerequisites were missing or the frozen `/tmp` provisioning artifacts had been cleaned up.

The current environment is fully down (backend `3000`, UI `3001`, all DB ports closed). Docker daemon is up (29.5.3) and `docker compose *` is permission-allowed in the backend repo.

### Why the previous attempts blocked — and how we avoid it now

- The reviewed provisioning script `/tmp/cp5f0-provision-and-run.sh` and the isolated Compose file `/tmp/smartlearning-cp5-20260823.yml` are **gone** (`/tmp` cleaned). We must **reconstruct** a fresh, self-contained isolated Compose + provisioning flow (this is the exact documented fallback when a required artifact is absent).
- The existing volume `smartlearning-cp5-20260823_cp5f0_20260823_pgdata` is preserved but its admin/teacher **credentials are unrecoverable** (provisioning process was stopped; secrets were in-process only). Per the authoritative protocol, when `F0_*` vars are absent we must **not** guess/recover credentials and must **not** reuse that fixture volume — we create a **new, uniquely-named project + volume** and keep every existing volume/container untouched.

### Goals / acceptance criteria (authoritative docs: `US-F0 CP5 真實 backend Playwright 驗收計畫.md`, `US-F0 CP5 isolated stack 執行方案.md`)

- Real UI `3001` → real backend `3000`, runtime `CORS_ORIGIN` exactly `http://localhost:3001`, migrated DB, backend built from the current checkout (source/runtime parity).
- Isolated teacher (`canCreateCourse` togglable) creates a Course through the real UI: POST 201, body only `name`/`description`, server-UUID redirect, detail reload GET 200, `draft`/owner/unique-teacher semantics, no F9 dead link.
- Missing-CSRF and blocked-Origin negatives are both `403 AUTH_CSRF_INVALID`, Course ID set unchanged.
- Admin revoke → stale teacher session create is `403 FORBIDDEN`, curated UI (no raw backend message), no new Course.
- `finally` archives only this run's exact UUIDs, restores original permission, logs out both contexts, closes contexts; any cleanup failure marks CP5 blocked.
- No credentials/cookies/CSRF/raw messages/tokens in source, task log, trace, console, or chat.

## Approach

A fresh, uniquely-named Compose project (built from the current backend checkout) on a new DB port + new volume, a compiled-bootstrap admin, a real-API-created teacher with forced password change, all 8 `F0_*` vars injected into the provisioning process only, then the existing spec run `--workers=1`.

### Checkpoint plan (pausing for manual decision, per your note)

| Step | Action | Authorization needed |
|---|---|---|
| CP-A | Sanitized read-only preflight (repo status, compose scope inventory, `/tmp` artifact absence confirmation, F0 var absence) | read-only — no prompt |
| CP-B | Reconstruct isolated compose file + provisioning helper in `/tmp`, `docker compose build`, `up` fresh project, migrate, health/CORS/OpenAPI parity | container lifecycle — **manual checkpoint** |
| CP-C | Provision admin (compiled bootstrap) + teacher (real admin API) + forced password change + set 8 `F0_*` env in-process | fixture mutation — **manual checkpoint** |
| CP-D | Start UI 3001 (reuse existing), run `node test/browser/run.mjs --workers=1 test/browser/us-f0-course-flow.spec.ts`, scoped cleanup | live mutating browser — **manual checkpoint** |
| CP-E | Collect sanitized evidence, verify Compose scope/volumes preserved, append sanitized CP5 Results to `smartLearning-ui/tasks/todo.md`, do **not** commit | — |

Each "manual checkpoint" pauses the execution and asks for explicit confirmation via `AskUserQuestion` before the next mutating step (per the authoritative Manual-A / Manual-B gating and your instruction to keep checkpoints).

## Implementation detail

### Backend fixture (isolated)

The plan builds a fresh Compose project (e.g. project `smartlearning-cp5-<date>-f0`), never the base project. A self-contained override at `/tmp/smartlearning-cp5-<unique>.yml` interpolates from a **fresh generated** secret/DB-password, and maps:
- `backend` → host `3000:3000`, env `CORS_ORIGIN=http://localhost:3001`, `DATABASE_URL` → `db`, `NODE_ENV=production`, a generated `COOKIE_SECRET`.
- `db` → host `5543X:5432` (a new unused port; existing are 5432/5433/55433/55435), fresh named volume.
- `migrate` (one-shot) → waits on db healthy, exits `0`.

Built with `docker compose -f /tmp/smartlearning-cp5-<today>.yml -p <project> build` then `up -d`. Existing projects/containers/volumes (`smartlearning-backend`, `f16isolated`, `smartlearning-cp5-20260823`, `smartlearning-cp5-20260822`) are left untouched (all are exited; no port conflicts).

Provision (all credential material stays in the provisioning process; nothing persisted/printed):
1. **Admin** via compiled entrypoint inside the running runtime container: `docker compose -f <file> -p <proj> exec -T backend node dist/src/bootstrap/bootstrap-admin.js` with `BOOTSTRAP_ADMIN_USERNAME/PASSWORD/DISPLAY_NAME` env (fresh generated). Verify exit `0` and prints admin username/role (no password). (Host `npm run bootstrap:admin` fails under `tsx` — use the compiled artifact.)
2. **Teacher** via the real admin API: `POST /api/v1/admin/accounts` (`{ username, displayName, role: "teacher", canCreateCourse: false, tempPassword }`), gated by admin login cookies + CSRF token. Confirm it returns the teacher account ID and role `teacher`, `status active`, `mustChangePassword`.
3. **Forced password change** for the teacher (login → `POST /api/v1/auth/change-password`) so the spec's UI login lands on `/courses/new` (not the change-password redirect). Capture the teacher's final username/password.
4. Export the 8 `F0_*` vars into the provisioning shell env: `F0_API_BASE=http://localhost:3000/api/v1`, `F0_UI_ORIGIN=http://localhost:3001`, `F0_ADMIN_USERNAME/PASSWORD`, `F0_TEACHER_ACCOUNT_ID`, `F0_TEACHER_USERNAME/PASSWORD`, `F0_COURSE_NAME_PREFIX=<unique>`.

### Frontend spec run

From `/home/user/projects/smartLearning/smartLearning-ui`:
```bash
node test/browser/run.mjs --list                       # discovers the F0 test (non-skipped)
node test/browser/run.mjs --workers=1 test/browser/us-f0-course-flow.spec.ts
```
Playwright's `webServer` config reuses an already-running `3001` dev server (or starts `npm run dev`). The spec requires all 8 vars set to run; it fails closed (not `test.skip`) when gating inputs are invalid. After the run: verify Course archive, permission restore, logout all succeeded (spec asserts these in `finally`; any cleanup error fails the run).

### Static gates (unchanged, minimal re-verification)

Re-run only the CP5-relevant static bundle (per authoritative plan) — note CP2/CP3/CP4 static evidence already committed; these are a parity check, not new work:
```bash
npx next typegen && npm run typecheck && npm run lint:check && npm run build && git diff --check
```
These do not require the isolated fixture. Re-run to keep evidence current and confirm no drift.

## Critical files

- **Run target (read-only, existing)**: `test/browser/us-f0-course-flow.spec.ts` (authoritative, already committed `128e9b5`) — we only execute it, never modify product code.
- **Runner**: `test/browser/run.mjs`, `playwright.config.ts` (already committed).
- **Isolated compose (to reconstruct)**: `/tmp/smartlearning-cp5-<today>.yml` (new, unique; self-contained).
- **Provisioning helper (to reconstruct)**: `/tmp/cp5f0-<today>.sh` (new, unique; gated on fixture marker + manual confirmation before UI mutations).
- **Result record**: append CP5 section to `smartLearning-ui/tasks/todo.md` (sanitized) and the required `tasks/lessons.md` lesson for the `/tmp`-artifact-loss tripwire.

## Risks & rollback

- **Risk**: medium/high — creates real Courses and toggles teacher `canCreateCourse` in an isolated fixture; touches an authenticated mutation and CSRF/CORS path.
- **Rollback**: only `docker compose -f <isolated> -p <project> stop/start` for the exact fresh project; never `down -v` / volume rm / truncate / delete rows. All existing volumes (`smart...-20260822`, `...20260823`, backend/f16 volumes) preserved untouched.
- **Guardrails**: `--workers=1`; baseline Course-ID set; `finally` archive only exact UUIDs; restore original permission; logout teacher/admin; fail closed if any gate missing — never treat a skipped test as PASS; no credentials/cookies/CSRF/raw backend messages in any output; no commit unless explicitly asked.
- **If build/provision fails**: stop at the failing checkpoint, record `blocked` + exact command, do **not** edit the Dockerfile or product code in this CP5 run.

## Verification story (how we know it works)

- Named fresh Compose project: backend `3000` healthy, DB new port healthy, migrate exit `0`, `CORS_ORIGIN=http://localhost:3001` (ACAO reflects `3001`, blocked origin no ACAO).
- `node test/browser/run.mjs --list` shows the CP5 spec (non-skipped).
- Chromium run `--workers=1`: **1 passed, 0 skipped** (not a skipped pass).
- Evidence recorded: create `201` + body keys `name`/`description` + exact Origin/CSRF; detail reload `200` `draft`/owner/unique-teacher; two negatives `403 AUTH_CSRF_INVALID` with unchanged ID set; revoked permission → `403 FORBIDDEN` curated UI no raw; archive-only cleanup, permission restore, logout; final container/volume scope and UI `git status`/`git diff --check`.
- Sanitized CP5 Results appended to `smartLearning-ui/tasks/todo.md` (no secrets).

## Open assumption (falsifiable)

- The 8 `F0_*` fixture values must be provisioned **fresh** (current source) in the new project; the existing CP5 volume's fixtures are unusable (credentials unrecoverable) and will be preserved but not reused — per the documented protocol when `F0_*` are absent.
- Verification that this is correct: the new project uses a distinct DB port and named volume; existing project/volume inventory is unchanged after the run.
