import { useEffect, useRef, useState } from 'react'
import './SupportChat.css'

const fmtTime = (ms) =>
  ms
    ? new Date(ms).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''

async function jget(url) {
  const r = await fetch(url, { credentials: 'same-origin' })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Request failed')
  return r.json()
}
async function jpost(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'Could not send.')
  return d
}

export default function SupportChat({ signedIn, onRequireAuth }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [unread, setUnread] = useState(false)
  const listRef = useRef(null)

  // Poll for an unread reply while the panel is closed.
  useEffect(() => {
    if (!signedIn || open) return
    let alive = true
    const check = () =>
      jget('/api/support/unread')
        .then((d) => alive && setUnread(Boolean(d.unread)))
        .catch(() => {})
    check()
    const t = setInterval(check, 30000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [signedIn, open])

  async function loadThread() {
    setLoading(true)
    setError('')
    try {
      const d = await jget('/api/support')
      setMessages(d.messages || [])
      setUnread(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Load + poll while open.
  useEffect(() => {
    if (!open || !signedIn) return
    loadThread()
    const t = setInterval(loadThread, 12000)
    return () => clearInterval(t)
  }, [open, signedIn])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  async function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      const d = await jpost('/api/support', { text: body })
      setMessages(d.messages || [])
      setText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !signedIn) {
      // still show the panel, but nudge sign-in
    }
  }

  return (
    <div className="support">
      {open && (
        <div className="support__panel" role="dialog" aria-label="Support chat">
          <div className="support__head">
            <div>
              <strong>Support</strong>
              <span className="support__sub">We usually reply within a day.</span>
            </div>
            <button className="support__x" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>

          {!signedIn ? (
            <div className="support__gate">
              <p>Sign in to start a conversation with our team.</p>
              <button
                className="support__signin"
                onClick={() => {
                  setOpen(false)
                  onRequireAuth?.()
                }}
              >
                Sign in
              </button>
            </div>
          ) : (
            <>
              <div className="support__list" ref={listRef}>
                {loading && !messages.length && <p className="support__muted">Loading…</p>}
                {!loading && !messages.length && (
                  <p className="support__muted">
                    Send us a message about your order or anything else — we'll get back
                    to you here and by email.
                  </p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`support__msg support__msg--${m.from === 'admin' ? 'them' : 'me'}`}
                  >
                    <span className="support__bubble">{m.text}</span>
                    <span className="support__time">
                      {m.from === 'admin' ? 'MailingLove · ' : ''}
                      {fmtTime(m.at)}
                    </span>
                  </div>
                ))}
              </div>

              {error && <p className="support__err">{error}</p>}

              <form className="support__form" onSubmit={send}>
                <textarea
                  className="support__input"
                  rows={2}
                  maxLength={2000}
                  placeholder="Type your message…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) send(e)
                  }}
                />
                <button className="support__send" type="submit" disabled={sending || !text.trim()}>
                  {sending ? '…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <button
        className="support__fab"
        onClick={toggle}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
      >
        {open ? (
          <span className="support__fab-x">×</span>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
            </svg>
            <span className="support__fab-label">Help</span>
            {unread && <span className="support__dot" />}
          </>
        )}
      </button>
    </div>
  )
}
