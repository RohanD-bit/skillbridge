# SkillBridge: the complete app guide

Repository review date: October 29, 2026.

This guide brings together the product, student experience, recommendation rules, technical structure, setup, operations, and known limitations. It describes the code in this checkout. Hosted deployment, live database policies, email delivery, and the current production catalog were not verified for this document. No credentials or student records are included.

## Contents

1. [What the app does](#what-the-app-does)
2. [Student journey and pages](#student-journey-and-pages)
3. [Feature behavior](#feature-behavior)
4. [How recommendations work](#how-recommendations-work)
5. [Architecture and stack](#architecture-and-stack)
6. [Data and permissions](#data-and-permissions)
7. [Local setup](#local-setup)
8. [Deployment and maintenance](#deployment-and-maintenance)
9. [Testing and troubleshooting](#testing-and-troubleshooting)
10. [Demo, limitations, and next steps](#demo-limitations-and-next-steps)
11. [Where to find things](#where-to-find-things)

## What the app does

**SkillBridge helps high school students ages 14–18 find financial literacy learning resources based on their interests, experience, learning goals, and a short knowledge check.**

It covers four topics:

| Topic     | Learning focus                                   |
| --------- | ------------------------------------------------ |
| Budgeting | Planning spending, income, and expenses          |
| Saving    | Savings habits, goals, and emergency funds       |
| Credit    | Borrowing, debt, and credit scores               |
| Investing | Basic investing and how money can grow over time |

The main value is giving a student a useful starting point and explaining why particular resources were suggested. Students can also browse the library independently.

This is a financial education MVP. The implemented personalization is a transparent, weighted rules engine. It does not use a language model, train a machine-learning model, predict financial outcomes, connect bank accounts, or execute financial transactions.

The existing README connects the project to Neighborhood Hacks 2026 and records an October 23, 2026 submission deadline. That is historical project context, not a deadline checked against the event organizer.

## Student journey and pages

Typical first visit:

**Create account / log in → Your starting point → Knowledge check → Saved results → For you → Explore resources**

| URL                | Screen or behavior                                                                | Access                                    |
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------- |
| `/`                | Resumes onboarding if preferences are incomplete; otherwise opens Knowledge check | Signed-in student with loaded profile     |
| `/register`        | Email/password registration                                                       | Public; signed-in students are redirected |
| `/login`           | Email/password login                                                              | Public; signed-in students are redirected |
| `/onboarding`      | **Your starting point**: create or edit preferences                               | Protected                                 |
| `/assessment`      | **Knowledge check**: quiz, latest saved result, or retake                         | Protected                                 |
| `/recommendations` | **For you**: up to five explained recommendations                                 | Protected                                 |
| `/resources`       | **Explore resources**: public introduction, then signed-in catalog                | Landing is public; catalog requires login |
| Any other path     | Not-found page with a return link                                                 | Public                                    |

Returning students do not have to redo completed onboarding. Knowledge check restores their latest completed result, if one exists. Login preserves supported local return destinations, so a student signing in from the library can return there directly.

Incomplete preferences trigger helpful reminders on assessment and recommendations; the normal home route guides the student to complete them. A failed profile load offers recovery instead of granting protected access.

## Feature behavior

### Accounts and sessions

- Email/password login and registration use Supabase Auth.
- Registration requires a password of at least eight characters in the form; the backend may enforce additional rules.
- Email confirmation behavior depends on the project's Supabase settings. Registration requests a confirmation redirect to the current site's `/onboarding` route.
- The SDK persists sessions, refreshes tokens, and detects sessions returned through confirmation links.
- After login, the app reads the student's own profile. If missing, it attempts to create a default profile with the authenticated ID and empty interests.
- Existing profiles are preserved during authentication. Profile failures have retry controls.
- Logout uses the SDK's local scope to end the current browser's session.
- Invalid credentials, expired confirmation links, unconfirmed email, rate limits, network problems, and missing configuration have user-facing error states.

There is no implemented guest learning session, password-reset page, social login, teacher dashboard, or administrator interface in the current route set.

### Preferences

Students choose at least one of the four interests, enter a nonblank learning goal of at most 300 characters, and choose beginner, intermediate, or advanced experience. The form defaults new students to beginner.

Saving trims the goal and deduplicates interests. The app waits for database confirmation before continuing to the assessment. A failed save retains the draft; a failed load does not open an empty editable form that could overwrite saved values.

Only `interests`, `learning_goal`, and `experience_level` are updated. Profile ID scopes the update; timestamps are left to database defaults or triggers. A missing row can be inserted, and a concurrent duplicate insert is handled by retrying the scoped update.

### Knowledge check and results

- The quiz requires exactly **10 active questions**, each with A/B/C/D choices.
- Students see one question at a time and can move backward, forward, or jump by question number.
- Choices remain selected while navigating within the quiz.
- Every question must be answered before submission. The UI directs the student to an unanswered question when needed.
- The browser sends only question IDs and selected choices. The server validates and scores the submission.
- Submission controls are disabled while a request is pending.
- Saved results show the correct count, overall percentage, completion time, and performance by topic.
- Results are a short diagnostic starting point, not a comprehensive measurement of financial knowledge.
- Retakes create new attempts. The latest completed attempt is selected by completion time descending, then ID descending; incomplete attempts are excluded.
- No per-question answer key or correctness breakdown is returned by the scoring service.

The documented existing question inventory has budgeting 3, saving 2, credit 3, and investing 2 questions. Those topic counts describe the expected hosted inventory; the server validates the total and valid topics rather than hard-coding that distribution.

**Persistence distinction:** completed results are saved in Supabase. Unsubmitted answers and unsaved preference drafts live in the current page and can be lost on refresh or navigation.

If submission fails ambiguously, choose **Check saved results** before submitting again. A server write may have succeeded even when its response was lost. There is no automatic submission retry or server-wide idempotency mechanism.

### Resource library

The catalog reads active rows from `learning_resources` after login. It displays title, description, provider, topic, difficulty, resource type, and a resource link.

- Search matches literal text in titles or descriptions without regard to capitalization.
- Topic, difficulty, and type filters combine with search.
- Types are lesson, workshop, video, and article.
- **Clear Filters** resets search and all three filters.
- Filtering happens locally after the catalog loads, without additional database reads.
- The loader requests resources sorted by title and then ID.
- Loading, retry, empty-library, no-match, and result-count states are included.
- Only absolute HTTPS links without embedded credentials are clickable. They open in a new tab with safe link attributes and an announcement.
- Invalid links remain visible as non-clickable cards in the library; recommendations omit those resources.

Existing docs mention ten active resources, but the code does not enforce ten. Actual results depend on the hosted table. There is no pagination; the query inherits the project's configured Data API response limit.

## How recommendations work

The engine ranks active resources using saved preferences and the latest completed assessment. It runs in the frontend as pure TypeScript and returns at most five usable resources.

```text
score = 0.45 × knowledge gap relevance
      + 0.35 × difficulty compatibility
      + 0.20 × interest / learning-goal alignment
```

Each component is between 0 and 1. The interface shows the final score on a 0–100 scale rounded to one decimal place. **It is a relative ranking score, not a success probability.**

### Knowledge gap: 45%

For the resource's topic:

```text
knowledge gap = 1 - (correct answers / total topic questions)
```

A lower topic score gives resources on that topic a larger contribution. Missing, malformed, or zero-total evidence uses a neutral `0.5`. The app does not label missing evidence as poor knowledge or redistribute that component's weight.

### Difficulty: 35%

| Student experience | Beginner resource | Intermediate resource | Advanced resource |
| ------------------ | ----------------: | --------------------: | ----------------: |
| Beginner           |              1.00 |                  0.35 |              0.00 |
| Intermediate       |              0.80 |                  1.00 |              0.45 |
| Advanced           |              0.50 |                  0.85 |              1.00 |

Missing or invalid experience uses beginner compatibility with an explanation. Difficulty is a preference, not a hard prerequisite: an advanced resource can still appear for a beginner if other signals or the limited catalog make it rank highly.

### Interests and learning goal: 20%

```text
alignment = (interest match + goal match) / 2
```

Each match is either 0 or 1, so interests and goal keywords each contribute at most ten points to the displayed final score.

An interest matches the resource's topic exactly. Goal matching uses the first 300 characters, Unicode normalization, lowercasing, English alphabetic words, removal of short/generic words, and whole-word matching against the resource title, description, and explicit topic vocabulary. Examples include `emergency` for saving and `debt` for credit.

Repeated keywords do not earn extra points. This logic has no semantic understanding, stemming, or negation detection. Non-English goals may match poorly.

### Ordering, explanations, and defaults

Resources are sorted by full-precision score descending, lowercase title, then ID. Stable inputs produce stable ordering. Each card explains the topic evidence, difficulty fit, selected-interest match, and actual goal keyword matches.

The loader verifies the current user, then reads their profile, their latest completed topic scores, and active resources. Re-entering For you reloads the inputs. Read failures show errors; genuinely missing evidence uses disclosed defaults. A smaller usable catalog produces fewer than five recommendations.

Example: a beginner interested in saving, with a saving goal keyword and 1/2 saving answers correct, receives `0.45 × 0.5 + 0.35 × 1 + 0.20 × 1 = 0.775`, displayed as **77.5**, for a beginner saving resource matching those inputs. This is an illustrative calculation, not a real student result.

## Architecture and stack

| Layer                          | Implementation                                                  |
| ------------------------------ | --------------------------------------------------------------- |
| Frontend                       | React 19 and TypeScript 5                                       |
| Routing                        | React Router 7 with browser routes                              |
| Development/build              | Vite 6                                                          |
| Styling                        | Tailwind CSS 4 through its Vite plugin and CSS theme            |
| Authentication/data            | Supabase JavaScript SDK, Supabase Auth, hosted database API     |
| Secure assessment backend      | Two Supabase Edge Functions using the Deno runtime              |
| Tests                          | Vitest, Testing Library, jsdom, mocked SDK/backend dependencies |
| Code checks                    | TypeScript, ESLint, Prettier                                    |
| Package management             | pnpm 11.25.0, with committed lockfile                           |
| Frontend hosting configuration | Vercel SPA rewrite configuration                                |

```text
Student browser
  ├─ React pages and session provider
  ├─ Supabase Auth → account/session verification
  ├─ Public Supabase client + student session
  │    ├─ own profile reads/writes
  │    ├─ own completed-attempt reads
  │    └─ active resource reads
  ├─ Local recommendation ranking
  └─ Authenticated Edge Function calls
       ├─ assessment-questions → public question fields
       └─ submit-assessment → server scoring → saved attempt
```

There is no separate Express server in this repository. The sensitive backend work is in the Edge Functions.

The interface uses forest green, mint/sage accents, a light canvas, white cards, and system fonts. It includes responsive navigation, visible keyboard focus, a skip link, labeled controls, route focus management, and result-heading focus. These features do not establish formal accessibility certification.

## Data and permissions

The following is the **schema contract inferred from code**, not a complete database definition. This repository does not include migrations that provision the existing tables, grants, defaults, triggers, or RLS policies.

| Data source            | Fields used by this app                                                                              | Intended access                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Supabase Auth          | User ID and session identity                                                                         | Managed by Supabase Auth                                     |
| `student_profiles`     | `id`, `interests`, `learning_goal`, `experience_level`, `created_at`, `updated_at`                   | Students read/create/update their own profile                |
| `learning_resources`   | `id`, `title`, `description`, `provider`, `topic`, `difficulty`, `resource_type`, `url`, `is_active` | Signed-in students read active resources                     |
| `assessment_questions` | `id`, `topic`, `question_text`, `options`, `difficulty`, `correct_answer`, `is_active`, `created_at` | Server reads; answer keys stay server-side                   |
| `assessment_attempts`  | `id`, `student_id`, `total_questions`, `correct_answers`, `topic_scores`, `completed_at`             | Students read own results; scoring function inserts attempts |

`topic_scores` contains `{ correct, total }` counts for each of the four topic keys. The scoring code inserts calculated counts and relies on the database to supply the attempt ID and completion time. Profile creation and updates likewise rely on existing database defaults/triggers for timestamps.

### Security boundaries

- Row Level Security (RLS) and database grants enforce data access. Frontend route guards are navigation controls, not database authorization.
- Browser configuration contains only a public URL and publishable key. All `VITE_*` values can appear in the built frontend.
- Database passwords, secret/service-role keys, management tokens, and answer keys must stay outside frontend files and Vite variables.
- Edge Functions verify bearer tokens through Supabase Auth. Student IDs and scores are derived on the server rather than trusted from submitted fields.
- The privileged database client remains in server files; the caller's bearer token is not attached to its database requests.
- The public question query excludes `correct_answer`; response fields are also allowlisted.
- Submission validation rejects extra fields, duplicate IDs, invalid choices, wrong question counts, and IDs outside the current active inventory.
- Function responses use `Cache-Control: no-store`; submission bodies are limited to 16 KiB.
- Signing out/account changes clear private interface state. Pending page requests are cancelled or ignored to prevent stale responses appearing under another account.
- The repository ignores local environment files and common secret-file patterns. `.env.example` deliberately contains public placeholders.

The application does not provide a complete privacy, retention, age-verification, or account-deletion workflow. Those operational requirements would need separate design before a broader student rollout.

## Local setup

Run commands from the repository root. `package.json` requires Node.js **22.12 or later** and declares **pnpm 11.25.0**.

```powershell
pnpm install --frozen-lockfile
```

If `.env.local` does not exist, create it from the example without overwriting an existing configuration:

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Set these two public values using the existing Supabase project's dashboard:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key_here
```

The code requires HTTPS and an `sb_publishable_` key. It intentionally rejects legacy JWT-style browser keys and example placeholders. Missing/invalid configuration disables authentication with setup guidance.

```powershell
pnpm dev
```

Open the exact URL Vite prints, usually `http://localhost:5173`. Restart Vite after changing environment variables. Use a consistent hostname and port when testing session restoration and email redirects.

In Supabase Auth, verify email signup is enabled, set the frontend Site URL, and allow the actual development/production confirmation URLs ending in `/onboarding`. Email confirmation, delivery, SMTP, rate limits, and stronger password rules are configured in Supabase.

**A fresh clone plus environment variables is not a self-contained backend setup.** The existing tables, valid data, permissions, auth settings, and two deployed functions must also be available. Starting Vite does not deploy them.

## Deployment and maintenance

This section records the repository's deployment paths. It does not assert that a production deployment exists or that the commands have been checked against current hosted services.

### Frontend

The existing Vercel configuration uses:

- Framework: Vite.
- Build: `pnpm build`.
- Output: `dist`.
- Environment: the same two public Vite variables, pointing at the intended Supabase project.
- Routing: `vercel.json` rewrites application URLs to `index.html` so direct links and refreshes work.

After deployment, verify auth redirect allowlists and direct navigation to protected routes. Public Vite variables are included at build time; changing hosting variables requires a new build to update the browser bundle.

### Assessment functions

| Function               | Input                                                            | Output                                                              |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `assessment-questions` | Authenticated POST with empty body object                        | Exactly ten public questions, without keys                          |
| `submit-assessment`    | Authenticated POST with `{ answers: [{ question_id, answer }] }` | Saved attempt ID, completion time, overall counts, and topic counts |

Canonical source is under `supabase/functions/`. `supabase/config.toml` keeps gateway JWT verification enabled for both functions; handlers independently verify the student through Auth.

The repository documents this CLI deployment path after installing/authenticating the Supabase CLI:

```powershell
$skillBridgeProjectRef = 'YOUR_EXISTING_PROJECT_REF'
supabase functions deploy assessment-questions --project-ref $skillBridgeProjectRef --use-api
supabase functions deploy submit-assessment --project-ref $skillBridgeProjectRef --use-api
supabase functions list --project-ref $skillBridgeProjectRef
```

An alternative is the Supabase Dashboard editor. Use the generated standalone files in `supabase/dashboard/`, one per function. Do not paste only the tiny canonical entrypoints into the editor, because those depend on shared modules. Check JWT verification separately when using the Dashboard.

The hosted server adapter reads `SUPABASE_URL` and either the `default` entry in `SUPABASE_SECRET_KEYS` or the fallback `SUPABASE_SERVICE_ROLE_KEY`. These are hosted server credentials, independent of `.env.local`. Check hosted configuration without copying credential values into code or chat.

Regenerate/check Dashboard copies after changing canonical function code:

```powershell
node supabase/dashboard/build.mjs
node supabase/dashboard/build.mjs --check
node node_modules/typescript/bin/tsc -p supabase/dashboard/tsconfig.json
```

An optional diagnostic variant of `assessment-questions` logs fixed failure stages and allowlisted error codes. It replaces that function for diagnosis; it is not a third app function. See the Dashboard README for generation and use.

### Additional maintenance utilities

- `node scripts/generate-third-party-notices.mjs` generates `public/third-party-notices.txt` from installed dependencies. It is a separate utility, not part of `pnpm build`.
- `node scripts/production-audit.mjs` performs a read-only heuristic credential scan of nonignored working files, reachable local Git history, and current build output. It redacts matched values and does not prove the absence of all secrets or personal data.

These utilities and some demo materials were already untracked in this checkout when this guide was prepared; their presence locally does not establish that they are committed or available in another clone.

## Testing and troubleshooting

### Available commands

| Command             | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `pnpm dev`          | Start development server                                    |
| `pnpm typecheck`    | Check configured TypeScript projects, including Edge source |
| `pnpm lint`         | Run ESLint                                                  |
| `pnpm test`         | Run the automated Vitest suite                              |
| `pnpm format:check` | Check formatting without changing files                     |
| `pnpm format`       | Format the repository; modifies files                       |
| `pnpm build`        | Type-check and create production frontend files             |
| `pnpm preview`      | Serve the built frontend locally                            |

Automated coverage includes authentication, profiles, preferences, assessment parsing/scoring, function handlers/adapters, catalog filtering, safe URLs, ranking, page behavior, account changes, and the integrated student journey. Tests use mocked services and synthetic data. They do not verify hosted RLS, live email delivery, real assessment inventory, deployed runtime behavior, or external resource availability.

For an authorized live acceptance pass, use dedicated test accounts to check signup/confirmation, preference persistence, question loading, a real submission, result refresh, a retake, recommendations, resource filtering, sign-out, account isolation, offline recovery, and keyboard/mobile use. See `DEMO_GUIDE.md` for the full sequence.

### Common problems

| Symptom                                  | What to check or do                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login form says setup is needed          | Check both public environment values and restart Vite; confirm key format and HTTPS URL                                                                                   |
| Confirmation returns to the wrong site   | Check Supabase Site URL and exact allowed redirect origin/port/path                                                                                                       |
| Account exists but profile will not load | Retry; inspect own-profile SELECT/INSERT permissions and required database defaults through authorized project access                                                     |
| Preferences do not save                  | Check form validation, connection, session, and own-profile SELECT/UPDATE/INSERT permissions                                                                              |
| Quiz cannot load                         | Check that both functions are deployed to the same project, the session is valid, server credentials exist, and the active inventory contains exactly ten valid questions |
| Function returns 401/403                 | Sign out/in and inspect session/auth configuration; Dashboard API-key authorization alone is not a student session                                                        |
| Submission rejected after a delay        | The active question bank may have changed; reload and take the current assessment                                                                                         |
| Submission status is uncertain           | Use Check saved results before a manual retry                                                                                                                             |
| Saved result does not load               | Check own-attempt read access, valid counts/topic data, and nonnull completion time                                                                                       |
| Library is empty or unavailable          | Distinguish no active rows from a read/permission failure; check active data and required field values                                                                    |
| Fewer than five recommendations          | Check usable active resources and HTTPS URLs; fewer than five is valid                                                                                                    |
| Ranking seems unchanged after editing    | Compare actual saved inputs and explanations; different inputs need not change the order                                                                                  |
| Protected URL fails on frontend refresh  | Confirm the host serves the SPA fallback for that URL                                                                                                                     |

Do not disable RLS or token verification to hide an integration failure. Resolve the actual data, configuration, or permission issue.

## Demo, limitations, and next steps

### A short demo

1. Log in with a dedicated confirmed demonstration account.
2. Open Your starting point, choose Saving and Budgeting, use the fictional goal “I want to plan a spending budget and build emergency savings,” and choose Beginner.
3. Save and continue; start or retake the knowledge check.
4. Show previous/next navigation and answer persistence, then complete all ten questions and submit once.
5. Show the server-saved overall/topic results and explain that the quiz is a short diagnostic.
6. Open For you, read one explanation, and explain the 45% / 35% / 20% formula.
7. Open a resource, return, and demonstrate library search plus combined filters.
8. Optionally refresh results or log out/in to show persistence.

Use actual visible results and resources. No guest mode or hard-coded production demonstration scores are implemented. The detailed click-and-explain script is `APP_WALKTHROUGH_SCRIPT.md`; recording instructions are in `RECORDING_GUIDE.md`.

### Current limits

- Ranking weights are hand-selected and have not been validated against learning outcomes.
- Goal matching is literal English keyword matching, including its inability to understand negation.
- The short quiz and small topic samples provide limited evidence.
- Question loading/scoring expects exactly ten active questions. Bank changes can invalidate an in-progress quiz; there is no question-version model.
- Unsaved drafts and in-progress answers do not survive refresh/navigation.
- Retakes are allowed; cross-tab/device/manual-retry duplicates are not prevented by a global idempotency key.
- The interface restores the latest result; it does not expose a full attempt-history or progress dashboard.
- There is no resource-completion tracking, outcome-based adaptation, or history-based personalization.
- Catalog filtering is local and unpaginated; growing the catalog requires revisiting data loading.
- Recommendations rely on external resources whose ongoing availability is outside the app.
- Existing documentation mentions a large-bundle build warning; no bundle-performance audit was performed for this guide.
- Existing setup depends on a pre-provisioned Supabase project; schema and policies cannot be reconstructed fully from migrations in this repository.

### Sensible next work, not implemented features

1. Verify the deployed student journey and account isolation against the intended hosted project.
2. Document/version the actual backend schema, defaults, grants, and policies to make setup reproducible.
3. Address ambiguous-submission duplication and question versioning if reliability needs increase.
4. Add progress/completion tracking only with a clear student use case and data model.
5. Improve catalog scale, link maintenance, and goal matching as real usage warrants.
6. Establish student privacy, retention, support, and account-management processes before broader release.

Older docs refer to “Task 8” as deployment/final stabilization. That is a planning reference, not evidence of current deployment status. The assessment README also contains an older statement that recommendations are a placeholder; current source code implements ranking and resource search.

## Where to find things

| Path                                         | Responsibility                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `README.md`                                  | Original setup and detailed feature/integration notes                         |
| `DEMO_GUIDE.md`                              | Demo flow and manual acceptance checklist                                     |
| `APP_WALKTHROUGH_SCRIPT.md`                  | Spoken walkthrough and on-screen actions                                      |
| `RECORDING_GUIDE.md`                         | Recording guidance                                                            |
| `package.json` / `pnpm-lock.yaml`            | Scripts, dependency declarations, pinned resolutions                          |
| `src/main.tsx`                               | React/browser-router entry                                                    |
| `src/app/App.tsx`                            | Route definitions                                                             |
| `src/app/StudentStart.tsx`                   | Resume onboarding or assessment                                               |
| `src/auth/`                                  | Session provider, profile initialization, route guard, auth controls/errors   |
| `src/onboarding/`                            | Preference options, validation, completion detection, persistence             |
| `src/assessment/`                            | Browser API, response validation, quiz, results, types                        |
| `src/resources/`                             | Catalog loader, filters, URL validation, resource cards                       |
| `src/recommendations/ranking.ts`             | Weights, difficulty matrix, keywords, scoring, tie-breaking                   |
| `src/recommendations/recommendations-api.ts` | Verified-own-data recommendation loader                                       |
| `src/recommendations/README.md`              | Full ranking rules and integration checks                                     |
| `src/pages/`                                 | Route-level screens and related tests                                         |
| `src/components/`                            | App shell, navigation, icons, headings, preference reminders                  |
| `src/lib/supabase.ts`                        | Public config validation and shared browser client                            |
| `src/styles/index.css`                       | Theme and common component styling                                            |
| `supabase/functions/_shared/`                | Canonical server validation, scoring, handlers, runtime, data adapter         |
| `supabase/functions/assessment-questions/`   | Public-question function entrypoint                                           |
| `supabase/functions/submit-assessment/`      | Scoring function entrypoint                                                   |
| `supabase/functions/deno.json`               | Edge dependency import configuration                                          |
| `supabase/config.toml`                       | Function JWT verification/import-map configuration                            |
| `supabase/README.md`                         | Security boundary, CLI deployment, and live assessment checks                 |
| `supabase/dashboard/`                        | Generated single-file Dashboard versions, generator, tests, diagnostic option |
| `scripts/`                                   | Local notice-generation and heuristic audit utilities                         |
| `public/`                                    | Static assets copied into the frontend build                                  |
| `vercel.json`                                | Frontend SPA rewrite                                                          |

When changing a feature, update its tests and the relevant detailed docs as well as this guide. Keep claims about hosted behavior tied to an actual live verification result.
