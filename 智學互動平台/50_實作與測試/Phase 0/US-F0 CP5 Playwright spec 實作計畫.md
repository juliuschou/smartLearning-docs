# CP5 real-backend Playwright spec

## Context

CP4 is complete, but the F0 real-backend acceptance flow is still missing: the existing browser coverage only exercises the F16 permission API and does not drive `/courses/new`, verify the server-ID redirect, or reload Course detail. The requested change is test-only: add the authoritative CP5 browser spec while preserving the existing Playwright runner/config and leaving product code, backend source, and dependencies untouched.

## Scope and acceptance criteria

- Add only `test/browser/us-f0-course-flow.spec.ts` plus a CP5 results/handoff section in `tasks/todo.md` after verification.
- Read fixture values only from `F0_API_BASE`, `F0_UI_ORIGIN`, `F0_ADMIN_USERNAME`, `F0_ADMIN_PASSWORD`, `F0_TEACHER_ACCOUNT_ID`, `F0_TEACHER_USERNAME`, `F0_TEACHER_PASSWORD`, and `F0_COURSE_NAME_PREFIX`; never persist or print credentials, cookies, CSRF values, or raw backend messages.
- Use two independent `browser.newContext()` instances: an admin context and a teacher context. Use each context's `request` API so browser cookies and CSRF state are shared; do not misuse the standalone Playwright `request` fixture.
- Exercise the real teacher UI on a 390×844 viewport with reduced motion and keyboard navigation, capture the real Course POST, and assert `201`, exact UI Origin, nonempty CSRF header, and an exact `{name, description}` request body.
- Assert the redirect uses the response envelope's server `data.id`; reload the detail route and capture the real `GET /courses/:id` `200`, checking name, `draft`, `ownerAccountId` matching the teacher session, unique-teacher semantics, and no F9 link/button. Perform a desktop detail overflow smoke check.
- Issue missing-CSRF and disallowed-Origin mutations through the authenticated teacher context; both must be `403 AUTH_CSRF_INVALID` and leave the complete Course ID set unchanged.
- Through the admin UI, verify the active teacher target and original permission, revoke `canCreateCourse` with focus/Space/ARIA and assert the real PATCH's `200`/Origin/CSRF. Keep the teacher session alive, submit the form again, and assert `403 FORBIDDEN`, curated `ErrorAlert`, no raw backend message, unchanged `/courses/new` URL, and no new Course ID.
- In independent cleanup steps, archive only the Course UUID created by this run, assert it becomes `archived`, restore the original permission through the admin UI, log out both sessions, close both contexts, and surface cleanup failures as test failures. Missing fixtures may remain skipped for discovery, but the task handoff must record that as `blocked`, never as real-E2E success.

## Implementation plan

1. Create `test/browser/us-f0-course-flow.spec.ts`, following the existing F16 spec's environment gating, accessible selectors, request assertions, and scoped cleanup, but with context-bound request helpers.
2. Add small local helpers for normalized API URLs, context CSRF-cookie lookup, SessionDto/Course envelope parsing, paginated Course-ID snapshots, mutation header/body assertions, UI login, keyboard Course-form submission, admin permission toggling, and stable error-code checks. Keep all helpers in the spec; there is no shared browser-helper or fixture module to extend.
3. Set up the admin UI context first, normalize the fixture permission to enabled while retaining its original value, then log the teacher in through the real UI, verify the teacher home CTA, and run the mobile create/detail/security flow.
4. Revoke permission from the admin context without recreating the teacher context, proving server-side reauthorization on the stale teacher session. Keep negative mutations and all Course-ID comparisons server-backed.
5. Implement nested/independent cleanup handling so archiving, permission restoration, logout, and context closure are attempted even when an earlier assertion fails. Do not add deletion, truncation, broad Compose teardown, or any backend/runtime workaround.
6. After implementation, review the exact diff scope and append the CP5 task-log results with static/browser command outcomes, fixture/cleanup status, acceptance matrix statuses, and any blocked real-runtime evidence without secrets.

## Critical files

- `test/browser/us-f0-course-flow.spec.ts` (new)
- `test/browser/us-f16-account-permission.spec.ts` (reference only; do not modify)
- `playwright.config.ts` and `test/browser/run.mjs` (reuse unchanged)
- `features/auth/LoginForm.tsx`, `features/teacher/TeacherHomeView.tsx`, `features/courses/CourseCreateForm.tsx`, `features/courses/CourseDetailView.tsx`, and `features/admin/AccountDetailView.tsx` (selector/behavior authorities)
- `lib/api/client.ts`, `lib/api/courses.ts`, `lib/api/csrf.ts`, and `lib/api/auth.ts` (Origin/CSRF/session behavior authorities)
- `tasks/todo.md` (CP5 handoff/results only)

## Risk and rollback

- Risk: medium/high because the test performs authenticated mutations against real Course and permission state.
- Mitigations: require isolated fixture variables, use `--workers=1`, capture only sanitized statuses/IDs in assertions, archive only test-created UUIDs, restore the original permission, and never touch the original backend volume or unrelated rows.
- Rollback: remove the new spec and the CP5 task-log section only; do not reset the working tree or alter product/backend/dependency files.

## Verification

Run from `smartLearning-ui` in this order:

```bash
npx next typegen
npm test -- test/course-create-form.test.tsx test/course-detail-view.test.tsx test/course-detail-route.test.tsx
npm run typecheck
npm run lint:check
npm run build
git diff --check
npm test
node test/browser/run.mjs --list
node test/browser/run.mjs --workers=1 test/browser/us-f0-course-flow.spec.ts
```

The final browser command is gated on a healthy backend/UI, migrated isolated database, exact runtime CORS, source/runtime parity, and all `F0_*` fixtures. If those conditions are absent, run discovery/static gates only and record CP5 as `blocked`; do not substitute skipped tests, mocks, or placeholders for real acceptance.
