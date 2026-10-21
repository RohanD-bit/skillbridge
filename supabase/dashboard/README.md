# Dashboard deployment files

These are generated copies of the existing Edge Functions. Each includes all four
shared modules (`assessment.ts`, `handlers.ts`, `runtime.ts`, and `supabase.ts`).
The canonical function source and working frontend are unchanged.

## Exactly what goes in the Dashboard

Open project **uqzhbqbphgikbwsclruq** in Supabase, then **Edge Functions → Deploy a
new function → Via Editor**. Use the following mapping:

| Function name          | Contents of its Dashboard `index.ts`                              |
| ---------------------- | ----------------------------------------------------------------- |
| `assessment-questions` | Copy the entire `assessment-questions.ts` file in this directory. |
| `submit-assessment`    | Copy the entire `submit-assessment.ts` file in this directory.    |

Use a separate function for each file. Replace the editor's starter code entirely.
Do not paste the original small entrypoints from `supabase/functions`: those need
shared files that are already inlined in these generated versions.

**Keep JWT verification enabled for both functions.** Pasting code does not apply
the repository's `supabase/config.toml`. Check the Dashboard's JWT verification
setting separately. The code also verifies every bearer token with Supabase Auth
before querying the database.

No additional source files, import maps, `deno.json`, or `package.json` are needed
in either Dashboard function. The explicit
`npm:@supabase/supabase-js@2.118.0` import lets the hosted Deno runtime resolve the
same SDK version used by the canonical source. Node and pnpm are not required to
paste these files into the Dashboard.

No deployment was performed while preparing these files. When you choose to
deploy, use **Deploy function** in each function's editor.

## Hosted environment names

The existing server code reads:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEYS`: JSON object with a `default` entry, **or**
  `SUPABASE_SERVICE_ROLE_KEY` as the existing fallback.

Supabase normally supplies these as hosted runtime defaults. No custom secrets
are required when those defaults are available. Hosted availability has not been
verified: the CLI was not authenticated. Check variable **names only** in the
Dashboard; do not copy secret values into code, the frontend, chat, or Git.
Do not attempt to create reserved `SUPABASE_` names as custom secrets. If a default
is unavailable, resolve the hosted project configuration before deployment.

The repository's `.env.local` configures Vite locally. It is neither uploaded nor
needed for these Dashboard files. The functions do not read Vite variables.

The privileged database client remains confined to the hosted function. It reads
answer keys only for server scoring and inserts attempts using the user ID
verified by Auth. The public question response explicitly excludes answer keys.
This preserves the existing access model; no schema or RLS changes are required.

## Verification and manual smoke test

Local checks can verify the generated TypeScript and mock the SDK without using
real credentials or making database requests. They do not prove hosted secret
availability or replace a hosted runtime test.

After you deploy both functions yourself:

1. Confirm both appear as active in Edge Functions and JWT verification is enabled.
2. Sign in through the existing SkillBridge app as a test student.
3. Open the assessment. Confirm ten questions load without answer keys in the
   response. Refresh and confirm authentication still works.
4. Complete and submit one assessment. Confirm a result appears and the attempt
   belongs to that signed-in student. This step writes a normal assessment attempt.
5. Sign out and confirm the assessment route is protected. An unauthenticated
   direct function request must also fail; it must not return question data.

Dashboard tests need a valid student session JWT in the Authorization header.
The Dashboard's default API-key authorization is not a student session, so a 401
with that default is expected. Do not paste tokens into chat or source files.

## Regeneration for maintainers

### Diagnosing a hosted 500

`assessment-questions-diagnostic.ts` is an optional replacement for the existing
`assessment-questions` function's `index.ts`. It is **not** a third function.
The canonical modules, public responses, authentication and database operations
are unchanged. A wrapper logs only a fixed failing stage and an allowlisted
database error code to hosted server logs. It never logs raw errors, messages,
tokens, credentials, student IDs, question data, or environment values.

After manually deploying that copy, retry loading questions in the app and look
in the function's Logs for `[assessment-diagnostic]`. A `read_public_questions`
stage with `42703` indicates a missing column; `42501` indicates a privileges
problem. `server_configuration` indicates an error while constructing the
existing server client. Other codes are reduced to `UNCLASSIFIED` rather than
logging potentially sensitive information. These diagnostics do not identify a
cause until a real failing request has been observed.

Generate or verify the diagnostic copy with:

```powershell
node supabase/dashboard/build.mjs --diagnostic
node supabase/dashboard/build.mjs --diagnostic --check
```

`diagnostics.fragment.txt` is a local generator input, not an additional file
to upload. The generated diagnostic file is validated as strict TypeScript.

From the repository root, with existing development dependencies installed:

```powershell
node supabase/dashboard/build.mjs
node supabase/dashboard/build.mjs --check
node node_modules/typescript/bin/tsc -p supabase/dashboard/tsconfig.json
```

`build.mjs`, `dashboard.test.ts`, and `tsconfig.json` are local maintenance and
validation files; do not paste them into the Dashboard. The generator reads only
the canonical function modules, SDK import map, and formatting config. It never
reads environment files or connects to Supabase.

References: [Dashboard editor](https://supabase.com/docs/guides/functions/quickstart-dashboard),
[dependencies](https://supabase.com/docs/guides/functions/dependencies),
[hosted secrets](https://supabase.com/docs/guides/functions/secrets),
[authentication headers](https://supabase.com/docs/guides/functions/auth-headers).
