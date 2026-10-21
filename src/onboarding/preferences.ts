export const interestOptions = [
  {
    value: 'budgeting',
    label: 'Budgeting',
    description: 'Make a plan for everyday spending.',
  },
  {
    value: 'saving',
    label: 'Saving',
    description: 'Build habits that bring goals closer.',
  },
  {
    value: 'credit',
    label: 'Credit',
    description: 'Understand borrowing and credit scores.',
  },
  {
    value: 'investing',
    label: 'Investing',
    description: 'Learn how money can grow over time.',
  },
] as const

export const experienceOptions = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'I’m starting with the basics.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'I know a little and want to build on it.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'I’m ready to explore more deeply.',
  },
] as const

export interface LearningPreferences {
  interests: string[]
  learning_goal: string
  experience_level: string
}
export type PreferenceErrors = Partial<
  Record<keyof LearningPreferences, string>
>
export const goalLimit = 300

export function validatePreferences(
  values: LearningPreferences,
): PreferenceErrors {
  const errors: PreferenceErrors = {}
  if (!values.interests.length)
    errors.interests = 'Choose at least one financial interest.'
  else if (
    values.interests.some(
      (value) => !interestOptions.some((option) => option.value === value),
    )
  )
    errors.interests = 'Choose interests from the four topics listed.'
  if (!values.learning_goal.trim())
    errors.learning_goal = 'Tell us what you would like to learn.'
  else if (values.learning_goal.length > goalLimit)
    errors.learning_goal = 'Keep your learning goal to 300 characters or fewer.'
  if (
    !experienceOptions.some(
      (option) => option.value === values.experience_level,
    )
  )
    errors.experience_level = 'Choose a valid experience level.'
  return errors
}

export function normalizePreferences(
  values: LearningPreferences,
): LearningPreferences {
  return {
    interests: [...new Set(values.interests)],
    learning_goal: values.learning_goal.trim(),
    experience_level: values.experience_level,
  }
}
