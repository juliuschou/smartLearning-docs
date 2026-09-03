# US-F7 使用者設定與變更密碼

## Context

US-F7 lets a user set a policy-compliant password and change it, with admin-issued temp-password recovery. The frontend plan (`docs/智學互動平台/50_實作與測試/SPEC F0-F17 前端實作計畫.md`) marks the **full story as blocked** because two backend pieces are missing against SPEC R-F7-3 / R-F7-7:

- **R-F7-3** — reject platform-known common/breached passwords. `password-policy.ts` only enforces length today; breach/common source is undecided (M2 red card). Web Auth design line 137/381 confirms "common/breached check 後續補".
- **R-F7-7** — account+source dual login rate limit, returning stable `RATE_LIMITED`, no permanent lockout, no account-existence leak. `AuthService.login` writes no `LoginAttempt` and has no throttle (Web Auth design line 159/326).

The existing backend already delivers the rest: length policy 12–128 Unicode (R-F7-1/2), current-password verification on change (R-F7-5 via `auth.service.ts changePassword`), admin reset → `mustChangePassword=true` (R-F7-6 via `AdminService.resetPassword`), and session rotation after password change (R-F6-5 via `sessions.rotateAfterCredentialChange`). The frontend already references `/settings/password` as the `mustChangePassword` gate target in `LoginForm`, `(admin)/layout.tsx`, and `(student)/layout.tsx` — but that route 404s today.

User chose **full scope**: close the two backend gaps (with integration tests), then build the complete F7 frontend (settings/password page, force-change flow, reusable `StepUpDialog`).

## Risk level

**High** — auth/password/rate-limit. Requires rollback strategy and expanded verification (unit + integration + manual). Per Web Auth design: rate limit must not bypass `SessionGuard`/permission checks, must not leak account existence, must not permanently lock out. Common-password list must not log raw passwords (redaction invariant).

---

## Part A — Backend gaps

### A1. Common/breached password rejection (R-F7-3)

**Files:**
- `smartLearning-backend/src/modules/identity/domain/password-policy.ts` — add `rejectCommonPassword(password)` that checks a static embedded blocklist (normalized: trim, NFKC, casefold) and throws `PasswordPolicyError`. Source list is undecided (M2 red card) — use a small curated static blocklist file (`src/modules/identity/domain/common-passwords.ts`) of well-known weak passwords (e.g. "password123456", "qwerty12345", "iloveyou12345"). Document that the real breached-password source (HIBP k-anonymity / downloaded list) is deferred; this static list is the MVP floor. No external network calls (determinism + no supply-chain).
- `auth.service.ts changePassword` — after the `validatePassword` length check, call `rejectCommonPassword(input.newPassword, 'newPassword')`.
- `account.service.ts createAccount` and `resetPassword` — apply the same check to temp passwords so admin-issued temp passwords are not themselves common (consistent invariant: every password written to `password_hash` passes the full policy).
- New `password-policy.spec.ts` cases: common password rejected (case/spacing variants), passphrase accepted, length boundary unchanged.

**Error code:** reuse `VALIDATION_FAILED` with `field: 'newPassword'` and a human message like "此密碼太常見，請改用其他密碼". Do **not** invent a new wire code (append-only policy; `VALIDATION_FAILED` is already mapped and the frontend already handles it). The stable `code` stays `VALIDATION_FAILED`; the UI keys behavior off `field === 'newPassword'` + a curated message via the existing `error-messages.ts` (add a message keyed by a new domain-internal marker if needed — but the wire code stays `VALIDATION_FAILED`). Decision: keep wire code `VALIDATION_FAILED`; the frontend shows the backend `message` for this field-scoped validation (field-scoped validation messages are safe to surface, unlike server-error messages).

### A2. Account+source dual login rate limit (R-F7-7)

**Approach:** in-process (single-instance) counter with TTL windows — **no Redis dependency** for MVP. The design doc explicitly leaves Redis/multi-instance consistency as a later architecture decision (line 323). A single-instance in-memory limiter is the minimal correct floor that satisfies R-F7-7's acceptance (dual scope, no permanent lockout, no existence leak, stable `RATE_LIMITED` + retry guidance). Document the multi-instance gap in CLAUDE.md-style notes.

**Files (new module `RateLimitModule`):**
- `src/modules/rate-limit/` — `rate-limit.module.ts` (@Global), `rate-limiter.service.ts`.
- `RateLimiterService`: sliding-window/fixed-window counter per key with TTL. Two scopes composed in `AuthService.login`:
  - account scope: key `login:account:<usernameNormalized>`, limit e.g. 10 failed / 5 min.
  - source scope: key `login:source:<ip>`, limit e.g. 20 failed / 5 min.
- On **failure** (credentials invalid / disabled / account missing): increment both counters, then throw `RateLimitedError` if either exceeded (check *after* increment, return `retryAfterSeconds`). On **success**: clear the account-scope counter (source-scope decays via TTL — avoids one source flushing another's limit).
- Critical anti-enumeration invariant: the rate-limit check runs **before** the dummy-hash timing path but the response stays the generic `AUTH_INVALID_CREDENTIALS` vs `RATE_LIMITED` — `RATE_LIMITED` must NOT reveal whether the account exists. If rate-limited, short-circuit with `RATE_LIMITED` and do **not** run the dummy hash timing (rate-limit signal is intentional); otherwise proceed to existing constant-ish path. Decision: when rate-limited, return `RATE_LIMITED` without revealing account presence — the `RATE_LIMITED` response is the same whether the account exists or not, so the enumeration leak is only the *timing* of when rate limit triggers; acceptable per design (account-scope limit triggers faster for a real account under stuffing, but the message is identical). Note this residual in the plan.

**New error:** add `RateLimitedError extends DomainError` in `domain-error.ts` using existing `RATE_LIMITED` code, HTTP 429, `retryAfterSeconds` set. `GlobalExceptionFilter` already maps `DomainError` generically; verify it passes `retryAfterSeconds` to the envelope (it does via `toEnvelope`). Add `RATE_LIMITED` → Chinese message to **frontend** `error-messages.ts`.

**Config:** env-driven limits via `env.validation.ts` (optional, with safe defaults so test/CI work without extra config): `LOGIN_RATE_LIMIT_ACCOUNT_MAX`, `LOGIN_RATE_LIMIT_ACCOUNT_WINDOW_MS`, `LOGIN_RATE_LIMIT_SOURCE_MAX`, `LOGIN_RATE_LIMIT_SOURCE_WINDOW_MS`. Defaults: account 10/300000, source 20/300000.

**Integration tests** (`test/auth-rate-limit.e2e-spec.ts`, DB-backed): (1) N wrong passwords from one source on one account → eventually `RATE_LIMITED` with `retryAfterSeconds`; (2) disabled/missing account failures also consume source budget (no existence leak); (3) after success, account counter clears; (4) limit is **not** permanent — counter decays (use a low window in a test override or inject a fake clock; see `src/common/clock/`). Use the existing `createTestApp` / `setupTestDb` harness. Inject the limiter window via a test-only override (e.g. env or a `ClockService`-based TTL with an injectable `now()`).

**Tests for A1:** unit `password-policy.spec.ts` additions.

### A3. Verification (backend)

Per CLAUDE.md DoD bundle, in `smartLearning-backend/`:
```bash
npm run typecheck && npm run lint:check && npm run format:check && npm run build
npm test                                   # unit incl. password-policy.spec
npm run test:e2e -- test/auth-rate-limit.e2e-spec.ts   # needs migrated smartlearning_test
npm run test:e2e -- test/auth-courses.e2e-spec.ts     # regression: existing login still works
npm run prisma:migrate:status
git diff --check
```
Run verbose suites via a subagent; return a structured report.

---

## Part B — Frontend (F7)

### B1. API client + types

**`lib/api/types.ts`** — `SessionDto` already exists; add `ChangePasswordPayload { currentPassword, newPassword }`, `StepUpPayload { password }`, `StepUpResponse { expiresAt }`.

**`lib/api/auth.ts`** — add:
- `useChangePassword()` → `POST /auth/change-password` (mutate:true, Session+CSRF). On success the backend rotates the session cookie + returns a new `SessionDto`; seed the session query cache with the returned session (like `useLogin` does) so `mustChangePassword` flips to false immediately without a refetch.
- `useStepUp()` → `POST /auth/step-up` (mutate:true). Returns `{ expiresAt }`.
- Add `AUTH_PASSWORD_CHANGE_REQUIRED`, `AUTH_STEP_UP_REQUIRED`, `RATE_LIMITED`, `VALIDATION_FAILED` messages to `error-messages.ts` (some already present — check before adding).

**`lib/api/query-keys.ts`** — no new keys needed (session key reused).

### B2. Reusable `StepUpDialog` component

**`components/auth/StepUpDialog.tsx`** — modal dialog collecting the current password, calling `useStepUp`. Reusable for future high-risk screens (CLI key create/revoke — US-F8/F16). Props: `open`, `onOpenChange`, `onSuccess` (callback after step-up confirmed), `trigger` label. Uses `Field`/`inputClass`/`ErrorAlert`. Step-up is **only needed for admin high-risk ops** per SPEC; password change itself uses the embedded current-password field, NOT step-up. Keep `StepUpDialog` available but the F7 change-password form uses its own current-password field directly (backend `change-password` verifies currentPassword inline — it is NOT behind `StepUpGuard`, only `SessionGuard + CsrfGuard`). Verify against `auth.controller.ts`: `changePassword` uses `AllowPasswordChangeRequired` + `SessionGuard + CsrfGuard` (no `StepUpGuard`). So `StepUpDialog` is built but **not** wired into the F7 change-password flow; it's scaffolding for F8/F16 and listed in the plan as delivered-but-unused-now to avoid scope creep. Decision: **defer `StepUpDialog` to F8** where step-up is actually required, to avoid shipping unused code. Document this.

### B3. Change-password page + force-change flow

**`app/(protected)/settings/password/page.tsx`** — new route group `(protected)` for authenticated-only, role-neutral settings (both admin/student/teacher can change their own password). Server-component shell with metadata; renders client `ChangePasswordForm`.

**`app/(protected)/layout.tsx`** — protected shell: requires an authenticated session (any role) via `useSession()`; while loading show placeholder; if not authenticated → redirect to `/login?next=/settings/password`. Crucially: **must NOT redirect `mustChangePassword` users away** — this page is the destination they are forced to. So the `mustChangePassword` gate that lives in `(admin)`/`(student)` layouts must not apply here. The `(protected)` layout allows `mustChangePassword=true` to reach the form (it is the one page they may use). After successful change, `mustChangePassword` flips to false and the user proceeds.

**`features/auth/ChangePasswordForm.tsx`** — client form with `react-hook-form` + zod:
- Fields: `currentPassword` (autoComplete="current-password"), `newPassword` (autoComplete="new-password", hint "12–128 字元，允許 passphrase，不須特定組合"), `confirmPassword` (must equal newPassword).
- zod schema: newPassword 12–128 (mirror backend `PASSWORD_MIN/MAX`), confirmPassword refinement.
- Submit → `useChangePassword`. On success: show success state, seed session cache (hook does this), and if `mustChangePassword` was true, redirect to the role-based home (`admin`→`/admin`, `student`→`/student`, else `/`). If a normal voluntary change, show "密碼已變更" and stay.
- Errors via `ErrorAlert`: `AUTH_INVALID_CREDENTIALS` (wrong current password), `VALIDATION_FAILED` field `newPassword` (too short / common password — show backend message for this field-scoped case), `RATE_LIMITED` (too many attempts).
- Reuse `Field`, `inputClass`, `ErrorAlert`, button styles from `LoginForm`/`AccountCreateForm`.

### B4. Wire the `mustChangePassword` gate

The existing redirects in `(admin)/layout.tsx`, `(student)/layout.tsx`, and `LoginForm` already target `/settings/password`. Once B3 lands, those redirects stop 404ing. No change needed there beyond verifying the redirect still makes sense. Add a link to "變更密碼" in the admin/student headers (next to `LogoutButton`) so a voluntary change is reachable. Extract a small `HeaderUserMenu` or just add a `<Link href="/settings/password">` in each header — keep minimal.

### B5. Verification (frontend)

In `smartLearning-ui/`:
```bash
npm run typecheck   # run `npx next typegen` first for LayoutProps/PageProps
npm run lint:check
npm run build
```
Manual e2e against running backend (start backend on :3000, UI on :3001):
1. Admin creates a teacher with temp password (mustChangePassword=true) → teacher logs in → forced to `/settings/password` → set 20-char passphrase → lands on home.
2. Teacher voluntarily changes password: wrong current → `AUTH_INVALID_CREDENTIALS`; too-short new → length error; common new (e.g. "password123456" if in blocklist) → rejected; correct change → success, old password no longer works (session rotated), new password works.
3. Rate limit: 10+ wrong logins from same source → `RATE_LIMITED` with retry hint; wait → works again (no permanent lock).

---

## Files to modify/create

**Backend (`smartLearning-backend/`):**
- Edit `src/modules/identity/domain/password-policy.ts` (+ spec) — add `rejectCommonPassword`.
- New `src/modules/identity/domain/common-passwords.ts` — static blocklist.
- Edit `src/modules/identity/application/auth.service.ts` — wire common-password check into `changePassword`; wire `RateLimiterService` into `login` (both scopes, before dummy-hash path, on failure increment, on success clear account scope).
- Edit `src/modules/identity/application/account.service.ts` — apply common-password check to `createAccount`/`resetPassword` temp passwords.
- New `src/modules/rate-limit/rate-limit.module.ts` + `rate-limiter.service.ts` — in-memory TTL window counter, injectable clock.
- Edit `src/config/env.validation.ts` — optional rate-limit config with defaults.
- Edit `src/common/errors/domain-error.ts` — add `RateLimitedError` (reuses `RATE_LIMITED` code).
- Edit `src/app.module.ts` — import `RateLimitModule`.
- New `test/auth-rate-limit.e2e-spec.ts` — integration tests for A2.
- Edit `src/modules/identity/domain/password-policy.spec.ts` — A1 unit cases.
- Update `CLAUDE.md` backend notes: record common-password static list + in-memory rate limit as MVP floors; Redis/multi-instance + real breach list deferred.

**Frontend (`smartLearning-ui/`):**
- Edit `lib/api/types.ts` — `ChangePasswordPayload`, `StepUpPayload`, `StepUpResponse` (StepUp types optional since dialog deferred).
- Edit `lib/api/auth.ts` — `useChangePassword` (+ optionally `useStepUp` deferred).
- Edit `lib/api/error-messages.ts` — `RATE_LIMITED` message (check existing first).
- New `app/(protected)/layout.tsx` — protected shell (auth required, `mustChangePassword` allowed through).
- New `app/(protected)/settings/password/page.tsx` — server shell.
- New `features/auth/ChangePasswordForm.tsx` — client form.
- Edit `(admin)/layout.tsx` + `(student)/layout.tsx` — add "變更密碼" link in header.

**Deferred (out of scope, documented):**
- `StepUpDialog` — build when F8 (CLI key create/revoke, account disable) needs it; step-up is NOT required for self change-password.
- Redis-backed multi-instance rate limit + DB fallback.
- Real breached-password source (HIBP k-anonymity / downloaded list).

## Rollback

- Backend: `RateLimitModule` and common-password check are additive behind existing endpoints; revert the `auth.service.ts`/`account.service.ts` wiring + remove the new module to disable. No schema migration, so no data rollback needed.
- Frontend: `/settings/password` route is purely additive; remove the `(protected)` group and header links. The existing `mustChangePassword` redirects revert to 404 (pre-existing gap, not a regression).

## Verification summary

- Backend: unit (password-policy) + integration (rate-limit e2e) + regression (auth-courses e2e) + typecheck/lint/build/migrate:status.
- Frontend: typegen + typecheck + lint + build + manual browser flow against running backend covering force-change, voluntary change, error paths, and rate limit.