# US-F0 CP2 — Frontend transport slice

## Context

CP0 final rerun is recorded as `PASS` in `smartLearning-ui/tasks/US-F0-CP0-preflight.md`; CP1 is recorded as `not-applicable` because the backend Course contract already exists. The user explicitly asked to continue with CP2. CP2 must remain limited to the UI API boundary and must stop before any form, route, CTA, or detail page work. After CP2 verification, pause and ask the user whether to enter CP3.

## Scope and acceptance criteria

- Add the Course wire types in `lib/api/types.ts`, aligned with the confirmed backend DTO:
  - `CourseStatus`: `draft | archived`.
  - `CourseDto`: `id`, `name`, nullable `description`, `status`, `ownerAccountId`, and ISO `createdAt`/`updatedAt`.
  - `CreateCoursePayload`: required `name`, optional `description` only.
- Add the Course query-key factory in `lib/api/query-keys.ts`, following the existing `accounts` pattern (`courses.all` and `courses.detail(id)`).
- Add `lib/api/courses.ts` with:
  - `useCreateCourse`: `POST /courses`, `mutate: true`, `credentials`/CSRF/Origin inherited from `apiRequest`, and a request body explicitly reconstructed from only `name` and defined `description` so runtime extra fields cannot cross the boundary. Use `ApiRequestError`, do not optimistically create a Course, and seed the detail cache only from the successful server response.
  - `useCourse(courseId)`: `GET /courses/:id` with the existing `signal`, `enabled: Boolean(courseId)`, `retry: false`, and `staleTime: 30_000` pattern.
- Add a focused transport test (for example `test/courses-api.test.tsx`) using the existing Vitest/Testing Library/React Query setup. Mock only `apiRequest` and prove:
  - create uses the exact path, method, mutation flag, and `{name, description?}` body with no owner/status/teacher/extra fields;
  - no detail cache is populated before a pending create resolves, and the successful server response seeds `courses.detail(id)`;
  - detail uses the exact ID path, forwards the abort signal, exposes the DTO, and uses the expected query key;
  - an empty ID disables the detail request; errors remain the typed API error path without retrying.
- Do not modify routes, components, pages, CTA/navigation, backend files, environment files, or add dependencies.

## Implementation checkpoints

1. Re-read the exact current API/query-key patterns and create only the three production transport files plus the focused test.
2. Run the targeted Course transport test and typecheck; if either fails, keep CP2 blocked and diagnose rather than expanding scope.
3. Run `npx next typegen` if generated route types are needed, then rerun the targeted test and `npm run typecheck`, followed by `git diff --check` and a scope/status review.
4. Record CP2 status, changed files, commands/results, public hook usage, and any unresolved route/fixture blocker in `tasks/todo.md` and a CP2 handoff only after verification. Do not commit unless separately authorized.
5. Stop at the CP2 boundary and ask the user for explicit confirmation before CP3.

## Verification

- Targeted: `npm test -- test/courses-api.test.tsx`
- Static: `npx next typegen` (when required), `npm run typecheck`, `git diff --check`
- Scope gate: `git status --short`, `git diff --name-only`; confirm no form/route/page/backend/env changes.
- CP2 is complete only if the transport test and typecheck pass. CP3/CP4/CP5 behavior and real backend/Playwright acceptance remain outside this checkpoint.

## Risk and rollback

- Risk: medium; this is authenticated Course transport and cache wiring, but no schema or server change.
- Rollback: remove/revert only `CourseDto`/payload types, `courses` query keys/hooks, and the CP2 transport test. Preserve existing auth, F16, student, teacher, and backend work; do not reset the working tree or delete runtime data.
- Security invariant: all mutations continue through `apiRequest` with `credentials: "include"`, exact Origin, and CSRF token; no credentials, cookies, tokens, or raw server messages are logged.

## Requested plan handoff

- After plan-mode approval, save a verbatim copy of this plan as `/home/user/projects/smartLearning/docs/智學互動平台/50_實作與測試/US-F0 CP2 前端傳輸切片實作計畫.md`.
- The requested Windows UNC location is the same directory as the WSL path above: `\\wsl.localhost\Ubuntu\home\user\projects\smartLearning\docs\智學互動平台\50_實作與測試`.
- Create this new handoff file; do not overwrite the existing authoritative `US-F0 老師建立課程前端實作計畫.md`.
- Verify the saved file exists and report its exact path. This documentation handoff is separate from beginning CP2 implementation; no product files or commits are authorized by the save request.
