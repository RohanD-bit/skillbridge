import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import {
  resourceDifficulties,
  resourceTopics,
  resourceTypes,
  safeResourceUrl,
} from './catalog'
import type { LearningResource } from './catalog'

export function ResourceCard({
  resource,
  children,
}: {
  resource: LearningResource
  children?: ReactNode
}) {
  const href = safeResourceUrl(resource.url)
  const titleId = `resource-${resource.id}`
  return (
    <article
      aria-labelledby={titleId}
      className="card flex h-full min-w-0 flex-col"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-forest">
          {resourceTopics[resource.topic]}
        </span>
        <Icon name="book" className="text-sage" />
      </div>
      <h3 id={titleId} className="mt-5 text-xl font-semibold break-words">
        {resource.title}
      </h3>
      <p className="mt-2 text-xs font-medium break-words text-muted">
        {resource.provider || 'Provider not listed'}
      </p>
      <p className="mt-4 text-sm leading-7 break-words text-muted">
        {resource.description || 'No description available.'}
      </p>
      <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        <div>
          <dt className="text-muted">Difficulty</dt>
          <dd className="mt-1 font-medium">
            {resourceDifficulties[resource.difficulty]}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Resource type</dt>
          <dd className="mt-1 font-medium">
            {resourceTypes[resource.resource_type]}
          </dd>
        </div>
      </dl>
      {children}
      <div className="mt-auto pt-6">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center gap-2 rounded-lg text-sm font-semibold text-forest underline decoration-line underline-offset-4 hover:decoration-forest"
          >
            Open Resource
            <span className="sr-only">
              : {resource.title} (opens in a new tab)
            </span>
            <Icon name="arrow" className="h-4 w-4" />
          </a>
        ) : (
          <p className="text-sm text-muted">
            A secure resource link is not available.
          </p>
        )}
      </div>
    </article>
  )
}
