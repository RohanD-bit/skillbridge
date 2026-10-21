export const topicLabels = {
  budgeting: 'Budgeting',
  saving: 'Saving',
  credit: 'Credit',
  investing: 'Investing',
} as const
export type Topic = keyof typeof topicLabels
export const answerLetters = ['A', 'B', 'C', 'D'] as const
export type Answer = (typeof answerLetters)[number]
export interface AssessmentQuestion {
  id: string
  topic: Topic
  question_text: string
  options: Record<Answer, string>
  difficulty: string
}
export interface SubmittedAnswer {
  question_id: string
  answer: Answer
}
export interface AssessmentResult {
  attempt_id: string
  total_questions: number
  correct_answers: number
  topic_scores: Record<Topic, { correct: number; total: number }>
  completed_at: string
}
