# SkillBridge demo and end-to-end verification

Task 7 integrates existing features. It adds no guest mode, fake production
data, new authentication method, database migration, or deployment.

## Prepare before recording

1. Use a dedicated demonstration account and fictional learning preferences.
   If creating a test account, use an inbox you control and complete email
   confirmation before recording. Never put its password in source files or
   this guide. No account was created by this task.
2. Use the existing local `.env.local` public URL/publishable key configuration.
   Both assessment functions must already be deployed and working. Task 7 needs
   no new environment variables, SQL, deployments, or permission changes.
3. From the repository root, run `pnpm dev`. If pnpm is unavailable but Node and
   the existing dependencies are installed, use:

   ```powershell
   node node_modules/vite/bin/vite.js --host 127.0.0.1
   ```

   Open the exact URL Vite prints (normally `http://127.0.0.1:5173`) and leave the
   terminal running. Use one origin consistently to restore the same session.

4. Rehearse question loading, one normal submission, recommendations, and the
   library. Confirm ten resources load and the external links you plan to show
   work. Do not delete profiles or attempts between rehearsals: retakes work.
5. Sign out before recording. Keep environment files and developer tools out of
   the video. Use fictional preferences, not real names, balances, banking
   details, or student information. Passwords remain masked in the UI.

## Screen names

| Feature                             | Navigation label    |
| ----------------------------------- | ------------------- |
| Onboarding / edit preferences       | Your starting point |
| Assessment / saved results / retake | Knowledge check     |
| Personalized recommendations        | For you             |
| Resource search and filters         | Explore resources   |

The logo resumes the student's saved stage. Incomplete preferences open
onboarding; complete preferences open Knowledge check, which restores the latest
completed result or offers a new assessment. Returning students do not have to
resubmit completed onboarding.

## Recording sequence (approximately three minutes)

1. **Login:** open `/login` and sign in. New/incomplete profiles open onboarding.
   A returning account may show saved results; click **Your starting point** to
   demonstrate editing preferences.
2. **Preferences:** select **Saving** and **Budgeting**, enter **“I want to plan
   a spending budget and build emergency savings.”**, choose **Beginner**, then
   click **Save and continue**. Confirm the saved message on Knowledge check.
   Explain that preferences can be edited later.
3. **Assessment:** click **Start knowledge check**, or **Take the assessment
   again** if rehearsing with an existing result. Answer all ten questions,
   briefly showing previous/next navigation and preserved answers. Click
   **Submit assessment** once and keep the page open during scoring.
4. **Results:** show the saved overall score and topic counts. Explain that
   scoring runs on the server and the short diagnostic is a starting point,
   not a comprehensive evaluation. Do not promise a particular score or expose
   answer keys.
5. **Recommendations:** click **Continue to recommendations**. Show five cards
   when five usable resources exist. Read one explanation and show the topic,
   difficulty, provider, and ranking score. Explain 45% knowledge gap, 35%
   difficulty compatibility, and 20% interests/goal keywords. Scores compare
   resources; they are not success probabilities or machine-learning
   predictions. Open one resource in a new tab and return.
6. **Library:** click **Explore resources** in the recommendation actions. Show
   the resource count, search for a word from a visible title/description using
   different capitalization, and combine Topic, Difficulty, and Resource type.
   Choose values present in the catalog. Click **Clear Filters** to restore all
   resources. Optionally show a no-match search.
7. **Returning student (optional):** refresh saved results or log out and back
   in. Show persistent preferences/results and that onboarding is not forced.

Do not change production resources or manufacture a score to stage the video.
The real catalog and server results determine what appears.

## Exact manual acceptance checklist

1. **New student:** use a dedicated confirmed test account with incomplete
   preferences. Open `/`, log in, complete all three preference sections, and
   save. Knowledge check must appear only after saving succeeds. Revisit Your
   starting point and verify saved values are populated.
2. **Returning student:** sign out and sign in through `/login` without a return
   link. Confirm Knowledge check opens instead of requiring onboarding again.
   The latest saved result appears automatically, or Start knowledge check if
   no completed attempt exists.
3. **Independent library:** sign out, open `/resources`, click **Sign in to
   explore resources**, and log in. Confirm the catalog opens, not onboarding.
   Protected links must similarly return to their requested local page.
4. **Latest result/retake:** from For you choose **View results or retake
   assessment**, then **Take the assessment again**. Use different answers and
   submit. Confirm the new score/topic counts immediately replace the old
   result. Continue to recommendations and verify explanations reflect the
   latest topic accuracy (for example, 1/3 correct is 33%). Refresh and check
   persistence. Rankings can remain similar when weighted inputs are similar;
   check the evidence rather than expecting a guaranteed order change.
5. **Preference edits:** from For you choose **Edit preferences**, change
   interests/goal/level, and save. Knowledge check restores existing results;
   Continue to recommendations must use the newly saved preferences. Existing
   profile creation time and assessment history must remain intact.
6. **Missing evidence:** use a dedicated account with no assessment and open
   For you. Confirm neutral-knowledge messaging and working suggestions.
   Incomplete preferences show a completion link on assessment/recommendations.
   Missing profiles use the existing own-profile creation flow. Do not delete
   production data to simulate a missing profile or an empty catalog.
7. **Failure recovery:** use DevTools Offline to test a preference save,
   question load, recommendation read, and library load. Confirm safe errors
   and recovery controls. Restore connectivity before retrying. A failed save
   retains the current preference draft; a failed submission retains quiz
   answers. If delivery is uncertain, use **Check saved results** before
   resubmitting: it can restore an already-saved attempt without duplicating
   it. Network failures do not automatically resubmit the assessment.
8. **Privacy:** sign out on private results and confirm they disappear. A
   protected URL must require login. Switch dedicated test accounts and verify
   private data remains separate. Never disable RLS/JWT verification to test.
9. **Mobile/keyboard:** test a 375px-wide viewport and a desktop viewport. Tab
   through navigation, controls, result actions, and resource links. Verify
   visible focus, wrapping, and usable controls. Assessment completion moves
   focus to the results heading. Resource links use HTTPS, safe rel attributes,
   and announce a new tab.
10. **Recovery navigation:** verify recommendation actions reach the catalog,
    preferences, and results. Profile-read failures offer Retry profile and
    independent resource exploration. A bad URL offers **Back to your learning
    space**. Empty/unavailable catalogs give helpful messages and recovery.

## Automated checks and limits

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and
`pnpm build`. These commands do not deploy or change the database.

The full-flow test runs actual routes, AuthProvider, forms, readers, response
validation, filtering, and ranking with a mocked SDK transport and synthetic
profiles/resources/assessment responses. It verifies private selectors and
latest-completed ordering, including exclusion of incomplete attempts. It is
**not** a live Supabase, hosted RLS, email-delivery, or Edge Function scoring
test. Existing server tests verify scoring with mocks.

Signed-in live verification still requires a dedicated account and working
hosted services. Mocks cannot guarantee network availability during filming.
Unsubmitted quiz answers and unsaved preference drafts live in the current page;
navigating away or refreshing can discard them. Saved preferences and completed
attempts persist. Recommendation rules, literal English goal matching, and
catalog-size limits are unchanged. Fewer than five usable HTTPS resources
produces fewer recommendations. The existing large-bundle build warning remains.
Task 8 handles deployment and final stabilization; no Vercel deployment is
included here.
