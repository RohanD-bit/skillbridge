import { Link } from 'react-router-dom'
import { PageIntro, PreviewNotice } from '../components/PageIntro'
export function AuthPage({ register = false }: { register?: boolean }) {
  return (
    <>
      <PageIntro
        eyebrow="Your learning space"
        title={register ? 'Start your next chapter.' : 'Welcome back.'}
      >
        A place to build practical money skills, one step at a time.
      </PageIntro>
      <div className="card max-w-xl">
        <div className="mb-6">
          <PreviewNotice>
            Account creation and sign-in are not connected yet. These fields are
            disabled and no credentials are collected.
          </PreviewNotice>
        </div>
        <fieldset disabled className="space-y-5">
          <legend className="sr-only">
            {register ? 'Registration preview' : 'Login preview'}
          </legend>
          <label className="field-label" htmlFor="email">
            Email address
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Your email address"
              className="field"
            />
          </label>
          <label className="field-label" htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              placeholder="Your password"
              className="field"
            />
          </label>
          <button className="button w-full" type="button">
            {register ? 'Create account' : 'Log in'} · Coming soon
          </button>
        </fieldset>
        <p className="mt-6 text-center text-sm text-muted">
          {register ? 'Already have an account?' : 'New to SkillBridge?'}{' '}
          <Link
            className="font-semibold text-forest underline underline-offset-4"
            to={register ? '/login' : '/register'}
          >
            {register ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </>
  )
}
