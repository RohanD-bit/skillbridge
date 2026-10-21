import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { answerLetters, topicLabels } from './types'
import type { Answer, AssessmentQuestion, SubmittedAnswer } from './types'

interface Props {
  questions: AssessmentQuestion[]
  submitting: boolean
  error: string | null
  onSubmit: (answers: SubmittedAnswer[]) => void
  onCheckResults: () => void
  checking: boolean
}
export function AssessmentQuiz({
  questions,
  submitting,
  error,
  onSubmit,
  onCheckResults,
  checking,
}: Props) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [validation, setValidation] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const alert = useRef<HTMLParagraphElement>(null)
  const question = questions[index]
  const answered = questions.filter((value) => answers[value.id]).length
  useEffect(() => {
    heading.current?.focus()
  }, [index])
  useEffect(() => {
    if (validation) alert.current?.focus()
  }, [validation])
  function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting || checking) return
    const missing = questions.findIndex((value) => !answers[value.id])
    if (missing >= 0) {
      setIndex(missing)
      setValidation(
        'Please answer all 10 questions before submitting. We’ve opened the first unanswered question.',
      )
      return
    }
    setValidation(null)
    onSubmit(
      questions.map((value) => ({
        question_id: value.id,
        answer: answers[value.id],
      })),
    )
  }
  return (
    <form
      onSubmit={submit}
      aria-busy={submitting || checking}
      className="card max-w-3xl"
    >
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <p className="font-semibold">
          Question {index + 1} of {questions.length}
        </p>
        <p className="text-muted">
          {answered} of {questions.length} answered
        </p>
      </div>
      <progress
        max={questions.length}
        value={answered}
        aria-label="Questions answered"
        className="mt-3 h-2 w-full accent-forest"
      />
      {validation && (
        <p
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900"
        >
          {validation}
        </p>
      )}
      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p role="alert" className="text-sm leading-6 text-red-900">
            {error} Your answers are still here. A failed response can leave a
            saved attempt; check saved results before retrying.
          </p>
          <button
            type="button"
            disabled={checking || submitting}
            onClick={onCheckResults}
            className="mt-3 min-h-11 text-sm font-semibold text-forest underline"
          >
            {checking ? 'Checking saved results…' : 'Check saved results'}
          </button>
        </div>
      )}
      <fieldset disabled={submitting || checking} className="mt-6 min-w-0">
        <legend className="sr-only">Assessment questions and answers</legend>
        <p className="eyebrow">{topicLabels[question.topic]}</p>
        <h2
          ref={heading}
          tabIndex={-1}
          id="question-heading"
          className="mt-3 text-xl leading-8 font-semibold outline-none"
        >
          {question.question_text}
        </h2>
        <fieldset aria-labelledby="question-heading" className="mt-5 space-y-3">
          <legend className="sr-only">Choose one answer</legend>
          {answerLetters.map((letter) => (
            <label
              key={question.id + letter}
              className={
                'flex cursor-pointer items-start gap-3 rounded-xl border p-4 ' +
                (answers[question.id] === letter
                  ? 'border-forest bg-mint'
                  : 'border-line')
              }
            >
              <input
                type="radio"
                name={'answer-' + question.id}
                value={letter}
                checked={answers[question.id] === letter}
                onChange={() => {
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: letter,
                  }))
                  setValidation(null)
                }}
                className="mt-1 h-4 w-4 shrink-0 accent-forest"
              />
              <span className="text-sm leading-6">
                <span className="mr-2 font-semibold">{letter}.</span>
                {question.options[letter]}
              </span>
            </label>
          ))}
        </fieldset>
        <nav
          aria-label="Question navigation"
          className="mt-6 flex flex-wrap gap-2"
        >
          {questions.map((value, position) => (
            <button
              key={value.id}
              type="button"
              aria-label={
                'Question ' +
                (position + 1) +
                ', ' +
                (answers[value.id] ? 'answered' : 'unanswered')
              }
              aria-current={position === index ? 'step' : undefined}
              onClick={() => setIndex(position)}
              className={
                'min-h-11 min-w-11 rounded-lg border px-3 py-2 text-sm font-semibold ' +
                (position === index
                  ? 'border-forest bg-forest text-white'
                  : answers[value.id]
                    ? 'border-forest bg-mint text-forest'
                    : 'border-line text-muted')
              }
            >
              {position + 1}
            </button>
          ))}
        </nav>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((value) => value - 1)}
            className="min-h-12 rounded-xl border border-line px-4 py-3 text-sm font-semibold disabled:text-stone-400"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={index === questions.length - 1}
            onClick={() => setIndex((value) => value + 1)}
            className="min-h-12 rounded-xl border border-line px-4 py-3 text-sm font-semibold disabled:text-stone-400"
          >
            Next
          </button>
          <button type="submit" className="button sm:ml-auto">
            {submitting ? 'Submitting assessment…' : 'Submit assessment'}
          </button>
        </div>
      </fieldset>
      {submitting && (
        <p role="status" className="mt-4 text-sm text-muted">
          Securely scoring and saving your assessment…
        </p>
      )}
      {checking && (
        <p role="status" className="mt-4 text-sm text-muted">
          Checking for a newly saved attempt…
        </p>
      )}
    </form>
  )
}
