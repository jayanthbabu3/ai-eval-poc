import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { Banner, Card, Tag } from '../Primitives'
import { SpinnerIcon } from '../Icons'

interface Document {
  id: string
  title: string
  category: string
  tags: string[]
  content: string
}

export function KnowledgeTab() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .knowledge()
      .then((result) => active && setDocuments(result.documents))
      .catch((cause: unknown) =>
        active &&
        setError(cause instanceof Error ? cause.message : 'Could not load the knowledge base.'),
      )
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return documents
    return documents.filter((document) =>
      [document.id, document.title, document.category, document.content, ...document.tags]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [documents, query])

  if (loading) {
    return (
      <Card>
        <p className="flex items-center gap-2 text-[15px] text-ink-muted">
          <SpinnerIcon /> Loading knowledge base
        </p>
      </Card>
    )
  }

  if (error) return <Banner tone="error">{error}</Banner>

  return (
    <div className="space-y-4">
      <Card
        title="Knowledge base"
        subtitle="Everything the assistant is allowed to know. It cannot answer from anything else."
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-64 flex-1">
            <span className="sr-only">Search the knowledge base</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles by title, tag, or content"
              className="w-full rounded-md border border-line bg-canvas px-2.5 py-2 text-[15px] text-ink placeholder:text-ink-faint"
            />
          </label>
          <p className="tabular text-[14px] text-ink-muted">
            {visible.length}/{documents.length} articles
          </p>
        </div>

        <p className="mt-2 text-[13px] text-ink-faint">
          Retrieval today is TF-IDF keyword matching over this file. The interface it sits
          behind is deliberately narrow, so this can be swapped for ServiceNow or a vector
          database without touching anything downstream.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((document) => (
          <article key={document.id} className="rounded-lg border border-line bg-surface p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="tabular text-[14px] font-semibold text-brand">{document.id}</span>
              <Tag>{document.category}</Tag>
            </div>
            <h3 className="mt-1 text-[15px] font-medium text-ink">{document.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              {document.content}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {document.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-raised px-1.5 py-0.5 text-[12px] text-ink-faint"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
        {visible.length === 0 && (
          <p className="col-span-full py-8 text-center text-[15px] text-ink-muted">
            No articles match that search.
          </p>
        )}
      </div>
    </div>
  )
}
