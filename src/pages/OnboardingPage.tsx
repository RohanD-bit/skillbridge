import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { Icon } from '../components/Icon'
import { PageIntro } from '../components/PageIntro'
import { supabase } from '../lib/supabase'
import {
  experienceOptions,
  goalLimit,
  interestOptions,
  validatePreferences,
} from '../onboarding/preferences'
import type {
  LearningPreferences,
  PreferenceErrors,
} from '../onboarding/preferences'
import {
  loadStudentPreferences,
  saveStudentPreferences,
} from '../onboarding/profile-preferences'

export function OnboardingPage() {
  const { user } = useAuth()
  // Account changes always start a fresh editor, without the previous student's draft.
  return user ? <OnboardingEditor key={user.id} userId={user.id} /> : null
}

function OnboardingEditor({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const { retryProfile } = useAuth()
  const [values, setValues] = useState<LearningPreferences>({
    interests: [],
    learning_goal: '',
    experience_level: 'beginner',
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [missing, setMissing] = useState(false)
  const [errors, setErrors] = useState<PreferenceErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveRequest = useRef<AbortController | null>(null)
  const errorSummary = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setLoading(true)
    setLoadError(null)
    async function load() {
      try {
        if (!supabase) throw new Error('Missing configuration')
        const profile = await loadStudentPreferences(
          supabase,
          userId,
          controller.signal,
        )
        if (!active) return
        setMissing(!profile)
        setValues({
          interests: [
            ...new Set(
              (profile?.interests ?? []).filter((value) =>
                interestOptions.some((option) => option.value === value),
              ),
            ),
          ],
          learning_goal: profile?.learning_goal ?? '',
          experience_level: profile
            ? (profile.experience_level ?? '')
            : 'beginner',
        })
      } catch {
        if (active)
          setLoadError(
            'We couldn’t load your learning preferences. Check your connection and try again. Your saved preferences have not been changed.',
          )
      } finally {
        window.clearTimeout(timeout)
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timeout)
      saveRequest.current?.abort()
      saveRequest.current = null
    }
  }, [userId, loadAttempt])

  useEffect(() => {
    if (Object.keys(errors).length) errorSummary.current?.focus()
  }, [errors])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saveRequest.current || loading || loadError) return
    setSaveError(null)
    const validation = validatePreferences(values)
    setErrors(validation)
    if (Object.keys(validation).length) return
    const controller = new AbortController()
    saveRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    setSaving(true)
    try {
      if (!supabase) throw new Error('Missing configuration')
      await saveStudentPreferences(supabase, userId, values, controller.signal)
      if (saveRequest.current !== controller) return
      retryProfile()
      navigate('/assessment', { state: { onboardingSaved: true } })
    } catch {
      if (saveRequest.current === controller)
        setSaveError(
          'We couldn’t confirm your preferences were saved. Check your connection and try again. Your entries are still here. If this continues, contact the project administrator.',
        )
    } finally {
      window.clearTimeout(timeout)
      if (saveRequest.current === controller) {
        saveRequest.current = null
        setSaving(false)
      }
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Step 01 · Make it yours"
        title="Make your learning path yours."
      >
        Choose what matters to you. We’ll save your preferences so you can
        return and edit them whenever your goals change.
      </PageIntro>
      {loading ? (
        <p role="status" className="card">
          Loading your learning preferences…
        </p>
      ) : loadError ? (
        <div className="card max-w-2xl">
          <p role="alert">{loadError}</p>
          <button
            type="button"
            className="button mt-4"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
          >
            Retry loading preferences
          </button>
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <form
            onSubmit={submit}
            noValidate
            aria-busy={saving}
            className="card min-w-0 space-y-8"
          >
            {missing && (
              <p
                role="status"
                className="rounded-xl bg-mint p-4 text-sm leading-6"
              >
                Let’s set up your learning preferences. We’ll create your
                profile when you save.
              </p>
            )}
            {Object.keys(errors).length > 0 && (
              <div
                ref={errorSummary}
                tabIndex={-1}
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
              >
                <p className="font-semibold">Please check these details:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {Object.entries(errors).map(([field, message]) => (
                    <li key={field}>
                      <a
                        className="underline underline-offset-2"
                        href={
                          field === 'interests'
                            ? '#interest-budgeting'
                            : field === 'experience_level'
                              ? '#experience-beginner'
                              : '#learning-goal'
                        }
                      >
                        {message}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {saveError && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
              >
                {saveError}
              </p>
            )}
            <fieldset disabled={saving} className="min-w-0 space-y-8">
              <legend className="sr-only">
                Your learning preferences — all three sections are required
              </legend>
              <fieldset
                aria-describedby={
                  'interest-help' + (errors.interests ? ' interests-error' : '')
                }
              >
                <legend className="text-lg font-semibold">
                  What would you like to learn?{' '}
                  <span className="text-sm font-normal text-muted">
                    (required)
                  </span>
                </legend>
                <p
                  id="interest-help"
                  className="mt-2 text-sm leading-6 text-muted"
                >
                  Choose one or more topics. There’s no wrong place to start.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {interestOptions.map((option) => (
                    <label
                      key={option.value}
                      className={
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 ' +
                        (values.interests.includes(option.value)
                          ? 'border-forest bg-mint'
                          : 'border-line bg-white')
                      }
                    >
                      <input
                        id={'interest-' + option.value}
                        type="checkbox"
                        name="interests"
                        value={option.value}
                        checked={values.interests.includes(option.value)}
                        aria-invalid={Boolean(errors.interests)}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setValues((current) => ({
                            ...current,
                            interests: checked
                              ? [
                                  ...new Set([
                                    ...current.interests,
                                    option.value,
                                  ]),
                                ]
                              : current.interests.filter(
                                  (value) => value !== option.value,
                                ),
                          }))
                        }}
                        className="mt-1 h-4 w-4 shrink-0 accent-forest"
                      />
                      <span>
                        <span className="block text-sm font-semibold">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {errors.interests && (
                  <p id="interests-error" className="mt-2 text-sm text-red-900">
                    {errors.interests}
                  </p>
                )}
              </fieldset>
              <div>
                <label
                  htmlFor="learning-goal"
                  className="text-lg font-semibold"
                >
                  Your primary learning goal{' '}
                  <span className="text-sm font-normal text-muted">
                    (required)
                  </span>
                </label>
                <p id="goal-help" className="mt-2 text-sm leading-6 text-muted">
                  What would you like to feel more confident about? Keep it
                  about learning, without personal or financial details.
                </p>
                <textarea
                  id="learning-goal"
                  name="learning_goal"
                  required
                  maxLength={goalLimit}
                  rows={4}
                  value={values.learning_goal}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      learning_goal: event.target.value,
                    }))
                  }
                  placeholder="For example: I want to learn how to plan a budget for my first paycheck."
                  className="field resize-y"
                  aria-invalid={Boolean(errors.learning_goal)}
                  aria-describedby={
                    'goal-help goal-count' +
                    (errors.learning_goal ? ' learning-goal-error' : '')
                  }
                />
                <p
                  id="goal-count"
                  className="mt-2 text-right text-xs text-muted"
                >
                  {values.learning_goal.length} / {goalLimit} characters
                </p>
                {errors.learning_goal && (
                  <p
                    id="learning-goal-error"
                    className="mt-2 text-sm text-red-900"
                  >
                    {errors.learning_goal}
                  </p>
                )}
              </div>
              <fieldset
                aria-describedby={
                  errors.experience_level ? 'experience-error' : undefined
                }
              >
                <legend className="text-lg font-semibold">
                  Where are you starting?{' '}
                  <span className="text-sm font-normal text-muted">
                    (required)
                  </span>
                </legend>
                <div className="mt-4 space-y-3">
                  {experienceOptions.map((option) => (
                    <label
                      key={option.value}
                      className={
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 ' +
                        (values.experience_level === option.value
                          ? 'border-forest bg-mint'
                          : 'border-line')
                      }
                    >
                      <input
                        id={'experience-' + option.value}
                        type="radio"
                        name="experience_level"
                        value={option.value}
                        required
                        checked={values.experience_level === option.value}
                        onChange={() =>
                          setValues((current) => ({
                            ...current,
                            experience_level: option.value,
                          }))
                        }
                        aria-invalid={Boolean(errors.experience_level)}
                        className="mt-1 h-4 w-4 shrink-0 accent-forest"
                      />
                      <span>
                        <span className="block text-sm font-semibold">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {errors.experience_level && (
                  <p
                    id="experience-error"
                    className="mt-2 text-sm text-red-900"
                  >
                    {errors.experience_level}
                  </p>
                )}
              </fieldset>
              <button
                type="submit"
                className="button inline-flex w-full items-center justify-center gap-3 sm:w-auto"
              >
                {saving ? 'Saving preferences…' : 'Save and continue'}
                <Icon name="arrow" />
              </button>
            </fieldset>
            {saving && (
              <p role="status" className="text-sm text-muted">
                Saving your preferences before continuing to the knowledge
                check…
              </p>
            )}
          </form>
          <aside className="rounded-2xl border border-[#dce6cf] bg-[#f0f4e9] p-6">
            <Icon name="leaf" className="mb-3 text-forest" />
            <h2 className="text-lg font-semibold">
              A starting point, not a label.
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Your experience level helps describe where you are today. You can
              always come back to update it.
            </p>
            <div className="mt-5 border-t border-[#dce6cf] pt-5">
              <Icon name="shield" className="mb-2 text-forest" />
              <p className="text-sm leading-6 text-muted">
                We only need your learning preferences. Leave out names, account
                numbers, balances, and other private details.
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
