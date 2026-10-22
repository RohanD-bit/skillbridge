# Recommendation rules (Task 6)

`ranking.ts` contains pure TypeScript functions. `recommendations-api.ts` reads
the student's data and passes it to the engine. The protected Recommendations
page shows up to five results using the existing resource card. The complete
results-page design and journey refinement remain Task 7.

## Scoring

Every component is normalized to 0–1:

```text
score = 0.45 × knowledgeGapRelevance
      + 0.35 × difficultyCompatibility
      + 0.20 × interestGoalAlignment
```

The returned score uses full precision. The UI displays it on a 0–100 scale,
rounded to one decimal place. It is a relative ranking score, not a probability
of learning, success, or financial outcomes. The rules have not been calibrated
against learning outcomes.

**Knowledge:** for a valid topic score, `gap = 1 - correct / total`. Correct and
total must be safe integers, with `total > 0` and `0 <= correct <= total`.
Absent, malformed, or zero-total topic scores are unknown (`null`) and use a
neutral ranking contribution of `0.5`. They never become a fabricated zero
assessment score or a maximum gap. Valid topics are retained when other topics
are invalid. With no assessment, every topic has the same neutral contribution,
so preferences and difficulty determine their relative ranking. Fixed weights
are preserved instead of redistributing the missing knowledge weight.

**Difficulty:** rows describe the student, columns describe the resource:

| Experience   | Beginner | Intermediate | Advanced |
| ------------ | -------: | -----------: | -------: |
| Beginner     |     1.00 |         0.35 |     0.00 |
| Intermediate |     0.80 |         1.00 |     0.45 |
| Advanced     |     0.50 |         0.85 |     1.00 |

Missing or invalid experience uses beginner compatibility and is explained as
an accessible default, rather than claiming to know the student's level.
Advanced resources receive no difficulty points for beginners (at most 0.65
overall even when the other signals are maximal). This is a preference, not a
hard prerequisite: they can still appear if the catalog is limited or other
signals outweigh easier resources. Above-level resources are labeled as a
potential stretch in their explanations.

**Alignment:** `(interestMatch + goalMatch) / 2`, with each match either 0 or 1.
Thus interests contribute up to 10 ranking points and goals up to 10. An interest
matches the resource's topic exactly. Duplicated interests earn no extra points.
Learning goals are limited to their first 300 characters, Unicode-normalized,
lowercased, and split into English alphabetic words. Words under three letters
and an explicit generic stopword list are ignored. A goal matches if any retained
word occurs as a whole word in the resource title/description or in that topic's
small, explicit vocabulary (`goalTopicWords`). For example, `emergency` maps to
saving and `debt` to credit. Substrings, repeated keywords, and multiple matches
do not add points. Explanations list the actual matched words. This is literal
keyword matching, with no semantic AI, stemming, negation detection, or machine
learning. Non-English goals may not produce useful matches.

## Ordering and output

Candidates must have a safe absolute HTTPS URL without embedded credentials,
using the same URL validator as the resource catalog. Unusable links are omitted
before selecting results. The engine sorts by descending full-precision score,
then lowercase title, then ID, using ordinal comparisons rather than environment-
dependent locale ordering. It returns at most five results and never mutates the
input catalog. A smaller usable catalog returns fewer than five; an empty one
returns an empty array.

Each result includes the resource ID, title, description, provider, topic,
difficulty, resource type, normalized URL, numerical score, component scores, and
a human-readable explanation of the evidence and defaults used.

## Data access and privacy

The data loader accepts only `(client, signal)`, with no selectable student ID.
It verifies the current identity through `client.auth.getUser()` before database
reads. It then performs one read each of:

- The verified student's profile, via the existing scoped preference reader.
- Their latest completed attempt, filtering `student_id`, excluding null
  `completed_at`, sorting by completion time and ID descending, limiting to one.
  The projection is only `id, student_id, topic_scores, completed_at`.
- Active resources, via the existing read-only catalog loader.

These independent reads run together. There is no polling or persistent cache;
re-entering or refreshing the page reads current data. No answer-key table is
queried. Both profile and attempt ownership are checked on returned rows in
addition to existing RLS. An error or permission denial fails visibly; it is
never converted into an empty profile or a missing assessment.

A genuinely missing profile uses explicit defaults and a preferences link,
without creating or updating anything. Missing assessments use neutral knowledge
values and a knowledge-check link. Malformed topic data gets a partial-evidence
notice. Database/Auth diagnostic messages and student records are never logged
or rendered as errors.

Requests are cancelled on unmount/account changes. The page times out after 15
seconds even if identity verification hangs, ignores late responses, and verifies
the returned account matches its current account before displaying results.
Signing out immediately removes results. No tables, policies, permissions,
environment variables, Edge Functions, or authentication features are added.

## Tests and live verification

Automated tests use synthetic profiles, resource fixtures, and mocked Supabase.
They verify scoring, all fallback rules, ranking determinism and tie-breaking,
safe links, owner scoping, read failures, timeouts, and account changes. They do
not establish that the hosted RLS, permissions, or current catalog are correct.

With the existing development server and dedicated test accounts:

1. Sign in, save preferences, and complete an assessment. Open **For you**.
   Confirm up to five resources appear with scores, metadata, and explanations
   referring to your saved interests, experience, and latest topic results.
2. Refresh and confirm the ranking stays identical for unchanged inputs. Verify
   the browser Network panel shows only the three intended database reads plus
   the Auth check. Never share headers or tokens.
3. Edit and save your preferences, then return to For you. Change topic interests
   and experience substantially and confirm scores/order change when applicable.
4. Complete another assessment with different topic results. Return to For you
   and confirm it uses the newest result. No attempt deletion is needed.
5. Use a dedicated account with no assessment and confirm neutral knowledge
   messaging. Missing-profile, malformed-topic, and empty-catalog cases are
   covered by fixtures; do not alter production rows or policies to simulate them.
6. Open a resource with the keyboard. Check HTTPS/new-tab behavior and mobile
   layout. Go offline, reload, verify a safe error, restore connectivity, and retry.
7. Sign out or switch test accounts during loading and verify results disappear
   or are replaced with the correct account's results. Check that signed-out
   `/recommendations` navigation still leads to login.
8. Smoke-test onboarding, assessment submission/results after refresh, and
   resource search/filters. These workflows are unchanged by Task 6.

Known limits: rules are hand-selected; goal matching is literal English keyword
matching; a small catalog limits diversity; there is no history-based
personalization or outcome learning. Catalog size inherits the existing Data API
response limit; larger catalogs need pagination. Task 7 will refine presentation
and the full journey. No commits, pushes, or deployments are part of Task 6.
