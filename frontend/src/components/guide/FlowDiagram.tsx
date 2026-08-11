/**
 * How the assistant answers one question.
 *
 * Drawn as inline SVG rather than an image so it stays sharp, uses the theme
 * tokens, and carries a text alternative for anyone not reading it visually.
 */
export function FlowDiagram() {
  const boxes = [
    { x: 8, label: 'Question', sub: '"How do I get VPN access?"' },
    { x: 200, label: 'Search', sub: 'rank the 12 KB articles' },
    { x: 392, label: 'Prompt', sub: 'rules + articles + question' },
    { x: 584, label: 'LLM', sub: 'llama-3.3-70b' },
    { x: 776, label: 'Answer', sub: 'with "Sources: KB-001"' },
  ]

  return (
    <figure className="overflow-x-auto">
      <svg
        viewBox="0 0 940 132"
        className="min-w-[720px]"
        role="img"
        aria-label="An employee's question is used to search the knowledge base. The best-matching articles are put into a prompt together with the assistant's rules, sent to the language model, and the model returns an answer that cites the articles it used."
      >
        {boxes.map((box, index) => (
          <g key={box.label}>
            <rect
              x={box.x}
              y={26}
              width={148}
              height={58}
              rx={8}
              fill="var(--color-surface)"
              stroke="var(--color-line-strong)"
            />
            <text
              x={box.x + 74}
              y={50}
              textAnchor="middle"
              fill="var(--color-ink)"
              style={{ font: '600 14px Inter, sans-serif' }}
            >
              {box.label}
            </text>
            <text
              x={box.x + 74}
              y={69}
              textAnchor="middle"
              fill="var(--color-ink-faint)"
              style={{ font: '400 11px Inter, sans-serif' }}
            >
              {box.sub}
            </text>
            {index < boxes.length - 1 && (
              <path
                d={`M ${box.x + 152} 55 L ${box.x + 192} 55`}
                stroke="var(--color-brand)"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
            )}
          </g>
        ))}

        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-brand)" />
          </marker>
        </defs>

        <text
          x={274}
          y={108}
          textAnchor="middle"
          fill="var(--color-ink-faint)"
          style={{ font: '400 11px Inter, sans-serif' }}
        >
          the knowledge base is searched — the model never sees the rest of it
        </text>
        <text
          x={700}
          y={108}
          textAnchor="middle"
          fill="var(--color-ink-faint)"
          style={{ font: '400 11px Inter, sans-serif' }}
        >
          everything below is evaluated
        </text>
      </svg>
    </figure>
  )
}
