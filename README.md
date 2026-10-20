# SkillBridge

SkillBridge is a personalized financial literacy recommendation and learning platform designed for high school students.

Built for students ages 14–18 and Neighborhood Hacks 2026 (submission deadline: October 23, 2026). This repository currently contains the **frontend foundation only**.

## Local setup

Use Node.js 22.12+ (Node.js 24 LTS recommended) and pnpm 11.25.0. If needed, install pnpm with `npm install --global pnpm@11.25.0`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite (normally http://localhost:5173). All placeholder pages work without environment variables or a Supabase connection.

To prepare future integration, copy `.env.example` to `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

Replace only these placeholder values with the existing Supabase project's public configuration:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key_here
```

Use the project URL and **publishable key** from the Supabase dashboard. Restart Vite after environment changes. `src/lib/supabase.ts` exports a configured client, or `null` if configuration is missing, invalid, or still contains the example placeholders. No page uses the client yet. A publishable key is required; legacy JWT keys are intentionally not accepted by this foundation.

## Commands

| Command          | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | Start Vite with hot reload                          |
| `pnpm typecheck` | Check frontend and Vite TypeScript configuration    |
| `pnpm lint`      | Check TypeScript and React hooks with ESLint        |
| `pnpm build`     | Type-check and generate production files in `dist/` |
| `pnpm preview`   | Serve the production build locally                  |

Use `pnpm format` to format files and `pnpm format:check` to verify formatting without changes.

The committed `pnpm-lock.yaml` records resolved versions. Use pnpm consistently. The workspace configuration permits only esbuild's required dependency build script.

## Stack and structure

React 19, Vite 6, TypeScript 5, React Router 7, Tailwind CSS 4, and the Supabase JavaScript client. Tailwind uses its official Vite plugin and CSS-first theme configuration; a legacy Tailwind/PostCSS configuration is unnecessary.

```text
src/
  app/App.tsx              Route definitions
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
| `/login`, `/register` | Account interface; disabled credential fields           |
| `/onboarding`         | Student starting point and disabled interest choices    |
| `/assessment`         | Knowledge check overview; no questions or answer keys   |
| `/resources`          | Disabled search/filter controls and empty library state |
| `/recommendations`    | Explanation of the future personalized learning path    |
| Other paths           | Accessible not-found page with return link              |

Navigation exposes all five areas without route guards during this preview. The shell includes active navigation states, a skip link, route focus management, visible keyboard focus, and responsive layouts. Account forms, onboarding persistence, quiz questions/scoring, search, and recommendation logic are intentionally unimplemented. No real student data or fake results are included.

## Security and existing infrastructure

- Every `VITE_*` value is public and can appear in browser bundles. Never add a database password, service-role key, `sb_secret_` key, or answer key to frontend files or Vite variables.
- `.env`, `.env.*`, `*.local`, common key files, and secret directories are ignored. `.env.example` contains only public placeholders and is intentionally tracked.
- No Supabase tables, permissions, RLS policies, or data are created or changed. Existing `student_profiles`, `assessment_questions`, `assessment_attempts`, and `learning_resources` remain untouched.
- Future integrations must keep RLS enabled and enforce authorization and answer-key protection on the backend.
- No authentication, database reads/writes, Edge Functions, scoring, or recommendation engine has been implemented.

## Vercel

Import this repository using the Vite preset. Build command: `pnpm build`; output directory: `dist`. `vercel.json` provides a single-page application fallback so React Router links work after direct navigation or refresh. Configure the two public environment variables in Vercel when integration is needed; no deployment is performed by this task.

## Setup references

- [Vite documentation](https://vite.dev/guide/)
- [Tailwind's Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [Supabase client initialization](https://supabase.com/docs/reference/javascript/initializing)
- [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys)

Task 2 requires separate approval before implementation.
