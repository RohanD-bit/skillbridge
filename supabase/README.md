# Assessment Edge Functions

These functions are **implemented locally, not deployed by writing these files**. No migrations, schema changes, permissions changes, or RLS changes are included.

## Security boundary

- `assessment-questions` accepts an authenticated POST and returns exactly 10 active questions with only `id`, `topic`, `question_text`, A/B/C/D `options`, and `difficulty`. Its database SELECT does not request the answer-key column. Its response also uses explicit field allowlists.
- `submit-assessment` accepts `{ "answers": [{ "question_id": "UUID", "answer": "A" }] }` with exactly 10 entries. It rejects extra top-level/nested fields, duplicate IDs (including different UUID casing), invalid choices, and any ID outside the current active inventory. Missing/inactive/unknown questions cannot be scored as a partial attempt.
- Both functions require a bearer token and call Supabase Auth `getUser(token)` to verify it. Student identity comes exclusively from that verified user. Gateway JWT verification remains enabled in `config.toml` as an additional check.
- Only the server adapter uses the server's default secret key (or legacy service-role key) to read the protected question bank and insert computed attempts. It never attaches the caller's bearer token to the privileged database client's global headers. The elevated database access is confined to these two operations after authentication; no user permissions or RLS policies are changed.
- The submission response contains only saved attempt ID, timestamp, total/correct counts, and topic counts. It never includes per-question correctness or answer keys. Errors are sanitized; tokens and credentials are never logged.
- CORS allows browser POST/OPTIONS requests with `authorization`, `apikey`, `content-type`, and `x-client-info` headers. OPTIONS is preflight only and performs no authentication/database work. CORS is not the authorization mechanism: every data request requires verified Auth.
- Responses use `Cache-Control: no-store`. Submission bodies are limited to 16 KiB, including streamed bodies without a trusted Content-Length.

## Deployment to the existing project

Supabase CLI and Deno were not available in the implementation shell. No software was installed and no deployment/login was attempted. Install the [official Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) using a supported Windows method before these steps. Deno is optional for the extra native runtime check below.

From **PowerShell**, in the repository root:

```powershell
Set-Location C:\AppDev\Projects\skillbridge
supabase --version
supabase login
```

Complete the CLI's sign-in flow yourself. Never paste a management access token, database password, or service-role key into chat, source files, shell history, or Vite variables. Use the existing SkillBridge project reference shown in its dashboard:

```powershell
$skillBridgeProjectRef = 'YOUR_EXISTING_PROJECT_REF'
supabase functions deploy assessment-questions --project-ref $skillBridgeProjectRef --use-api
supabase functions deploy submit-assessment --project-ref $skillBridgeProjectRef --use-api
supabase functions list --project-ref $skillBridgeProjectRef
```

Replace only the public project-reference placeholder. `--use-api` uses server-side bundling rather than requiring a local Docker daemon. The checked-in function configuration points at the pinned SDK import map and keeps `verify_jwt = true`. Do not add `--no-verify-jwt` or change database permissions to work around an auth error. These commands deploy only the two functions; no database link/reset/push or migration command is needed.

The hosted Edge Runtime must provide `SUPABASE_URL` and either the default entry of `SUPABASE_SECRET_KEYS` (a server-only JSON key map) or `SUPABASE_SERVICE_ROLE_KEY`. Supabase normally injects these project credentials into hosted functions. Verify their availability in the dashboard's function environment if the service reports missing configuration. If your environment requires manually supplying a server key, use the dashboard's protected function-secret settings; never put it in `.env.local`, `VITE_*`, or a committed file. Root `.env.local` configures Vite, not deployed functions.

The frontend continues using only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, pointing at the same project. Its existing SDK attaches the current session's access token to function invocations. No new frontend environment variables are needed.

Confirm both deployments succeed in the CLI/dashboard. A source file, successful local test, or successful frontend build does **not** establish that a function exists in the live project.

## Local checks

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

The TypeScript project includes the Edge handlers and adapters. `_shared/runtime.ts` describes the narrow Deno API used by the entry points so host `tsc` can check them. The test runner uses Node for handler/adapter tests and jsdom for browser tests. They mock Auth/database/function calls and are **not live Supabase or Deno Edge Runtime integration tests**.

If Deno is installed, also run:

```powershell
deno check --config supabase/functions/deno.json supabase/functions/assessment-questions/index.ts supabase/functions/submit-assessment/index.ts
```

Native Deno checking, hosted deployment, CORS behavior through the hosted gateway, and live database permissions still need verification in the real environment. Do not run destructive local/remote database commands as part of testing these functions.

## Real authenticated-account verification

Use dedicated test accounts and the existing ten-question inventory, without changing table permissions or policies:

1. Start Vite with `pnpm dev`, sign in normally, and open `/assessment`. With no previous attempt, the start button appears. An existing attempt should appear as saved results with a retake button.
2. Start the assessment. In browser Network tools, confirm `assessment-questions` succeeds with the signed-in session. Inspect its **response only**: ten unique active question IDs, A/B/C/D choices, and no answer-key field. Do not copy authorization headers or tokens into reports.
3. Select answers on several questions. Move backward/forward and use the numbered navigation buttons. Verify only one question is displayed and choices persist. Submit with unanswered questions and verify the first missing question opens without a submission request.
4. Complete all ten choices and submit once. Verify a single `submit-assessment` request containing only question IDs and selected answers. Controls must remain disabled while pending. The response must include a saved attempt ID and overall/topic counts, with no answer keys.
5. Verify the saved results and diagnostic disclaimer. Refresh the page: the latest own attempt must be fetched from `assessment_attempts`, filtered by the authenticated ID, and displayed again. Check topic totals (budgeting 3, saving 2, credit 3, investing 2 for the existing inventory). A trusted administrator can independently compare scores using protected access; do not expose the question keys to a student/browser.
6. Take another legitimate attempt and verify a new saved ID/latest result. The MVP permits legitimate retakes; it is not a server-wide idempotent submission service.
7. Simulate offline/function failures. Verify clear errors, retry, and answer preservation. After an ambiguous submit failure, use **Check saved results** first. The server may have committed even if the response was lost; a manual retry may create another legitimate attempt. There is no automatic submit retry.
8. Sign out and confirm assessment access returns to login. Sign in as a second test account and confirm the first account's results are not visible. Independently verify existing RLS denies another student's attempt SELECT and direct browser INSERT/UPDATE.
9. With an authorized test setup, test missing/expired bearer tokens, unknown/inactive IDs, duplicates, fewer/more than ten answers, invalid options, client-supplied scores/student IDs, and an intentionally failed database write. Requests must fail without inserting an attempt or exposing internals. Never disable auth/RLS or change production permissions to simulate a failure; use mocks or a separate authorized test environment when necessary.

Only a successful run against deployed functions and the existing project is a live integration result. The implementation did not create real accounts, read real answer keys, or write live assessment attempts during automated verification.

## MVP limits

- In-progress choices are kept in page state and reset on refresh; completed results persist in the database.
- If the active bank changes before submission, the server rejects the old set. Reload/start again with the current set; no question-version table is introduced.
- Intentional retakes are allowed. Accidental duplicate submissions are blocked within the frontend interaction, but separate devices/tabs or a manual retry after a lost response can create separate attempts.
- Recommendations remain a placeholder; this task adds only the continue link, not ranking logic or resource search.

## Created or modified files

- `.gitignore`
- `README.md`
- `src/assessment/AssessmentQuiz.tsx`
- `src/assessment/AssessmentResults.tsx`
- `src/assessment/assessment-api.test.ts`
- `src/assessment/assessment-api.ts`
- `src/assessment/test-fixtures.ts`
- `src/assessment/types.ts`
- `src/auth/auth.test.tsx`
- `src/pages/AssessmentPage.test.tsx`
- `src/pages/AssessmentPage.tsx`
- `src/pages/OnboardingPage.test.tsx`
- `src/test/setup.ts`
- `supabase/README.md`
- `supabase/config.toml`
- `supabase/functions/_shared/assessment.test.ts`
- `supabase/functions/_shared/assessment.ts`
- `supabase/functions/_shared/handlers.ts`
- `supabase/functions/_shared/runtime.ts`
- `supabase/functions/_shared/supabase.test.ts`
- `supabase/functions/_shared/supabase.ts`
- `supabase/functions/assessment-questions/index.ts`
- `supabase/functions/deno.json`
- `supabase/functions/submit-assessment/index.ts`
- `tsconfig.edge.json`
- `tsconfig.json`

References: [Auth verification](https://supabase.com/docs/guides/functions/auth-legacy-jwt), [function environment](https://supabase.com/docs/guides/functions/secrets), [deployment](https://supabase.com/docs/guides/functions/deploy).
