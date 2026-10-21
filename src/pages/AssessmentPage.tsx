import { Link, useLocation } from 'react-router-dom'
import { PageIntro, PreviewNotice } from '../components/PageIntro'
import { Icon } from '../components/Icon'
export function AssessmentPage() {
  const location = useLocation()
  return (
    <>
      {location.state?.onboardingSaved === true && (
        <p
          role="status"
          className="mb-6 rounded-xl border border-line bg-mint p-4 text-sm text-forest"
        >
          Your learning preferences are saved. You’re ready for your knowledge
          check.
        </p>
      )}
      <PageIntro
        eyebrow="Step 02 · Knowledge check"
        title="Find your starting point."
      >
        Explore what you already know and discover where you can grow. You don’t
        need to prepare or know every answer.
      </PageIntro>
      <section className="card max-w-3xl">
        <span className="inline-flex rounded-xl bg-mint p-3 text-forest">
          <Icon name="book" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold">
          A little check-in with your money knowledge
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          The assessment will cover 10 questions across four everyday money
          topics.
        </p>
        <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {['Budgeting', 'Saving', 'Credit', 'Investing'].map((topic, i) => (
            <div key={topic} className="rounded-xl bg-canvas p-4">
              <p className="text-xs text-muted">0{i + 1}</p>
              <p className="mt-2 text-sm font-semibold">{topic}</p>
            </div>
          ))}
        </div>
        <PreviewNotice>
          The assessment is not connected yet. Questions, answers, scores, and
          results are not loaded in this preview.
        </PreviewNotice>
        <button type="button" disabled className="button mt-6">
          Start knowledge check · Coming soon
        </button>
      </section>
      <Link
        to="/resources"
        className="mt-6 inline-flex items-center gap-3 text-sm font-semibold text-forest"
      >
        Explore the resource preview
        <Icon name="arrow" />
      </Link>
    </>
  )
}
