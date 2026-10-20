import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { PreviewNotice } from '../components/PageIntro'
const steps = [
  {
    number: '01',
    title: 'Make it yours',
    description: 'Share your interests and what you want to learn.',
    to: '/onboarding',
    icon: 'compass' as const,
  },
  {
    number: '02',
    title: 'Find your footing',
    description: 'Discover what you know with a quick knowledge check.',
    to: '/assessment',
    icon: 'book' as const,
  },
  {
    number: '03',
    title: 'Build your confidence',
    description: 'Find learning resources that fit your next step.',
    to: '/recommendations',
    icon: 'spark' as const,
  },
]
export function OnboardingPage() {
  return (
    <>
      <p className="eyebrow">Welcome to your starting point</p>
      <section className="relative mt-5 overflow-hidden rounded-3xl bg-forest px-7 py-10 text-white sm:px-10 lg:py-12">
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[#c9e4bf]">
            <Icon name="leaf" className="h-4 w-4" />A little learning. A
            lifetime of possibility.
          </span>
          <h1 className="mt-6 text-4xl leading-[1.12] font-semibold tracking-tight sm:text-5xl">
            Your money.
            <br />
            Your future.
            <br />
            <span className="text-[#d3e6a6]">Your next move.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-[#d5e5df]">
            From your first paycheck to your biggest goals, build the money
            skills to make decisions with confidence.
          </p>
          <Link
            to="/assessment"
            className="mt-7 inline-flex min-h-12 items-center gap-5 rounded-xl bg-[#d3e6a6] px-5 py-3 text-sm font-semibold text-[#183d30] hover:bg-[#e2efc7]"
          >
            Explore your knowledge check
            <Icon name="arrow" />
          </Link>
        </div>
        <div
          aria-hidden="true"
          className="absolute -right-20 -bottom-32 hidden h-96 w-96 rounded-full border-[44px] border-white/5 md:block"
        >
          <div className="absolute inset-9 rounded-full border-[35px] border-[#d3e6a6]/10" />
        </div>
      </section>
      <section className="mt-10" aria-labelledby="journey-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <h2
            id="journey-heading"
            className="text-xl font-semibold tracking-tight"
          >
            A path that starts with you
          </h2>
          <span className="text-xs text-muted">
            Three steps toward money confidence
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.number} className="card flex flex-col">
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-mint p-3 text-forest">
                  <Icon name={step.icon} />
                </span>
                <span className="text-xs font-medium text-muted">
                  STEP {step.number}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 mb-6 text-sm leading-6 text-muted">
                {step.description}
              </p>
              {step.to === '/onboarding' ? (
                <span className="mt-auto text-sm font-semibold text-forest">
                  You’re here · Preview
                </span>
              ) : (
                <Link
                  to={step.to}
                  className="mt-auto flex items-center justify-between gap-2 text-sm font-semibold text-forest"
                >
                  Explore this step
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="mt-7 grid gap-5 md:grid-cols-[1.3fr_1fr]">
        <div className="card">
          <h2 className="text-lg font-semibold">
            What do you want to feel confident about?
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Your goals will help shape your learning path. Interest selection is
            coming in the next phase.
          </p>
          <fieldset disabled className="mt-5 flex flex-wrap gap-2">
            <legend className="sr-only">
              Example learning interests, unavailable in this preview
            </legend>
            {[
              'Everyday budgeting',
              'Saving for a goal',
              'Understanding credit',
              'Investing basics',
            ].map((topic) => (
              <label
                key={topic}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-muted"
              >
                <input type="checkbox" />
                {topic}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="rounded-2xl border border-[#dce6cf] bg-[#f0f4e9] p-6">
          <Icon name="shield" className="mb-3 text-forest" />
          <h2 className="font-semibold">A space to learn, at your pace.</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            No pressure to have it all figured out. Start with curiosity, and
            build from there.
          </p>
        </div>
      </section>
      <div className="mt-6">
        <PreviewNotice>
          Onboarding does not collect or save information yet. You can freely
          explore all page previews.
        </PreviewNotice>
      </div>
    </>
  )
}
