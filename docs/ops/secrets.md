# Secrets and credentials

Where every secret lives, by name. No secret value appears in this file, in `.env.example`, or anywhere else in the repository; `gitleaks` runs in CI (architecture section 13) and `.env.local` is gitignored.

## Rules

- Three homes, nothing else: `.env.local` (gitignored) on a developer machine; GitHub Actions secrets and variables for CI; AWS Secrets Manager for staging and production (architecture section 13: "secrets only in AWS Secrets Manager", rotation within 90 days with a tested runbook; services read them through their IAM task role).
- No station agent (plan, build, test, review, ship) ever needs a production credential. Cards run against docker compose (Postgres, MinIO, mailpit) with the compose defaults, and the tester uses record/replay fixtures for the Anthropic API by default (`pnpm test` is green offline). The only live Anthropic call in the roadmap is the P5-03 measurement run, a `manualGates:` item the user runs with `ANTHROPIC_API_KEY` in `.env.local` and commits the report under `docs/verification/`; the weekly capped live run on staging uses the staging key from Secrets Manager.
- Agents never log secrets (monitor protocol rule 4), never print or commit `.env.local`, and never copy a value from one home to another. A card that needs a new secret adds its name to this file and to `.env.example` (empty value) in the same commit; the user fills the value (E4 of `docs/plan/roadmap.md` lists what only the user can obtain).
- CI assumes an IAM role through GitHub's OIDC provider; there are no long-lived AWS access keys anywhere.
- `.env.local` and `.env.*.local` are ignored: present in `.gitignore` since `89bed6d` (PLAN-04 follow-ups).

## Names

| Name | Purpose | `.env.local` (local) | GitHub Actions | Secrets Manager (staging, production) | Obtained at (E4) |
|---|---|---|---|---|---|
| `DATABASE_URL` | Postgres connection string | compose default (not a secret) | ephemeral service container | yes, one per environment (RDS) | P0-02 / P0-05 |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | object storage (MinIO locally) | compose defaults (not secrets) | MinIO service container | no: tasks use the IAM task role | P0-02 |
| `AUTH_SECRET` | session and cookie signing key | random local value | random per run | yes | P4-01 |
| `GOOGLE_OIDC_CLIENT_ID`, `GOOGLE_OIDC_CLIENT_SECRET` | Google sign-in (R12) | yes, from a dev app registration | no | yes | P4-01: Google Cloud OIDC app registration |
| `MICROSOFT_OIDC_CLIENT_ID`, `MICROSOFT_OIDC_CLIENT_SECRET`, `MICROSOFT_OIDC_TENANT_ID` | Microsoft sign-in (R12) | yes, from a dev app registration | no | yes | P4-01: Microsoft Entra app registration |
| `ANTHROPIC_API_KEY` | judge and screen calls (judge entrypoint only) | only for the P5-03 measurement run; tests use record/replay fixtures | no | yes, judge service only; staging key capped per week | P5-03 manual gate: Anthropic key, organization spend cap, rate-limit tier request |
| `AWS_OIDC_ROLE_ARN` | role GitHub Actions assumes for `tofu plan`/`apply`, image push and deploys | no | yes (repository variable) | n/a | P0-05.2: AWS account, OIDC role for Actions |
| `TOFU_STATE_BUCKET`, `TOFU_LOCK_TABLE` | OpenTofu state backend | no | yes (repository variables) | n/a | P0-05.2: state bucket and lock table |
| `GRAFANA_CLOUD_OTLP_ENDPOINT`, `GRAFANA_CLOUD_API_TOKEN` | OTel collector export (metrics, logs, traces, OnCall) | no | no | yes, collector service | P7-02: Grafana Cloud account |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | error reporting; source-map upload at build | DSN optional | auth token (source-map upload) | DSN yes | P7-02: Sentry account |
| `STATUS_PAGE_API_TOKEN` | status-page updates from the system entrypoint (no learner data) | no | no | yes | P7-02: status-page account |
| `KMS_KEY_ID_DATA`, `KMS_KEY_ID_BACKUPS`, `KMS_KEY_ID_LLM_LOGS`, `KMS_KEY_ID_TENANT` | key ids (configuration, not secrets; access is by task role) | no (local uses plaintext dev keys) | no | key ARNs as configuration | P0-05 |
| `SES_*` | outbound email | mailpit (no secret) | no | none: SES through the task role | P0-05.2: SES production access |

Non-secrets committed in `.env.example`: `BRIDLE_ENV`, `NEXT_PUBLIC_*`, artifact and pack digests, feature flags, the compose defaults above.
