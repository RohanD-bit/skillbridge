import { Link } from 'react-router-dom'
import { PageIntro } from '../components/PageIntro'
export function NotFoundPage() {
  return (
    <>
      <PageIntro
        eyebrow="404 · Page not found"
        title="Let’s get you back on track."
      >
        This page doesn’t exist. Your learning space is just a step away.
      </PageIntro>
      <Link to="/onboarding" className="button inline-flex">
        Back to your starting point
      </Link>
    </>
  )
}
