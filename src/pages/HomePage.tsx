import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { RequireAuth } from '../auth/RequireAuth'
import { StudentStart } from '../app/StudentStart'
import { Icon } from '../components/Icon'

const steps = [
  {
    title: 'Tell us what matters to you',
    description:
      'Choose your interests, experience level, and a learning goal so your next steps fit you.',
  },
  {
    title: 'Try a short knowledge check',
    description:
      'Answer 10 multiple-choice questions about everyday money decisions. No lengthy written answers.',
  },
  {
    title: 'Find your next small step',
    description:
      'Get clear feedback and personalized resource recommendations, then explore the library at your own pace.',
  },
]

export function HomePage() {
  const auth = useAuth()
  if (auth.loading || auth.user || auth.sessionError) {
    return (
      <RequireAuth>
        <StudentStart />
      </RequireAuth>
    )
  }

  return (
    <>
      <section
        aria-labelledby="welcome-title"
        className="grid gap-8 rounded-3xl border border-line bg-white p-6 sm:p-9 xl:grid-cols-[1.4fr_1fr] xl:items-center"
      >
        <div>
          <p className="eyebrow">Welcome to SkillBridge</p>
          <h1
            id="welcome-title"
            className="mt-4 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl"
          >
            Money skills for the life ahead.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-muted">
            SkillBridge helps high school students ages 14–18 build practical
            skills in budgeting, saving, credit, and investing. Discover what
            you know and find resources that match your goals, one small step at
            a time.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link
              to="/register"
              className="button inline-flex items-center gap-3"
            >
              Get started <Icon name="arrow" />
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-12 items-center rounded-xl px-3 text-sm font-semibold text-forest underline underline-offset-4"
            >
              Already have an account? Log in
            </Link>
          </div>
          <a
            href="#how-it-works"
            className="mt-4 inline-flex min-h-12 items-center text-sm font-semibold text-forest underline underline-offset-4"
          >
            See how it works
          </a>
        </div>
        <div className="rounded-2xl bg-mint p-6 sm:p-8">
          <Icon name="leaf" className="mb-5 h-9 w-9 text-forest" />
          <h2 className="text-xl font-semibold">Our mission</h2>
          <p className="mt-3 text-base leading-8 text-forest">
            Help young people feel more confident about money through clear,
            practical learning that connects to everyday life.
          </p>
          <p className="mt-5 border-t border-forest/15 pt-5 text-sm leading-7 text-muted">
            From planning a budget to building a savings habit, start with
            something useful today and keep growing at your own pace.
          </p>
        </div>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="how-it-works-title"
        className="mt-10 scroll-mt-6"
      >
        <p className="eyebrow">A little wiser, every day</p>
        <h2 id="how-it-works-title" className="mt-3 text-2xl font-semibold">
          A simple path from curiosity to confidence.
        </h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="card">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-mint text-sm font-bold text-forest">
                <span className="sr-only">Step </span>
                {index + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm leading-7 text-muted">
          Real-life scenarios make money concepts easier to apply. Once signed
          in, you can explore resources directly from the navigation whenever
          you want to learn more.
        </p>
      </section>
    </>
  )
}
