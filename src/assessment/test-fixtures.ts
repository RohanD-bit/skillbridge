// Synthetic fixtures used only by tests, never real students or question content.
import type { AssessmentQuestion, AssessmentResult, Topic } from './types'
const subjects: Topic[] = [
  'budgeting',
  'budgeting',
  'budgeting',
  'saving',
  'saving',
  'credit',
  'credit',
  'credit',
  'investing',
  'investing',
]
export const fixtureQuestions: AssessmentQuestion[] = subjects.map(
  (topic, index) => ({
    id: '10000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
    topic,
    question_text: 'Synthetic question ' + (index + 1),
    difficulty: 'beginner',
    options: {
      A: 'First choice',
      B: 'Second choice',
      C: 'Third choice',
      D: 'Fourth choice',
    },
  }),
)
export const fixtureResult: AssessmentResult = {
  attempt_id: '20000000-0000-4000-8000-000000000001',
  total_questions: 10,
  correct_answers: 6,
  completed_at: '2026-10-20T12:00:00Z',
  topic_scores: {
    budgeting: { correct: 2, total: 3 },
    saving: { correct: 1, total: 2 },
    credit: { correct: 2, total: 3 },
    investing: { correct: 1, total: 2 },
  },
}
