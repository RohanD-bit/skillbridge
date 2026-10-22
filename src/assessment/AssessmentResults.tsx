import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { topicLabels } from './types'
import type { AssessmentResult, Topic } from './types'

export function AssessmentResults({
  result,
  onRetake,
}: {
  result: AssessmentResult
  onRetake: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [result.attempt_id])
  const percent = Math.round(
    (result.correct_answers / result.total_questions) * 100,
  )
  return (
    <section className="card max-w-3xl" aria-labelledby="results-heading">
      <p className="eyebrow">Your saved knowledge check</p>
      <h2
        ref={heading}
        tabIndex={-1}
        id="results-heading"
        className="mt-3 text-2xl font-semibold"
      >
        A starting point for your next step.
      </h2>
      <p role="status" className="mt-5 text-3xl font-semibold text-forest">
        {result.correct_answers} / {result.total_questions} correct · {percent}%
      </p>
      <p className="mt-2 text-xs text-muted">
        Completed {new Date(result.completed_at).toLocaleString()}
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-3 text-left font-semibold">
            Performance by topic
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-3 pr-4">
                Topic
              </th>
              <th scope="col" className="py-3 pr-4">
                Correct / total
              </th>
              <th scope="col" className="py-3">
                Next step
              </th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(topicLabels) as Topic[]).map((topic) => {
              const score = result.topic_scores[topic]
              return (
                <tr key={topic} className="border-b border-line">
                  <th scope="row" className="py-4 pr-4 font-medium">
                    {topicLabels[topic]}
                  </th>
                  <td className="py-4 pr-4">
                    {score.correct} / {score.total}
                  </td>
                  <td className="py-4 text-muted">
                    {score.total === 0
                      ? 'Not covered in this attempt.'
                      : score.correct < score.total
                        ? 'More practice may help.'
                        : 'Keep building on this foundation.'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-5 rounded-xl bg-mint p-4 text-sm leading-6 text-forest">
        This short diagnostic is a starting point, not a comprehensive financial
        literacy evaluation. A few questions cannot capture everything you know.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/recommendations" className="button inline-flex items-center">
          Continue to recommendations
        </Link>
        <button
          type="button"
          onClick={onRetake}
          className="min-h-12 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-forest hover:bg-mint"
        >
          Take the assessment again
        </button>
      </div>
    </section>
  )
}
