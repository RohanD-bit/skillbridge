import type { ReactNode } from 'react'
export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <header className="mb-9 max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-base leading-7 text-muted">{children}</p>
    </header>
  )
}
export function PreviewNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-muted">
      <span className="font-semibold text-ink">Preview only. </span>
      {children}
    </div>
  )
}
