# SkillBridge

SkillBridge is a personalized financial literacy recommendation and learning platform designed for high school students.

Built for students ages 14–18 and Neighborhood Hacks 2026 (submission deadline: October 23, 2026). The frontend foundation and Supabase email/password authentication are implemented. Onboarding, assessment, recommendations, and resource search remain placeholder interfaces.

## Local setup

Use Node.js 22.12+ (Node.js 24 LTS recommended) and pnpm 11.25.0. If needed, install pnpm with `npm install --global pnpm@11.25.0`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite (normally http://localhost:5173). Resource search remains public. Onboarding, assessment, and recommendations require a signed-in student and a loaded profile. Without public configuration, account controls show setup instructions and cannot submit credentials.

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

In the existing Supabase project's Authentication settings, verify that the Email provider and new-user signups are enabled. Keep email confirmation enabled for the intended registration flow. Configure the Site URL for your frontend and allow the exact confirmation redirect URLs for development and production, such as `http://localhost:5173/onboarding` and `https://your-deployment.example/onboarding`. Use the actual origin/port printed by Vite. Registration requests confirmation redirects to the current origin's `/onboarding` page; the shared client handles the returned session. If confirmation is disabled in Supabase, successful registration signs in immediately.

Email delivery, SMTP, rate limits, and stronger password rules are managed in Supabase. The registration form requires at least 8 characters; server-side requirements still apply. No dashboard settings, tables, or policies are changed by this code.

The auth provider restores persisted sessions, listens for sign-in/sign-out/token-refresh events, and clears student state when the account changes. Logout ends the current browser's session using the SDK's local scope. Invalid credentials, unconfirmed email, invalid/expired confirmation links, rate limits, network errors, missing configuration, and profile failures have accessible messages. Profile errors offer retry and never grant access to protected pages.

After a session is established, the app reads only that user's `student_profiles` row using the authenticated ID. If missing, it inserts `{ id: user.id, interests: [] }`, leaving text fields and timestamps to the existing schema's defaults (or nullable values). It never updates or upserts existing profiles. A concurrent duplicate insert triggers another read. The existing schema must permit that default insert and its RLS policies must allow the student to select and insert their own row. If configuration/permissions prevent this, the app reports a profile error; it does not change schema or bypass RLS.

## Commands

| Command          | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | Start Vite with hot reload                          |
| `pnpm typecheck` | Check frontend and Vite TypeScript configuration    |
| `pnpm lint`      | Check TypeScript and React hooks with ESLint        |
| `pnpm test`      | Run mocked authentication and profile tests         |
| `pnpm build`     | Type-check and generate production files in `dist/` |
| `pnpm preview`   | Serve the production build locally                  |

Use `pnpm format` to format files and `pnpm format:check` to verify formatting without changes.

The committed `pnpm-lock.yaml` records resolved versions. Use pnpm consistently. The workspace configuration permits only esbuild's required dependency build script.

## Stack and structure

React 19, Vite 6, TypeScript 5, React Router 7, Tailwind CSS 4, and the Supabase JavaScript client. Tailwind uses its official Vite plugin and CSS-first theme configuration; a legacy Tailwind/PostCSS configuration is unnecessary.

```text
src/
  app/App.tsx              Route definitions
  auth/                    Session provider, route guard, account controls, profile access, tests
  components/             Shared shell, icons, headings, preview notices
  lib/supabase.ts          Public environment configuration and client
  pages/                  Route-level placeholder interfaces
  styles/index.css        Tailwind import, theme, shared component styles
  main.tsx                React and browser-router entry point
  vite-env.d.ts           Typed public environment variables
```

| Route                 | Preview                                                 |
| --------------------- | ------------------------------------------------------- |
| `/`                   | Redirects to onboarding                                 |
| `/login`, `/register` | Email/password login and registration                   |
| `/onboarding`         | Student starting point and disabled interest choices    |
| `/assessment`         | Knowledge check overview; no questions or answer keys   |
| `/resources`          | Disabled search/filter controls and empty library state |
| `/recommendations`    | Explanation of the future personalized learning path    |
| Other paths           | Accessible not-found page with return link              |

Navigation exposes all five areas. Anonymous visitors to protected pages are redirected to login and returned to the requested page after authentication. Signed-in students are redirected away from login/registration. The shell preserves active navigation states, a skip link, route focus management, visible keyboard focus, and responsive layouts. Onboarding persistence, quiz questions/scoring, search, and recommendation logic are intentionally unimplemented. No real student data or fake results are included in source or tests.

## Security and existing infrastructure

- Every `VITE_*` value is public and can appear in browser bundles. Never add a database password, service-role key, `sb_secret_` key, or answer key to frontend files or Vite variables.
- `.env`, `.env.*`, `*.local`, common key files, and secret directories are ignored. `.env.example` contains only public placeholders and is intentionally tracked.
- No Supabase tables, permissions, or RLS policies are created or changed. Authentication creates users through Supabase Auth; the only application-table writes are missing students' default profile inserts.
- RLS remains the authorization boundary. Client route guards provide navigation behavior, not database security. No assessment questions, answer keys, attempts, or resources are fetched by authentication.
- Passwords exist only in the account form and are cleared after submission; they are never logged. The SDK owns session persistence and token refresh. No custom token storage is introduced.
- Edge Functions, onboarding persistence, assessment scoring, resource search, and recommendation logic remain outside this task.

## Verification

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build`. Tests mock Supabase and never use `.env.local`, contact the live project, send email, or create real accounts/profiles.

For a manual integration check, use a dedicated test account: register and confirm the email, log in, refresh a protected page, verify the matching profile is created once, and log out. Log in again and confirm existing profile fields are preserved. Also check invalid passwords, an unconfirmed email, an expired confirmation link, offline failures, and a second browser tab signing out. These live checks require the existing Supabase project and access to the test inbox; automated mocks do not verify live RLS or email delivery.

## Vercel

Import this repository using the Vite preset. Build command: `pnpm build`; output directory: `dist`. `vercel.json` provides a single-page application fallback so React Router links work after direct navigation or refresh. Configure the two public environment variables in Vercel when integration is needed; no deployment is performed by this task.

## Setup references

- [Vite documentation](https://vite.dev/guide/)
- [Tailwind's Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [Supabase client initialization](https://supabase.com/docs/reference/javascript/initializing)
- [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys)

Task 3, commits, and pushes require separate approval.
