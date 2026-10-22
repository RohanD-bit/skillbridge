import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { AccountControls } from '../auth/AccountControls'
const navigation: { to: string; label: string; icon: IconName }[] = [
  { to: '/onboarding', label: 'Your starting point', icon: 'compass' },
  { to: '/assessment', label: 'Knowledge check', icon: 'book' },
  { to: '/recommendations', label: 'For you', icon: 'spark' },
  { to: '/resources', label: 'Explore resources', icon: 'search' },
]
export function AppShell() {
  const { pathname } = useLocation()
  useEffect(() => {
    const label =
      navigation.find((item) => item.to === pathname)?.label ??
      (pathname === '/login'
        ? 'Log in'
        : pathname === '/register'
          ? 'Create an account'
          : 'Page not found')
    document.title = `${label} · SkillBridge`
    document.getElementById('main-content')?.focus()
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="border-b border-line bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
        <Link
          to="/"
          aria-label="SkillBridge home"
          className="flex items-center gap-3 px-6 py-7 text-xl font-bold tracking-tight"
        >
          <span className="rounded-xl bg-forest p-2 text-white">
            <Icon name="bridge" className="h-6 w-6" />
          </span>
          SkillBridge<span className="text-sage">.</span>
        </Link>
        <p className="px-6 pb-3 text-[10px] font-bold tracking-[0.18em] text-muted uppercase">
          Your learning space
        </p>
        <nav
          aria-label="Main navigation"
          className="grid grid-cols-2 gap-1 px-3 pb-4 lg:grid-cols-1"
        >
          {navigation.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${isActive ? 'bg-mint text-forest' : 'text-muted hover:bg-stone-50 hover:text-ink'}`
              }
            >
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mx-5 mt-auto hidden rounded-2xl bg-[#f4f5ec] p-5 lg:block">
          <Icon name="leaf" className="mb-3 text-forest" />
          <p className="text-sm font-semibold">
            Small steps. Big possibilities.
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Money skills you can use today, and carry into tomorrow.
          </p>
        </div>
        <AccountControls />
      </aside>
      <div className="lg:ml-64">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-6 py-5 lg:px-10">
          <p className="text-sm text-muted">
            Your future starts with a little know-how.
          </p>
          <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">
            Student learning space
          </span>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-7xl px-5 py-9 outline-none sm:px-8 lg:px-10 lg:py-11"
        >
          <Outlet />
        </main>
        <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-7 text-xs text-muted lg:px-10">
          <span>SkillBridge · A little wiser, every day.</span>
          <span>Built for students ages 14–18</span>
        </footer>
      </div>
    </div>
  )
}
