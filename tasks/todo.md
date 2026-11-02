# 2026-11-02 Apply Requirement Decisions

- [x] Record user decisions: R1=B (Email login); R2=A (teacher invitation, separate admin bootstrap).
- [x] Align planning document and M01/M03 identity and activation policies.
- [x] Align initial-account guide while leaving bootstrap mechanism details unresolved.
- [x] Update decision tracker to record resolved R1/R2.
- [x] Verify cross-file consistency and whitespace (`rg`, `git diff --check`).

## Results
- Updated the planning document, M01, M03, the first-admin bootstrap guide, and this decision tracker to apply R1=B and R2=A; subsequently recorded R3=A, R4=D (no failed-login restriction), R5=A (revoke all sessions after password change), and R6=A (60-second per-account send limit with safe retry on delivery failure), and M06-1=A (6-digit numeric Game PIN, platform-wide unique among joinable activities), and M06-2=A (follow platform data-retention/privacy policy), M06-3=A (use platform-wide contracts), and M07-1=A (lease expiry auto-releases; re-authenticated host can reacquire), and M07-2=A (use M08 heartbeat contract/platform NFR), M07-3=A (publish answer distributions only to learners), M08-1=A (cross-device Participant recovery, credential specifics by security contract), M08-2=A (use platform input policy), M08-3=A (result via M07/M09; real-time service via platform contract), M09-1=A (overall accuracy is the unweighted mean of applicable question accuracies), M09-2=A (overall completion is the unweighted mean of applicable per-question completion rates), and M09-3=A (incomplete required statistics/team results report “處理中”; status and idempotent retry mechanics follow platform/M11 contract).
- `git diff --check` passed after each update; targeted searches confirmed the revised identity, activation, failed-login, and session policies.
- Subsequently recorded M09-4=A: deduplicate by Participant, question, and submission identifier; server version determines ordering and the last successful submission is effective. Synced the decision to M08 D19 and clarified in M09 that version mechanics/retry responses remain engineering-contract details.
- Recorded M10-1=A: platform policy defines approved parameter values, types, defaults, and ranges; M10 provides the settings entry point. Synced to M10 D05 and clarified that remaining M10 open items are M10-2 and M10-3.
- Recorded M10-2=A: use platform NFR; stale or unavailable connection status displays “未知.” Synced to M10 D06; specific freshness/refresh thresholds remain platform-NFR implementation details.
- Recorded M10-3=A: batch updates are all-or-nothing; version conflicts are rejected and require rereading. Synced to M10 section 4/D07; version and conflict-response mechanics remain API/data-consistency contract details.
- Recorded M11-1=B: target load is 10 simultaneous activities and 500 concurrent requests. Synced to the tracker and M11 capacity/NFR sections; the target does not change the existing per-activity limits and P95 thresholds.
- Recorded M11-2=A: organization eligibility is based on the platform organization master and administrator authorization. Synced the P1 decision to M11 validation/data rules and M09’s organization-ranking pending note; detailed validation mechanics remain for the M11 P1 contract.
- Recorded B1=A: bootstrap may run only during deployment/operations via CLI or deployment job, and its entry point must be disabled after successful first-admin creation. Synced to the tracker and first-admin guide; exact command identity, executor, and disable mechanics remain deployment-contract details.
- Recorded B2=A: create the first admin account and assign `SYSTEM_ADMIN` in one database transaction; any failure rolls back all changes. Synced to the tracker and first-admin guide; implementation must keep the operations within the same transaction boundary.
- Recorded B3=A: manage default role permissions with version-controlled migration/seed and idempotent reruns. Synced to the tracker, first-admin guide, and M04 decision D09; M04 owns the permission catalog/default matrix, while concrete seed contents and deployment validation are implementation details.
- Changes committed only after the user explicitly invoked `/git-commit`.

## Acceptance criteria
- Email is the sole login identifier consistently across planning, M01 and M03; teacher account-name is not treated as a login field.
- Teacher invitation remains distinct from password reset and initial system-admin bootstrap.
- Unresolved bootstrap mechanism and platform policies remain open, not invented.

## Working notes
- Teacher invitations: one-time Email link, 7 days; resending invalidates prior link.
- Password reset: one-time Email link, 30 minutes.
- Preserve unrelated existing changes; commit only when explicitly requested.
