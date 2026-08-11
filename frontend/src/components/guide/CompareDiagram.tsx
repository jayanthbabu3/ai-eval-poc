/**
 * Makes the shape of the comparison unmistakable: one question goes to both
 * versions, and the two resulting answers are scored the same way.
 *
 * Without this people reasonably assume "compare" means comparing one question
 * against another, which is not what happens.
 */
export function CompareDiagram({ questionCount }: { questionCount: number }) {
  return (
    <figure className="overflow-x-auto rounded-lg border border-line bg-raised p-3">
      <svg
        viewBox="0 0 760 150"
        className="min-w-[600px]"
        role="img"
        aria-label={`Each selected question is sent to both versions. Version one answers it and is scored; version two answers the same question and is scored the same way. The two scores are then compared.`}
      >
        {/* the question */}
        <rect x={6} y={54} width={168} height={42} rx={8} fill="var(--color-surface)" stroke="var(--color-line-strong)" />
        <text x={90} y={72} textAnchor="middle" fill="var(--color-ink)" style={{ font: '600 13px Inter, sans-serif' }}>
          One question
        </text>
        <text x={90} y={88} textAnchor="middle" fill="var(--color-ink-faint)" style={{ font: '400 11px Inter, sans-serif' }}>
          e.g. "How do I get VPN access?"
        </text>

        {/* split to both versions */}
        <path d="M 178 75 L 198 75 L 198 32 L 218 32" stroke="var(--color-line-strong)" strokeWidth={1.5} fill="none" markerEnd="url(#cmpArrow)" />
        <path d="M 178 75 L 198 75 L 198 118 L 218 118" stroke="var(--color-line-strong)" strokeWidth={1.5} fill="none" markerEnd="url(#cmpArrow)" />

        {[
          { y: 12, label: 'V1 — Naive', sub: 'answers it' },
          { y: 98, label: 'V2 — Hardened', sub: 'answers the same one' },
        ].map((row) => (
          <g key={row.label}>
            <rect x={222} y={row.y} width={150} height={40} rx={8} fill="var(--color-surface)" stroke="var(--color-line-strong)" />
            <text x={297} y={row.y + 18} textAnchor="middle" fill="var(--color-ink)" style={{ font: '600 13px Inter, sans-serif' }}>
              {row.label}
            </text>
            <text x={297} y={row.y + 32} textAnchor="middle" fill="var(--color-ink-faint)" style={{ font: '400 11px Inter, sans-serif' }}>
              {row.sub}
            </text>

            <path d={`M 376 ${row.y + 20} L 408 ${row.y + 20}`} stroke="var(--color-line-strong)" strokeWidth={1.5} markerEnd="url(#cmpArrow)" />

            <rect x={412} y={row.y} width={158} height={40} rx={8} fill="var(--color-surface)" stroke="var(--color-line-strong)" />
            <text x={491} y={row.y + 18} textAnchor="middle" fill="var(--color-ink)" style={{ font: '600 13px Inter, sans-serif' }}>
              Scored
            </text>
            <text x={491} y={row.y + 32} textAnchor="middle" fill="var(--color-ink-faint)" style={{ font: '400 11px Inter, sans-serif' }}>
              same rules, same judge
            </text>
          </g>
        ))}

        {/* join back into the verdict */}
        <path d="M 574 32 L 596 32 L 596 75 L 618 75" stroke="var(--color-brand)" strokeWidth={1.5} fill="none" markerEnd="url(#cmpArrowBrand)" />
        <path d="M 574 118 L 596 118 L 596 75 L 618 75" stroke="var(--color-brand)" strokeWidth={1.5} fill="none" markerEnd="url(#cmpArrowBrand)" />

        <rect x={622} y={54} width={132} height={42} rx={8} fill="var(--color-brand-soft)" stroke="var(--color-brand)" />
        <text x={688} y={72} textAnchor="middle" fill="var(--color-brand)" style={{ font: '600 13px Inter, sans-serif' }}>
          Which scored higher
        </text>
        <text x={688} y={88} textAnchor="middle" fill="var(--color-brand)" style={{ font: '400 11px Inter, sans-serif' }}>
          and by how much
        </text>

        <defs>
          <marker id="cmpArrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-line-strong)" />
          </marker>
          <marker id="cmpArrowBrand" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-brand)" />
          </marker>
        </defs>
      </svg>

      <figcaption className="mt-2 text-[13px] text-ink-muted">
        This repeats for every question you tick. {questionCount} question
        {questionCount === 1 ? '' : 's'} selected means{' '}
        <strong>{questionCount * 2} answers</strong> — each question answered once by each
        version. The questions are never compared against each other; they are the fixed exam
        both versions have to sit.
      </figcaption>
    </figure>
  )
}
