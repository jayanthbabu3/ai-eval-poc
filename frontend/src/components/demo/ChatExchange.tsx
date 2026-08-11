import type { Turn } from '../../lib/types'
import { ms } from '../../lib/format'
import { SpinnerIcon } from '../Icons'

/**
 * The most recent question and answer as a conversation.
 *
 * The results table is the record; this is the moment. Seeing the assistant
 * reply in a familiar chat shape is what makes an audience believe it is a real
 * product rather than a spreadsheet of test output.
 */
function Avatar({ who }: { who: 'user' | 'assistant' }) {
  const isUser = who === 'user'
  return (
    <div
      aria-hidden="true"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
        isUser
          ? 'bg-brand text-white'
          : 'bg-raised text-ink-muted ring-1 ring-line'
      }`}
    >
      {isUser ? 'You' : 'IT'}
    </div>
  )
}

export function ChatExchange({ turn, pending }: { turn: Turn | null; pending: boolean }) {
  if (!turn && !pending) return null

  return (
    <div className="space-y-4">
      {turn && (
        <div className="flex items-start justify-end gap-2">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-[15px] leading-relaxed text-white">
            {turn.question}
          </div>
          <Avatar who="user" />
        </div>
      )}

      <div className="flex items-start gap-2">
        <Avatar who="assistant" />
        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-chat-line bg-surface px-3.5 py-2.5 shadow-[0_1px_2px_0_rgba(22,35,58,0.06)]">
          {pending ? (
            <p className="flex items-center gap-2 text-[15px] text-ink-muted">
              <SpinnerIcon /> Searching the knowledge base…
            </p>
          ) : turn?.generation.error ? (
            <p className="text-[15px] text-bad">{turn.generation.error}</p>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                {turn?.generation.answer || '(no answer returned)'}
              </p>
              {turn && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-2">
                  <span className="tabular text-[12px] text-ink-faint">
                    {turn.assistant_label}
                  </span>
                  <span className="text-[12px] text-ink-faint">·</span>
                  <span className="tabular text-[12px] text-ink-faint">
                    {ms(turn.generation.latency_ms)}
                  </span>
                  {turn.retrieval.kept.length > 0 && (
                    <>
                      <span className="text-[12px] text-ink-faint">·</span>
                      <span className="text-[12px] text-ink-faint">
                        read {turn.retrieval.kept.map((c) => c.document_id).join(', ')}
                      </span>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
