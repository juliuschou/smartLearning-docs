# Context

**Requested saved-plan destination:** `\\wsl.localhost\Ubuntu\home\user\projects\smartLearning\docs\智學互動平台\50_實作與測試`

Phase B（學生帳號 + 加選名冊）的 runtime 程式碼、測試與三個 additive migration 已在目前 working tree 的歷史 commit 中完成；目前已確認 `smartlearning_test` 與 `smartlearning_dev` 均已套用 migration。B1–B4 仍需重新執行 targeted DB-backed acceptance；B5 的權威設計文件也仍明確描述「無學生帳號」，需要同步。此次目標是安全完成 Phase B 驗證，不覆蓋目前既有 dirty work，也不碰非 Phase B 的 CP5/F8 內容；所有高風險 DB/認證/realtime 動作在 checkpoint 停下讓使用者手動確認。

# Current evidence

- Phase B implementation is present for B1–B4; code-only gates previously passed.
- Phase B migrations are present and, per the latest read-only status checks, already applied in both guarded test and development databases:
  - `prisma/migrations/20260818100000_add_student_role`
  - `prisma/migrations/20260818110000_add_course_enrollment`
  - `prisma/migrations/20260818120000_bind_participant_account`
- Historical execution notes state DB-backed identity, enrollment, account-bound participant, and realtime tests were deferred; this plan supersedes that stale migration-blocker note and requires fresh targeted verification.
- Relevant implementation/test areas include `src/modules/identity`, `src/modules/enrollments`, `src/modules/participants`, `src/modules/realtime`, `prisma/schema.prisma`, and `test/*student*`, `test/*enrollment*`, `test/*participant*`, realtime e2e files.
- Authoritative sibling docs still contain the old MVP restriction; B5 must update the authorization matrix and student-account premise rather than silently claiming docs are synchronized.

# Recommended execution plan

## Checkpoint A — authorize targeted DB verification

1. Read current git status/diff and verify the three migration SQL files, the guarded test DB target, and migration status.
2. Show the user a sanitized scope summary (database name only, no credentials) and stop for manual confirmation.
3. After confirmation, run targeted B1–B4 integration/e2e tests against the already-migrated `smartlearning_test` database; do not reapply or edit migrations.
4. If the target is not exactly `smartlearning_test`, PostgreSQL is unavailable, or a suite silently skips because the DB is unreachable, stop and report BLOCKED.

## Checkpoint B — B1/B2 database-backed identity and enrollment

1. Run targeted identity integration and student/account e2e tests, then enrollment e2e and OpenAPI assertions.
2. Verify: student role is accepted; `canCreateCourse` is forced false; student cannot use teacher/admin owner paths; teacher owner/admin can add/remove/list roster; archived courses reject new enrollment; student `/api/v1/me/courses` lists active enrollments; idempotency/duplicate behavior is stable.
3. Stop and present a compact PASS/FAIL report before proceeding to account-bound participant mutations.

## Checkpoint C — B3 account-bound HTTP participant flow

1. Run account-bound participant/submission integration and e2e coverage.
2. Verify student cookie join/resolution/submission, active enrollment checks, CSRF/Origin behavior, participant uniqueness/idempotency, disabled-account and removed-enrollment rejection, and anonymous session-code + participant-token fallback unchanged.
3. Run the concurrency/lock-focused tests and stop for manual confirmation before realtime acceptance if any failure or schema mismatch appears.

## Checkpoint D — B4 realtime + B5 privacy/docs

1. Run realtime student handshake/snapshot/result tests and verify student sockets enter only `session:<id>`, receive participant-safe `result.updated`, never receive teacher `counts.updated`, and are reauthorized after disable/removal.
2. Verify gateway and REST participant snapshot projections match and redaction covers cookies, participant/session tokens, credentials, answer payloads, and open-text content.
3. Update only the authoritative sibling design documents that currently state no student accounts / admin-teacher-only authorization, preserving history and clearly marking the new Phase B decision. Do not edit already-applied migrations.
4. Run OpenAPI and targeted docs/contract assertions.
5. Stop for manual confirmation before broad regression if the user wants the docs change reviewed separately.

## Final verification

After the user confirms continuation:

- `npm run typecheck`
- `npm run lint:check`
- `npm run format:check`
- `npm run build`
- `npm test -- --runInBand`
- targeted and then full `NODE_ENV=test npm run test:e2e -- --runInBand`
- targeted and then full `npm run test:integration -- --runInBand`
- `NODE_ENV=test npm run prisma:migrate:status`
- `git diff --check`

Run verbose test commands through a test subagent and return structured PASS/FAIL/BLOCKED evidence. Never reset or overwrite unrelated working-tree changes. Do not commit unless separately requested.

# Risk and rollback

- Risk: high — role authorization, enrollment tenancy, account-bound identity, session/realtime handshake, and additive schema changes.
- Rollback: stop at any failed gate; revert only Phase B application/docs changes if requested. Do not down-migrate, truncate, delete rows broadly, restore revoked sessions, or alter unrelated CP5/F8 work. If a migration must be corrected, use a forward additive fix or an explicitly authorized isolated test DB reset.

# Success criteria

- Student can log in, be enrolled, list `/me/courses`, join an eligible live session with cookie identity, and submit.
- Teacher/admin can manage the roster; student cannot access owner/admin course/question/session paths.
- Anonymous session-code/token join and submission still pass.
- Student realtime behavior is participant-safe and isolated from teacher counts.
- DB-backed B1–B4 tests and final verification gates pass.
- Authoritative design docs and authorization matrix no longer contradict the delivered Phase B behavior.
