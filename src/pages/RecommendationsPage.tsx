import { Link } from 'react-router-dom'
import { PageIntro, PreviewNotice } from '../components/PageIntro'
import { Icon } from '../components/Icon'
export function RecommendationsPage() {
  return (
    <>
      <PageIntro
        eyebrow="Step 03 · Your learning path"
        title="Learning that meets you where you are."
      >
        Your interests and knowledge check will help shape resource
        recommendations, with a clear explanation of why each one fits.
      </PageIntro>
      <section className="card flex flex-col items-start gap-6 sm:flex-row">
        <div className="rounded-2xl bg-mint p-5 text-forest">
          <Icon name="spark" className="h-10 w-10" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">
            Your path is waiting to take shape.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-muted">
            After onboarding and the assessment are connected, this space will
            highlight resources for your goals and areas to practice.
          </p>
          <Link
            to="/assessment"
            className="button mt-6 inline-flex items-center gap-3"
          >
            Preview the knowledge check
            <Icon name="arrow" />
          </Link>
        </div>
      </section>
      <section
        className="mt-7 grid gap-4 sm:grid-cols-3"
        aria-label="What to expect"
      >
        {[
          [
            'Made for your goals',
            'Learning topics that connect with what matters to you.',
          ],
          [
            'A clear next step',
            'Resources suited to the areas you want to strengthen.',
          ],
          [
            'Always explainable',
            'An explanation of why a resource was suggested.',
          ],
        ].map(([title, description]) => (
          <article key={title} className="card">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
          </article>
        ))}
      </section>
      <div className="mt-6">
        <PreviewNotice>
          No assessment results or personalized recommendations have been
          generated. Recommendation scoring is reserved for a future phase.
        </PreviewNotice>
      </div>
    </>
  )
}
