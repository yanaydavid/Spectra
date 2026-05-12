/**
 * AI Design Assistant Panel
 *
 * Chat with Claude about your RF chain design.
 * Posts the full chain context; displays the response with a
 * typewriter animation for a streaming feel.
 */

import React, { useState, useRef, useEffect } from 'react'
import { useSpectraStore } from '../../store/useSpectraStore'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Why is my NF so high?',
  'Which stage should I improve first?',
  'What LNA would you recommend for 2.4 GHz?',
  'How can I improve my IIP3?',
  'Explain the Friis formula',
]

// ── typewriter hook ───────────────────────────────────────────────────────────

function useTypewriter(target: string, active: boolean, speed = 8): string {
  const [displayed, setDisplayed] = useState('')
  const idx = useRef(0)

  useEffect(() => {
    if (!active) { setDisplayed(target); return }
    idx.current = 0
    setDisplayed('')
    const iv = setInterval(() => {
      idx.current += 3   // chars per tick
      setDisplayed(target.slice(0, idx.current))
      if (idx.current >= target.length) clearInterval(iv)
    }, speed)
    return () => clearInterval(iv)
  }, [target, active])

  return displayed
}

// ── lightweight markdown renderer ────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  // Split on **bold**, `code`, and plain text
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="text-gray-100 font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-gray-700/60 text-violet-300 px-0.5 rounded font-mono text-[10px]">{part.slice(1, -1)}</code>
    return part
  })
}

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Table: detect separator row
    if (i + 1 < lines.length && lines[i + 1].match(/^\s*\|?\s*[-:]+\s*\|/)) {
      const headers = line.split('|').map(s => s.trim()).filter(Boolean)
      i += 2  // skip header + separator
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map(s => s.trim()).filter(Boolean))
        i++
      }
      elements.push(
        <div key={`tbl-${i}`} className="overflow-x-auto my-1.5">
          <table className="text-[10px] border-collapse w-full">
            <thead>
              <tr className="border-b border-gray-700">
                {headers.map((h, j) => (
                  <th key={j} className="px-2 py-1 text-left text-gray-400 font-semibold">{renderInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-gray-800/50">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 text-gray-300">{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Heading ##
    if (line.startsWith('## ')) {
      elements.push(<p key={i} className="text-[11px] font-bold text-violet-300 mt-2 mb-0.5">{renderInline(line.slice(3))}</p>)
      i++; continue
    }
    if (line.startsWith('### ')) {
      elements.push(<p key={i} className="text-[11px] font-semibold text-gray-300 mt-1.5 mb-0.5">{renderInline(line.slice(4))}</p>)
      i++; continue
    }
    if (line.startsWith('# ')) {
      elements.push(<p key={i} className="text-[12px] font-bold text-violet-200 mt-2 mb-1">{renderInline(line.slice(2))}</p>)
      i++; continue
    }

    // Bullet
    if (line.match(/^[-*] /)) {
      elements.push(
        <div key={i} className="flex gap-1.5 my-0.5">
          <span className="text-violet-500 shrink-0 mt-0.5">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      )
      i++; continue
    }

    // Empty line
    if (line.trim() === '') { elements.push(<div key={i} className="h-1" />); i++; continue }

    // Normal paragraph
    elements.push(<p key={i} className="my-0.5">{renderInline(line)}</p>)
    i++
  }

  return <>{elements}</>
}

// ── message bubble ────────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-2">
      <div className="max-w-[85%] rounded-lg rounded-br-sm px-3 py-2 text-[11px] leading-relaxed bg-violet-700 text-white">
        {content}
      </div>
    </div>
  )
}

function AssistantBubble({ content, animate }: { content: string; animate: boolean }) {
  const displayed = useTypewriter(content, animate)
  const isTyping  = animate && displayed.length < content.length
  const isDone    = !isTyping

  return (
    <div className="flex justify-start mb-2">
      <div className="w-5 h-5 rounded-full bg-violet-700/60 flex items-center justify-center text-[9px] text-violet-300 shrink-0 mt-0.5 mr-1.5">
        ◈
      </div>
      <div className="max-w-[85%] rounded-lg rounded-bl-sm px-3 py-2 text-[11px] leading-relaxed bg-gray-800 text-gray-200 border border-gray-700">
        {isDone
          ? <MarkdownContent text={content} />
          : <span className="whitespace-pre-wrap">{displayed}</span>
        }
        {isTyping && (
          <span className="inline-block w-1.5 h-3 bg-violet-400 ml-0.5 animate-pulse rounded-sm align-middle" />
        )}
      </div>
    </div>
  )
}

// ── main panel ────────────────────────────────────────────────────────────────

export function AIAssistantPanel() {
  const [open, setOpen]       = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [lastAiIdx, setLastAiIdx] = useState(-1)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const scrollRef  = useRef<HTMLDivElement>(null)   // ref on the messages scroll container
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  const chain           = useSpectraStore((s) => s.chain)
  const components      = useSpectraStore((s) => s.components)
  const cascadeResult   = useSpectraStore((s) => s.cascadeResult)
  const systemParams    = useSpectraStore((s) => s.systemParams)
  const chainClearedAt  = useSpectraStore((s) => s.chainClearedAt)

  // Clear conversation whenever the chain is explicitly cleared
  useEffect(() => {
    if (chainClearedAt === 0) return   // initial mount — skip
    setMessages([])
    setLastAiIdx(-1)
  }, [chainClearedAt])

  // ⌘K / Ctrl+K — focus the chat input (open panel if collapsed)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
        // defer focus until after state update re-renders the input
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Scroll only INSIDE the messages div — never touches the outer sidebar
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  function safeNum(v: number | null | undefined): number | null {
    if (v == null || !isFinite(v) || isNaN(v)) return null
    return v
  }

  function buildPayload(userMessage: string) {
    const stages = chain
      .map((id) => components[id])
      .filter(Boolean)
      .map((c) => ({
        name: c.name, type: c.type,
        gain_db: c.gain_db, nf_db: c.nf_db,
        iip3_dbm: safeNum(c.iip3_dbm),
      }))

    return {
      message: userMessage,
      history: messages.slice(-10),
      stages,
      cascade: cascadeResult
        ? {
            cascaded_nf_db:    safeNum(cascadeResult.cascaded_nf_db),
            total_gain_db:     safeNum(cascadeResult.total_gain_db),
            cascaded_iip3_dbm: safeNum(cascadeResult.cascaded_iip3_dbm),
            sensitivity_dbm:   safeNum(cascadeResult.sensitivity_dbm),
          }
        : null,
      system_params: {
        bandwidth_hz:  systemParams.bandwidth_hz  ?? 20_000_000,
        temperature_k: systemParams.temperature_k ?? 290,
        frequency_ghz: systemParams.frequency_ghz ?? 2.4,
      },
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])

    try {
      const payload = buildPayload(trimmed)
      console.log('[AI] Sending payload:', JSON.stringify(payload).slice(0, 300))

      const res = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      console.log('[AI] Response status:', res.status, res.statusText)

      const text = await res.text()
      console.log('[AI] Response body:', text.slice(0, 500))

      let data: Record<string, unknown>
      try {
        data = JSON.parse(text)
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Parse error: ${text.slice(0, 200)}` },
        ])
        return
      }

      if (!res.ok) {
        const detail = data.detail
        const errMsg = typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((e: {loc?: unknown[]; msg?: string}) => `${e.loc?.join('.')}: ${e.msg}`).join('; ')
            : `HTTP ${res.status}`
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Server error: ${errMsg}` },
        ])
        return
      }

      const reply = (data.reply as string) ?? `Unexpected response: ${JSON.stringify(data).slice(0, 200)}`
      setMessages((prev) => {
        const next = [...prev, { role: 'assistant' as const, content: reply }]
        setLastAiIdx(next.length - 1)
        return next
      })
    } catch (err) {
      console.error('[AI] Fetch error:', err)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Connection error: ${err instanceof Error ? err.message : String(err)}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const msgCount = Math.floor(messages.length / 2)

  return (
    <div className={`border-b border-gray-800 ${open ? 'bg-gray-950/40' : ''}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider hover:text-gray-300 transition-colors text-gray-400"
      >
        <span className="flex items-center gap-2">
          <span className="relative">
            <span className="text-violet-400 text-sm">◈</span>
            {messages.length === 0 && !loading && open && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
            )}
          </span>
          <span className="text-violet-300">AI Design Assistant</span>
          {msgCount > 0 && (
            <span className="text-[9px] bg-violet-900/50 text-violet-300 border border-violet-700 rounded px-1 font-mono">
              {msgCount} msg{msgCount > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {!open && (
            <kbd className="text-[8px] bg-gray-800 border border-gray-700 text-gray-600 rounded px-1 py-0.5 font-mono">⌘K</kbd>
          )}
          <span className="text-gray-600 text-[10px]">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col" style={{ height: '420px' }}>
          {/* Messages — scrollRef keeps scrolling contained inside this div only */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pt-2 pb-1 min-h-0">
            {messages.length === 0 && !loading && (
              <div className="space-y-3 py-1">
                {chain.length > 0 ? (
                  <div className="bg-gray-900/80 border border-violet-900/40 rounded-lg px-3 py-2 text-[10px] text-gray-500">
                    <span className="text-violet-400 font-semibold">◈ Context loaded:</span>{' '}
                    {chain.length}-stage chain
                    {cascadeResult && (
                      <> · NF <span className="text-amber-400">{cascadeResult.cascaded_nf_db.toFixed(1)} dB</span>
                       · Gain <span className="text-green-400">{cascadeResult.total_gain_db.toFixed(1)} dB</span></>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-600 text-center italic">
                    Add components to chain for contextual advice.
                  </p>
                )}
                <p className="text-[10px] text-gray-600 text-center">Try a question:</p>
                <div className="flex flex-col gap-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-left text-[10px] px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-violet-700 text-gray-400 hover:text-gray-200 rounded-lg transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) =>
              msg.role === 'user'
                ? <UserBubble key={i} content={msg.content} />
                : <AssistantBubble key={i} content={msg.content} animate={i === lastAiIdx} />
            )}

            {loading && (
              <div className="flex justify-start mb-2">
                <div className="w-5 h-5 rounded-full bg-violet-700/60 flex items-center justify-center text-[9px] text-violet-300 shrink-0 mt-0.5 mr-1.5">◈</div>
                <div className="rounded-lg rounded-bl-sm px-3 py-2 bg-gray-800 border border-gray-700 flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-1 border-t border-gray-800/60">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about your RF design… (⌘K)"
                rows={2}
                disabled={loading}
                className="flex-1 bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-lg px-2.5 py-2 text-[11px] text-gray-200 placeholder-gray-600 resize-none outline-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="shrink-0 w-8 h-8 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:bg-gray-700 disabled:text-gray-600 text-white flex items-center justify-center transition-colors"
              >
                <span className="text-sm">↑</span>
              </button>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setLastAiIdx(-1) }}
                className="mt-1.5 text-[9px] text-gray-700 hover:text-gray-500 transition-colors"
              >
                Clear conversation
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
