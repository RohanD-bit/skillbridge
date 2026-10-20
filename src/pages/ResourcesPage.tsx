import { PageIntro, PreviewNotice } from '../components/PageIntro'
import { Icon } from '../components/Icon'
export function ResourcesPage() {
  return (
    <>
      <PageIntro
        eyebrow="The resource library"
        title="Curiosity looks good on you."
      >
        Find your way through budgeting, saving, credit, and investing. A space
        for useful lessons and fresh perspectives.
      </PageIntro>
      <section aria-label="Resource search preview" className="card">
        <fieldset disabled>
          <legend className="sr-only">
            Search and filter controls, coming soon
          </legend>
          <label htmlFor="resource-search" className="field-label">
            What would you like to learn?
            <div className="relative">
              <Icon
                name="search"
                className="absolute top-6 left-4 text-muted"
              />
              <input
                id="resource-search"
                type="search"
                placeholder="Search topics, skills, and questions"
                className="field pl-12"
              />
            </div>
          </label>
          <div className="mt-5 flex flex-wrap gap-3">
            <label className="field-label text-xs" htmlFor="topic">
              Topic
              <select id="topic" className="field mt-1 min-w-44">
                <option>All topics</option>
                {['Budgeting', 'Saving', 'Credit', 'Investing'].map((topic) => (
                  <option key={topic}>{topic}</option>
                ))}
              </select>
            </label>
            <button type="button" className="button mt-auto">
              Search · Coming soon
            </button>
          </div>
        </fieldset>
      </section>
      <div className="mt-6">
        <PreviewNotice>
          Search and filters are not connected. No resources have been fetched
          from the database.
        </PreviewNotice>
      </div>
      <section className="mt-7 rounded-2xl border border-dashed border-stone-300 px-6 py-14 text-center">
        <Icon name="book" className="mx-auto h-9 w-9 text-forest" />
        <h2 className="mt-4 text-xl font-semibold">
          Your next discovery will be here.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Once the library is connected, you’ll be able to explore learning
          resources and find a topic that speaks to you.
        </p>
      </section>
    </>
  )
}
