# SkillBridge

SkillBridge is a personalized financial literacy recommendation and learning platform designed for high school students.

Built for students ages 14–18 and Neighborhood Hacks 2026 (submission deadline: October 23, 2026). Authentication, onboarding, assessment, resource search, and explainable recommendations are integrated into a complete student journey. Assessment functions must be deployed to the connected project for live scoring. Task 8 covers deployment and final stabilization; no Vercel deployment has been performed here.

## Local setup

Use Node.js 22.12+ (Node.js 24 LTS recommended) and pnpm 11.25.0. If needed, install pnpm with `npm install --global pnpm@11.25.0`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite (normally http://localhost:5173). The resource landing page is public; students sign in before loading the catalog. Onboarding, assessment, and recommendations require a signed-in student and a loaded profile. Without public configuration, account controls show setup instructions and cannot submit credentials.

If `.env.local` is not already configured, copy `.env.example` to `.env.local` (do not overwrite an existing local configuration):

```powershell
Copy-Item .env.example .env.local
```

Replace only these placeholder values with the existing Supabase project's public configuration:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key_here
```

Use the project URL and **publishable key** from the Supabase dashboard. Restart Vite after environment changes. `src/lib/supabase.ts` exports the existing shared client, or `null` if configuration is missing, invalid, or still contains example placeholders. A publishable key is required; legacy JWT keys are intentionally not accepted.

## Authentication configuration

The default home/login destination resumes the student's saved stage:
incomplete preferences open onboarding; complete preferences open Knowledge
check, which restores the latest completed result or offers a new assessment.
Students can explicitly edit preferences through Your starting point. Login
preserves allowlisted return destinations, including the independent resource
library. Missing-profile/loading errors have recovery actions instead of an
endless loading state. The existing auth provider still restores sessions and
creates a default own profile if necessary.

In the existing Supabase project's Authentication settings, verify that the Email provider and new-user signups are enabled. Keep email confirmation enabled for the intended registration flow. Configure the Site URL for your frontend and allow the exact confirmation redirect URLs for development and production, such as `http://localhost:5173/onboarding` and `https://your-deployment.example/onboarding`. Use the actual origin/port printed by Vite. Registration requests confirmation redirects to the current origin's `/onboarding` page; the shared client handles the returned session. If confirmation is disabled in Supabase, successful registration signs in immediately.

Email delivery, SMTP, rate limits, and stronger password rules are managed in Supabase. The registration form requires at least 8 characters; server-side requirements still apply. No dashboard settings, tables, or policies are changed by this code.

The auth provider restores persisted sessions, listens for sign-in/sign-out/token-refresh events, and clears student state when the account changes. Logout ends the current browser's session using the SDK's local scope. Invalid credentials, unconfirmed email, invalid/expired confirmation links, rate limits, network errors, missing configuration, and profile failures have accessible messages. Profile errors offer retry and never grant access to protected pages.

After a session is established, the auth provider reads only that user's `student_profiles` row using the authenticated ID. If missing, it inserts `{ id: user.id, interests: [] }`, leaving text fields and timestamps to the existing schema's defaults (or nullable values). Authentication itself never updates or upserts existing profiles. A concurrent duplicate insert triggers another read. The existing schema must permit that default insert and its RLS policies must allow the student to select and insert their own row. If configuration/permissions prevent this, the app reports a profile error; it does not change schema or bypass RLS.

## Student onboarding

Signed-in students can open `/onboarding` to create or edit their learning preferences. The page fetches fresh preferences for the authenticated ID each time it opens; it shows loading and retry states rather than allowing a failed load to overwrite saved preferences with an empty form.

- Select one or more interests: budgeting, saving, credit, or investing. Selections are deduplicated.
- Enter a nonempty learning goal of at most 300 characters. Whitespace-only goals are rejected and surrounding whitespace is trimmed on save. A character counter and field-specific validation messages are provided.
- Select beginner, intermediate, or advanced experience. New profiles default to beginner.
- Save and continue waits for database confirmation, then opens the assessment with a saved confirmation. Errors retain the draft and allow retry; controls are disabled while saving.

Persistence uses the existing authenticated client and a scoped `update(...).eq('id', user.id)` that sends **only** `interests`, `learning_goal`, and `experience_level`. It requests the saved row so an empty/denied result is never treated as a successful update. If no row exists, it attempts an insert with the authenticated ID and these preferences. A concurrent duplicate insert retries the scoped update. No upsert, delete, schema change, or RLS bypass is used. `created_at` and `updated_at` are omitted from all preference writes; existing database defaults/triggers manage timestamps, preserving the original `created_at`.

Profile creation requires the existing INSERT policy and table permission; updates require the existing UPDATE and SELECT policies. If an operation is denied, the UI reports an error without changing policies. No additional environment variables or dependencies are required. Requests are cancelled when the page closes or the account changes, and late responses cannot populate another account's form or redirect it.

## Resource catalog

Open **Explore resources** (`/resources`) after signing in. The catalog reads only
the existing `learning_resources` table using the authenticated public Supabase
client, an explicit field projection, and `is_active = true`. Existing SELECT
permissions and RLS remain required and unchanged. It performs no writes and
requires no new secrets, Edge Functions, dependencies, or database setup.

Search matches title or description case-insensitively, treating input as literal
text. Topic, difficulty, and resource-type filters combine with search; Clear
Filters resets all four controls. Filtering happens locally after the small
catalog loads, without further database requests or recommendation ranking.
Resources are sorted by title and ID. The catalog does not hard-code ten rows;
it displays the active resources returned by Supabase. For a much larger catalog,
add server-side filtering and pagination; the current implementation uses the
project's existing Data API response limit (normally 1,000 rows).

Cards include provider, topic, difficulty, type, description, and an external
resource link. Only absolute HTTPS links without embedded credentials are
clickable, with `noopener noreferrer` and a new-tab announcement. Unsafe or
missing URLs show a non-clickable message while preserving the card. Nullable
descriptions and providers have display fallbacks. Database text renders as plain
React text, never HTML.

Loading, safe errors with retry, an empty library, no matching results, and a live
result count are included. Requests time out after 15 seconds, are cancelled on
unmount/account changes, and cannot populate a different account's catalog.
Account changes reset results and filters; signing out immediately hides them.

## Personalized recommendations

Open **For you** (`/recommendations`) after signing in. The engine ranks active
resources using 45% topic knowledge gap, 35% difficulty compatibility, and 20%
interest/learning-goal alignment. It displays up to five recommendations with
numerical ranking scores and explanations, using the student's saved preferences
and latest completed assessment. Missing topic evidence uses a neutral value,
without assuming poor knowledge; missing preferences use explicit accessible
defaults. A failed read shows an error rather than silently inventing defaults.

The read-only loader derives private selectors from Supabase Auth's verified
identity and keeps existing RLS. It reuses the profile and resource readers and
does not query assessment answer keys. No new Edge Function, dependency, database
permission, or environment variable is required. Task 6 does not change the
existing onboarding, assessment, or catalog workflow.

See [the recommendation rules and live testing guide](src/recommendations/README.md)
for the compatibility matrix, keyword rules, neutral defaults, deterministic
tie-breaking, privacy details, limitations, and manual integration checks. Scores
compare resources; they are not probabilities of success. Recommendations provide
clear actions to explore the catalog, edit preferences, or view results/retake.
Every navigation into For you (including the same route) reloads current inputs;
there is no cache of a previous assessment's recommendations.

## Integrated journey and demo

The normal flow is **Login → Onboarding → Knowledge check → Saved results →
For you → Explore resources**. Returning students resume saved results instead
of being forced to repeat completed onboarding. Onboarding redirects only after
a confirmed save; the assessment displays server-confirmed results before
offering Continue to recommendations. Both assessment readers select the latest
completed own attempt, excluding null completion times and breaking ties by
descending ID. Retakes immediately replace results after successful submission.

See [DEMO_GUIDE.md](DEMO_GUIDE.md) for the exact recording sequence, navigation
label map, fictional preference example, prerequisites, recovery instructions,
keyboard/mobile checks, and full manual acceptance checklist. No guest mode,
new database fields, authentication replacement, scoring changes, or deployments
are included. The recommendation algorithm is unchanged.

## Commands

For assessment setup, exact Edge Function deployment commands, security details, and live test steps, see [supabase/README.md](supabase/README.md). Writing the function files does not deploy them. No database schema or RLS changes are required.

| Command          | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | Start Vite with hot reload                          |
| `pnpm typecheck` | Check frontend and Vite TypeScript configuration    |
| `pnpm lint`      | Check TypeScript and React hooks with ESLint        |
| `pnpm test`      | Run mocked app, resource, and Edge Function tests   |
| `pnpm build`     | Type-check and generate production files in `dist/` |
| `pnpm preview`   | Serve the production build locally                  |

Use `pnpm format` to format files and `pnpm format:check` to verify formatting without changes.

The committed `pnpm-lock.yaml` records resolved versions. Use pnpm consistently. The workspace configuration permits only esbuild's required dependency build script.

## Stack and structure

React 19, Vite 6, TypeScript 5, React Router 7, Tailwind CSS 4, and the Supabase JavaScript client. Tailwind uses its official Vite plugin and CSS-first theme configuration; a legacy Tailwind/PostCSS configuration is unnecessary.

```text
src/
  app/App.tsx              Route definitions
  assessment/             Public assessment API/types, quiz, results, tests
  auth/                    Session provider, route guard, account controls, profile access, tests
  components/             Shared shell, icons, headings, preview notices
  lib/supabase.ts          Public environment configuration and client
  onboarding/             Preference options, validation, scoped persistence, tests
  resources/              Read-only catalog API, filters, safe cards, synthetic fixtures, tests
  recommendations/        Pure ranking rules, own-data loader, tests, algorithm guide
  pages/                  Route-level interfaces and integration tests
  styles/index.css        Tailwind import, theme, shared component styles
  main.tsx                React and browser-router entry point
  vite-env.d.ts           Typed public environment variables
```

| Route                 | Preview                                               |
| --------------------- | ----------------------------------------------------- |
| `/`                   | Resumes onboarding or saved assessment by preferences |
| `/login`, `/register` | Email/password login and registration                 |
| `/onboarding`         | Load, validate, create, and edit learning preferences |
| `/assessment`         | Secure 10-question quiz and persisted own results     |
| `/resources`          | Public landing; authenticated resource catalog/search |
| `/recommendations`    | Top-five explainable ranking using own saved data     |
| Other paths           | Accessible not-found page with return link            |

Navigation exposes all five areas. Anonymous visitors to protected pages are redirected to login and returned to the requested page after authentication. Signed-in students are redirected away from login/registration. The shell preserves active navigation states, a skip link, route focus management, visible keyboard focus, and responsive layouts. The assessment fetches only public question fields from an authenticated Edge Function, sends choices to server-side scoring, and restores the latest saved own result after refresh. Resources support keyword search and combined filters; recommendations use saved preferences and topic scores with explicit explanations. Tests use synthetic fixtures; no real student data or real answer keys are included.

## Security and existing infrastructure

- Every `VITE_*` value is public and can appear in browser bundles. Never add a database password, service-role key, `sb_secret_` key, or answer key to frontend files or Vite variables.
- `.env`, `.env.*`, `*.local`, common key files, and secret directories are ignored. `.env.example` contains only public placeholders and is intentionally tracked.
- No Supabase tables, permissions, or RLS policies are created or changed. Browser writes remain limited to students' own profiles/preferences. Assessment attempts are inserted only by the authenticated scoring Edge Function, using verified identity and server-calculated scores.
- RLS remains the authorization boundary. Client route guards provide navigation behavior, not database security. No assessment questions, answer keys, attempts, or resources are fetched by authentication.
- Passwords exist only in the account form and are cleared after submission; they are never logged. The SDK owns session persistence and token refresh. No custom token storage is introduced.
- Assessment scoring and privileged table access remain outside the frontend. The browser cannot directly read the question bank or write assessment attempts. The catalog reads active learning resources under existing RLS. Recommendation ranking is read-only, based on the verified student's own profile/topic scores and active resources; no secret keys are used.

## Verification

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build`. Tests mock Supabase and never use `.env.local`, contact the live project, send email, or create real accounts/profiles.

For a manual integration check, use a dedicated test account: register and confirm the email, log in, refresh a protected page, verify the matching profile is created once, and log out. Log in again and confirm existing profile fields are preserved. Also check invalid passwords, an unconfirmed email, an expired confirmation link, offline failures, and a second browser tab signing out. These live checks require the existing Supabase project and access to the test inbox; automated mocks do not verify live RLS or email delivery.

For onboarding, use dedicated test accounts and synthetic goals:

1. Open `/onboarding` while signed out and confirm login is required. Sign in and verify existing preferences populate.
2. Submit without interests or with a blank goal. Confirm field messages and keyboard focus on the error summary. Check the 300-character boundary and all three experience options.
3. Select multiple interests, enter a synthetic learning goal, and save. Confirm the assessment appears only after saving, with a saved confirmation.
4. Return to onboarding, refresh, and verify the preferences persist. Edit and save again; verify only preferences changed and `created_at` remains unchanged.
5. Simulate an offline/load/save failure. Confirm retry works, the draft survives a failed save, and there is no success redirect. Repeated clicks must produce one submission.
6. Switch between two test accounts and verify their preferences stay separate. With an authorized test session, verify the existing RLS denies reading/updating the other test account's ID; do not change any policies.
7. If testing a missing profile, use an authorized disposable test account rather than deleting an existing row. Confirm creation either succeeds under the existing INSERT policy or displays a controlled error.

## Manual resource integration check

1. Visit `/resources` signed out. Confirm the sign-in prompt appears and no
   `learning_resources` request is made. Sign in through that link and confirm
   you return to `/resources`.
2. Confirm all ten existing active resources load with title, description,
   provider, topic, difficulty, type, and links. In the browser Network panel,
   confirm the query targets only `learning_resources` and filters active rows.
   Do not share request headers or tokens.
3. Search a known title using different capitalization, then search a phrase
   found only in a description. Check topic, difficulty, and type independently
   and together. Confirm the count and Clear Filters behavior.
4. Enter a keyword with no matches. Confirm the helpful empty-results message.
5. Tab through the search, selects, Clear Filters, and Open Resource links.
   Confirm visible focus, clear labels, and new-tab behavior. Check a narrow
   mobile viewport and a wide desktop viewport for wrapping and grid layout.
6. Use browser DevTools to go offline, reload the page, and confirm a safe error
   with retry. Restore connectivity and retry successfully.
7. Sign out or change test accounts while loading. Confirm old results do not
   appear. Refresh while signed in and confirm the library reloads.
8. Smoke-test onboarding and assessment, including saved results after refresh.
   Existing resource RLS must hide inactive records. Do not alter rows, grants,
   or policies to test this; automated fixtures cover inactive responses.

Automated resource tests use synthetic fixtures and mocked Supabase responses;
they do not verify the hosted catalog, RLS, or availability of external websites.

## Vercel

Import this repository using the Vite preset. Build command: `pnpm build`; output directory: `dist`. `vercel.json` provides a single-page application fallback so React Router links work after direct navigation or refresh. Configure the two public environment variables in Vercel when integration is needed; no deployment is performed by this task.

## Setup references

- [Vite documentation](https://vite.dev/guide/)
- [Tailwind's Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [Supabase client initialization](https://supabase.com/docs/reference/javascript/initializing)
- [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys)

Commits, pushes, deployments, and Task 8 require separate approval.
